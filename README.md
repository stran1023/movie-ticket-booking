# CineBook — Movie Ticket Booking Platform

A full-stack cinema ticket booking platform built with Django and Next.js. Supports end-to-end booking with real-time seat management, VNPay/MoMo payment integration, a loyalty points system, and a flexible promotions engine.

---

## Features

- **Movie browsing** — full-text search, filters (now showing / coming soon), movie detail with trailers
- **7-step booking wizard** — movie → showtime → seats → concessions → confirm → payment → receipt
- **Real-time seat map** — WebSocket-powered live seat hold/release/book updates across all clients
- **Seat hold system** — 5-minute per-seat TTL + 15-minute session hard cap via Redis
- **Payment gateways** — VNPay (HMAC-SHA512) and MoMo (HMAC-SHA256) with sandbox support
- **Loyalty points** — earn points on full-price bookings, redeem for discounts (configurable caps)
- **Promotions engine** — user promotions, movie promo codes, flat-price seat promotions, community-shared codes
- **Concessions** — categorized snacks/drinks, combo packs, server-side price verification
- **Downloadable ticket** — QR code + barcode receipt, exportable as PNG
- **Admin dashboard** — Django Jazzmin UI with analytics, PDF export, showtime generator, seat map editor
- **Email flows** — account activation, password reset, movie release reminders (Celery)

---

## Tech Stack

### Backend
| | |
|---|---|
| Framework | Django 6 + Django REST Framework 3 |
| Language | Python 3.12 (managed by `uv`) |
| Database | PostgreSQL |
| Cache / Queue | Redis 7 (Celery broker + seat holds + promo cache) |
| Real-time | Django Channels 4 + Daphne (ASGI) |
| Background jobs | Celery 5 + django-celery-beat |
| Auth | JWT — djangorestframework-simplejwt (30-min access, 7-day rotating refresh) |
| API docs | drf-spectacular (OpenAPI / Swagger) |
| Admin UI | Django Jazzmin |
| PDF reports | WeasyPrint |

### Frontend
| | |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| State | Redux Toolkit + redux-persist (with expiry transforms) |
| UI | Radix UI + Shadcn/ui + Tailwind CSS 4 |
| HTTP | Axios (token refresh interceptor) + SWR |
| Forms | React Hook Form + Zod |
| Real-time | Native WebSocket (exponential backoff reconnect) |
| Ticket | react-qr-code, react-barcode, html-to-image |

---

## Project Structure

```
Movie_Ticket_Booking/
├── backend/
│   ├── apps/
│   │   ├── bookings/       # Booking, Ticket, Payment — core booking flow
│   │   ├── cinemas/        # CinemaRoom (seat map), Showtime, SeatHold
│   │   ├── concessions/    # Snacks, combos, orders
│   │   ├── contacts/       # Contact form
│   │   ├── core/           # BaseModel (soft-delete, timestamps)
│   │   ├── movies/         # Movie, Version, MovieReminder
│   │   ├── promotions/     # UserPromotion, MoviePromotion, FlatPricePromotion
│   │   └── users/          # User, UserProfile, loyalty points system
│   ├── analytics/          # Dashboard KPIs, revenue trends, PDF reports
│   ├── config/             # Django settings, URLs, ASGI, Celery
│   ├── static/             # Movie posters, concession images, admin assets
│   ├── templates/          # Admin dashboard & PDF templates
│   └── docs/               # API design documents
├── frontend/
│   ├── app/                # Next.js App Router pages
│   ├── components/
│   │   ├── booking/        # 7-step booking wizard components
│   │   ├── account/        # Profile, avatar, password, reminders
│   │   └── ui/             # Shadcn/Radix UI primitives
│   ├── lib/
│   │   ├── api/            # Axios API modules (movies, cinemas, auth, points…)
│   │   └── store/          # Redux slices (auth, booking, cart)
│   └── public/             # Icons, placeholder images
├── docs/
│   ├── setup.md
│   ├── git_rules.md
│   └── openapi.json
└── docker-compose.yml      # Redis service
```

---

## Prerequisites

- **Python 3.12+** and [`uv`](https://github.com/astral-sh/uv)
- **Node.js 18+** and `pnpm`
- **PostgreSQL 14+**
- **Redis 7**
- **Docker** (optional, for Redis via docker-compose)

---

## Setup

### 1. Redis

```bash
docker-compose up -d
```

Or run Redis manually on `localhost:6379`.

### 2. Backend

```bash
cd backend

# Install dependencies
uv sync

# Copy and configure environment
cp .env.example .env
# Edit .env: set DB_USER, DB_PASSWORD, and your SECRET_KEY

# Create the PostgreSQL database
# psql -U postgres -c "CREATE DATABASE cinebook_db;"

# Run migrations
uv run python manage.py migrate

# (Optional) Load demo data
uv run python manage.py loaddata backend/apps/movies/fixtures/movies_data.json
uv run python manage.py loaddata backend/apps/cinemas/fixtures/rooms.json
uv run python manage.py loaddata backend/apps/cinemas/fixtures/showtimes.json
uv run python manage.py loaddata backend/apps/concessions/fixtures/concessions.json
uv run python manage.py loaddata backend/apps/promotions/fixtures/promotion-fixture.json
uv run python manage.py loaddata backend/apps/users/fixtures/user.json

# Create a superuser for admin access
uv run python manage.py createsuperuser
```

### 3. Frontend

```bash
cd frontend
pnpm install
```

Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_BASE=http://localhost:8000
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Running

Open **three terminals**:

```bash
# Terminal 1 — Django dev server (ASGI via Daphne)
cd backend && uv run python manage.py runserver

# Terminal 2 — Celery worker (background tasks)
cd backend && uv run celery -A config worker -l info --pool=solo

# Terminal 3 — Next.js dev server
cd frontend && pnpm dev
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000/api/ |
| Swagger UI | http://localhost:8000/api/schema/swagger-ui/ |
| Admin | http://localhost:8000/admin/ |

> **Windows note:** WeasyPrint (PDF export) requires MSYS2 with `mingw-w64-ucrt-x86_64-pango`. See `docs/setup.md` for details.

---

## Booking Flow

```
Browse Movies → Select Showtime → Reserve Seats (WebSocket hold)
    → Add Concessions → Apply Promotions / Points → Pay (VNPay or MoMo)
    → Receive Ticket (QR code, downloadable PNG)
```

**Seat hold mechanics:**
- Each seat is locked in Redis for **5 minutes** (refreshable)
- A session hard cap of **15 minutes** applies per user per showtime (non-refreshable)
- Seat state is broadcast to all connected clients in real-time via WebSocket

**Payment:**
- Backend generates a signed payment URL and redirects the user to the gateway
- On return, the HMAC signature is verified and tickets are activated
- Loyalty points are awarded only on full-price bookings (no discounts applied)

---

## Loyalty Points

| Rule | Value |
|------|-------|
| Earn rate | ~1 pt per 10,000 VND (configurable) |
| Earn condition | No discounts applied to the booking |
| Redemption cap | Up to 50% of subtotal (configurable) |
| Minimum to redeem | 4 points |
| Rate | 500 VND per point |

All config lives in the `PointRedemptionConfig` admin singleton.

---

## Promotions

| Type | How it works |
|------|-------------|
| **UserPromotion** | Auto-applied campaign (birthday, holiday, age range) |
| **MoviePromotion** | User enters a promo code; one-time per user |
| **FlatPricePromotion** | Fixed price per seat type on specific dates or weekdays |

Promotions and points redemption are **mutually exclusive** at the confirm step. Flat-price `is_active` flags are refreshed nightly by Celery Beat.

---

## API Documentation

The full OpenAPI schema is available at:
- **Swagger UI:** `http://localhost:8000/api/schema/swagger-ui/`
- **Static snapshot:** `docs/openapi.json`

---

## Payment Sandbox Credentials

**VNPay test card:**
- Bank: NCB
- Card number: `9704198526191432198`
- Cardholder: `NGUYEN VAN A`
- Expiry: `07/15`
- OTP: `123456`

**MoMo test wallet:** Use the MoMo sandbox app or test credentials from the MoMo developer portal.

---

## Git Workflow

See [`docs/git_rules.md`](docs/git_rules.md) for full conventions.

```
Branch naming:  feat/<scope>-<desc> | fix/<scope>-<desc> | chore/<scope>-<desc>
Commit format:  feat(movies): list & detail with showtimes by date
Base branch:    develop  (never push directly to main or develop)
MR target:      develop  (squash merge, delete source branch)
```

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in:

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | Django secret key |
| `DB_NAME / DB_USER / DB_PASSWORD` | PostgreSQL credentials |
| `REDIS_BROKER_URL` | Celery broker (default: `redis://localhost:6379/0`) |
| `VNPAY_TMN_CODE / VNPAY_HASH_SECRET_KEY` | VNPay gateway credentials |
| `MOMO_PARTNER_CODE / MOMO_ACCESS_KEY / MOMO_SECRET_KEY` | MoMo gateway credentials |

---

## License

This project is for educational and portfolio purposes.
