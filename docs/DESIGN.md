# CineBook — Design

Router for settled design decisions. Read this before introducing a new pattern.

## Read This When

- You are about to change how seats are held, released, or confirmed
- You are about to change how points or promotions interact at checkout
- You are adding a new async operation (Celery task, WebSocket event)
- You need to know which decisions are settled versus open

## Settled Design Decisions

| Area | Decision | Doc |
|------|----------|-----|
| Seat hold | Redis Lua CAS, two-layer (Redis + DB fallback), non-refreshable 15-min session | `design-docs/seat-hold.md` |
| Points/promotions | Mutually exclusive at confirm step; backend validates independently of UI | `design-docs/points-promotions.md` |
| Booking flow | 7-step wizard; Redux state; WebSocket for seat availability | `design-docs/booking-flow.md` |
| Showtime model | `movie` is an `IntegerField`, not a FK — no ORM join | `ARCHITECTURE.md` |
| Payment auth | `AllowAny` + HMAC verification (gateway cannot present JWT) | `SECURITY.md` |

## Open Questions

- Analytics PDF export: final API shape and auth scope (staff-only vs. admin-only) — tracked in `analytics-001`
- Analytics KPI API: date range granularity and caching strategy — tracked in `analytics-002`

## Design Rules

- Keep design docs small and current — one doc per decision area
- If a design rule becomes operationally critical, add it to `RELIABILITY.md` or an automated check
- Link design docs from `feature_list.json` notes when a feature depends on a settled decision
- Deprecated decisions go in the doc with a `## Deprecated` section, not deleted
