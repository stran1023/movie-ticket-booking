# CineBook — Reliability

## Standard Paths

| Action | Command |
|--------|---------|
| Bootstrap (deps + baseline verify) | `./init.sh` |
| Backend tests | `cd backend && uv run python manage.py test` |
| Single app tests | `cd backend && uv run python manage.py test apps.<name>` |
| Frontend type check | `cd frontend && pnpm run type-check` |
| Frontend build | `cd frontend && pnpm run build` |
| Start Django (ASGI) | `cd backend && uv run python manage.py runserver` |
| Start Celery worker | `cd backend && uv run celery -A config worker -l info --pool=solo` |
| Start frontend | `cd frontend && pnpm dev` |
| Check Redis | `redis-cli ping` |

All four services (Redis, Django, Celery, Next.js) must be running to exercise the full booking flow.

## Required Runtime Signals

- Django: structured logs on every request; 500 errors logged with tracebacks
- Celery: task success/failure logged at INFO level; email tasks retry 3× with 60 s delay
- WebSocket: seat hold/release/book events emit `broadcast_seat_update()` — frontend reconnects on drop
- Payment callbacks: HMAC verification failure must log the mismatch (without logging the secret) and return 400
- Seat hold expiry: Redis TTL auto-expires per-seat keys; session key expires the 15-min cap

## Golden Journeys

These must work end-to-end before any release:

1. **Full booking (VNPay)**: Browse movies → pick showtime → hold 2 seats → add concessions → apply no promo → confirm → VNPay redirect → HMAC callback → booking CONFIRMED + tickets issued + points awarded
2. **Promo code booking**: Reach step 5 → enter valid promo code → discount applied → no points awarded → payment completes
3. **Points redemption**: Reach step 5 → redeem points → no promo applied → reduced total → payment completes
4. **Seat conflict**: Two sessions hold the same seat concurrently — second `holdSeats()` call returns 409 (`SeatConflictError`); frontend shows conflict message; no double-hold in Redis
5. **Hold expiry**: Hold a seat → wait for 5-min TTL → seat auto-released → WebSocket `release` event reaches other open sessions
6. **Payment failure (MoMo IPN)**: Gateway sends IPN with failed status → booking stays PENDING → tickets not issued → points not awarded

Each journey has a matching `verification` entry in `feature_list.json`.

## Reliability Rules

- No feature is complete if `./init.sh` fails after the change is applied
- Seat hold atomicity (Lua CAS) must never be replaced with a non-atomic approach
- Payment callback handlers are idempotent — replaying the same callback must not double-issue tickets or double-award points
- Celery email tasks retry on failure — do not add synchronous email calls in request handlers
- `FlatPricePromotion.is_active` is set by Beat task only — manual writes break the nightly refresh cycle
- The 15-min session cap is non-refreshable by design — do not add a refresh path without a product decision

## Known Fragile Areas

| Area | Risk | Mitigation |
|------|------|------------|
| `bookings/services.py` | Concurrent seat hold race | Lua CAS script — do not touch without full concurrency test |
| VNPay/MoMo HMAC | Key rotation breaks all pending callbacks | Rotate secrets outside of active booking windows |
| `analytics/utils/pdf_generator.py` | In-progress, untested | Active feature `analytics-001` — do not merge until PDF verification passes |
| `step-confirm.tsx` mutual exclusion | UI-only guard | Backend also validates — both layers must stay in sync |
