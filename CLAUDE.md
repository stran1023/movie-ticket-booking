# CineBook — Root CLAUDE.md

## What this project is
Full-stack cinema ticket booking platform. Django backend + Next.js frontend. Vietnamese market — VNPay and MoMo payment gateways, prices in VND, timezone Asia/Ho_Chi_Minh.

## Monorepo layout
```
backend/   Django 6 + DRF + Channels (Python 3.12, uv)
frontend/  Next.js 16 App Router (TypeScript, pnpm)
docs/      API design docs, git rules, OpenAPI snapshot
docker-compose.yml  Redis only — Postgres and app servers run locally
```

## Running the full stack (3 terminals)
```bash
# 1 — Redis
docker-compose up -d

# 2 — Django (ASGI)
cd backend && uv run python manage.py runserver

# 3 — Celery worker
cd backend && uv run celery -A config worker -l info --pool=solo

# 4 — Next.js
cd frontend && pnpm dev
```

Service URLs: frontend http://localhost:3000 | API http://localhost:8000/api/ | Swagger http://localhost:8000/api/schema/swagger-ui/ | Admin http://localhost:8000/admin/

## Git conventions (see docs/git_rules.md)
- Branch from `develop`: `feat/<scope>-<desc>` | `fix/<scope>-<desc>` | `chore/<scope>-<desc>`
- Commit format: `feat(movies): list & detail with showtimes by date`
- MR target: `develop` — squash merge, delete source branch
- Never push directly to `main` or `develop`

## Critical business rules (know these before touching pricing/discounts)
- **Points earned only on full-price bookings**: `points_used == 0 AND discount_amount == 0`
- **Points ↔ promotions are mutually exclusive** on the confirm step
- **FlatPricePromotion.is_active** is set by a nightly Celery task, not in real-time
- **Seat hold session hard cap**: 15 minutes per user per showtime (non-refreshable), per-seat TTL is 5 min
- **Showtime lockout**: cannot create/edit a showtime within 60 minutes of its start time
- All monetary values are Vietnamese Dong (VND) — integers, no decimals

## Infrastructure dependencies
| Service | Purpose | Default |
|---------|---------|---------|
| PostgreSQL | Primary DB | localhost:5432, db=cinebook_db |
| Redis DB 0 | Celery broker | localhost:6379 |
| Redis DB 1 | Celery results | localhost:6379 |
| Redis DB 2 | Cache, seat holds, throttle counts | localhost:6379 |

## See also
- `backend/CLAUDE.md` — Django conventions, app structure, commands
- `frontend/CLAUDE.md` — Next.js conventions, Redux, booking flow
- `docs/git_rules.md` — Full git workflow
- `docs/setup.md` — First-time setup walkthrough
