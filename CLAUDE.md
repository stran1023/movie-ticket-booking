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

## Startup Workflow

At the start of every session:

1. Run `./init.sh` — confirms Redis/Postgres, syncs deps, runs backend tests + frontend type-check.
2. Read `progress.md` — see what was last verified and what the next step is.
3. Read `feature_list.json` — pick the single highest-priority `in_progress` feature (or first `not_started` if none active).
4. Run `git log --oneline -5` — confirm baseline is clean.

**One feature at a time.** Do not begin a second feature until the active one is `passing`.
Stay in scope — do not touch passing features unless they are breaking.

## State artifacts

| File | Purpose |
|------|---------|
| `feature_list.json` | Feature tracker — status, verification steps, evidence |
| `progress.md` | Session log — what was done, what broke, next step |
| `session-handoff.md` | Fill out before stopping; guides the next session's restart |

## Verification commands

```bash
# Backend (run from repo root or backend/)
cd backend && uv run python manage.py test                     # full suite
cd backend && uv run python manage.py test apps.<name>         # single app
cd backend && uv run python manage.py test analytics           # analytics module

# Frontend (run from frontend/)
cd frontend && pnpm run type-check                             # TypeScript check
cd frontend && pnpm run build                                  # production build
```

## Definition of Done

A feature moves to `passing` only when:
1. All `verification` steps in `feature_list.json` for that feature have run without error.
2. The evidence (command output or screenshot path) is recorded in the feature's `evidence` array.
3. `progress.md` is updated with what ran.
4. Changes are committed (never leave unstaged work when stopping).

## End of Session

Before ending any session:
1. Update `progress.md` — record what ran, what broke, the Recommended Next Step.
2. Update the feature's `status` and `evidence` in `feature_list.json`.
3. Fill in `session-handoff.md` with broken paths and next step.
4. Commit all changes so the repo is in a restartable state.

## See also

**Harness**
- `feature_list.json` — feature tracker and verification steps
- `progress.md` — session log and next step
- `session-handoff.md` — fill before stopping

**Architecture and design**
- `docs/ARCHITECTURE.md` — domain map, layer model, hot spots
- `docs/DESIGN.md` — settled design decisions and open questions
- `docs/design-docs/seat-hold.md` — Redis Lua CAS seat hold system
- `docs/design-docs/booking-flow.md` — 7-step wizard, payment flow, points award
- `docs/design-docs/points-promotions.md` — mutual exclusion, earn/redeem rules

**Product, quality, reliability**
- `docs/PRODUCT_SENSE.md` — product rules and no-go patterns
- `docs/RELIABILITY.md` — standard commands, golden journeys, known fragile areas
- `docs/SECURITY.md` — secrets, payment HMAC, auth rules
- `docs/FRONTEND.md` — component patterns, Redux, wizard, API client
- `docs/QUALITY_SCORE.md` — domain and layer health grades

**Reference**
- `backend/CLAUDE.md` — Django conventions, app structure, commands
- `frontend/CLAUDE.md` — Next.js conventions, Redux, booking flow
- `docs/git_rules.md` — full git workflow
- `docs/setup.md` — first-time setup walkthrough
