# CineBook — Architecture

## System Shape

- **Product**: CineBook — cinema ticket booking platform (Vietnamese market, VND, Asia/Ho_Chi_Minh)
- **Primary user workflow**: Browse movies → select showtime → hold seats → pay → receive QR tickets
- **Runtime surfaces**: web (Next.js 16), REST API (Django 6 + DRF), WebSocket (Django Channels), workers (Celery + Beat)
- **Source of truth for product behavior**: `docs/design-docs/`

## Domain Map

| Domain | Purpose | Primary Entry Points | Design Doc |
|--------|---------|----------------------|------------|
| `users` | Auth, profiles, loyalty points earn/redeem | `apps/users/views.py`, `apps/users/services.py` | — |
| `movies` | Movie catalog, versions, release reminders | `apps/movies/views.py`, `apps/movies/tasks.py` | — |
| `cinemas` | Rooms, showtimes, seat holds (Redis) | `apps/cinemas/views.py`, `apps/cinemas/services.py` | `design-docs/seat-hold.md` |
| `bookings` | Booking lifecycle, tickets, payments, WebSocket | `apps/bookings/views.py`, `apps/bookings/services.py` | `design-docs/booking-flow.md` |
| `promotions` | Promo codes, flat-price promos, community codes | `apps/promotions/views.py`, `apps/promotions/services.py` | `design-docs/points-promotions.md` |
| `concessions` | Food/beverage ordering attached to bookings | `apps/concessions/views.py` | — |
| `analytics` | KPI reports, booking trends, PDF export | `analytics/views.py`, `analytics/utils/` | — |

## Layer Model

```
PostgreSQL
  ↓ BaseModel (ORM, soft-delete, NotDeletedManager)
  ↓ Services (business logic — bookings/services.py, users/services.py, etc.)
  ↓ API Views (DRF APIView / ViewSet — permission_classes on every view)
  ↓ HTTP (REST) / WebSocket (Channels)
  ↓ Frontend API Client (lib/api/*.ts — Axios + SWR + React cache)
  ↓ React Components (App Router — server-first, "use client" only when needed)
```

Rules:
- Views call services; they contain no business logic.
- Services are the only layer that writes to Redis (seat locks, promo cache).
- Components use `lib/api/` modules; they never call `fetch`/`axios` directly.
- `broadcast_seat_update()` in `bookings/services.py` is the single WebSocket dispatch point.

## Hard Dependency Rules

- Lower layers must not depend on higher layers.
- `Showtime.movie` is an `IntegerField` (not a FK) — do not ORM-join on it.
- New apps register as `"apps.<name>"` in `INSTALLED_APPS`.
- Payment callbacks (`/vnpay-return/`, `/momo-ipn/`) are `AllowAny` — HMAC is the auth mechanism; never add session/JWT auth to them.
- Never call `.delete()` on model instances — set `is_deleted = True` and save (soft delete).

## Cross-Cutting Interfaces

| Concern | Approved Boundary | Notes |
|--------|-------------------|-------|
| Authentication | `apps/users/` (simplejwt) + `lib/api/client.ts` (401 refresh queue) | Refresh queue fires one `POST /token/refresh/` — do not add refresh logic elsewhere |
| Seat locks | `apps/bookings/services.py` Lua CAS script | Never replace with plain GET+DEL — see `design-docs/seat-hold.md` |
| Async tasks | Celery `task.delay()` | Beat for daily scheduled tasks; `.delay()` for on-demand (email, etc.) |
| WebSocket events | `broadcast_seat_update(showtime_id, action, seats)` | Always call after hold/release/book; do not push Channel messages directly |
| Promo cache | `apps/promotions/services.py` | 30-min Redis TTL per promo code |
| Monetary values | VND integers everywhere | No decimals, no floats |

## Current Hot Spots

- `apps/bookings/services.py` — seat hold + WebSocket broadcast are tightly coupled; test concurrently before touching
- `analytics/utils/pdf_generator.py` — in-progress, uncommitted changes (active feature `analytics-001`)
- `frontend/components/booking/step-confirm.tsx` — points/promo mutual exclusion is UI-enforced; backend validates independently; both must stay in sync

## Change Checklist

When touching architecture-relevant code:
1. Update this file if the domain map or layer boundaries changed.
2. Update the relevant `docs/design-docs/` file if the reasoning changed.
3. Run `./init.sh` to confirm baseline is still clean after the change.
