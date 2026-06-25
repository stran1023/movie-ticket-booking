# Seat Hold System

**Status**: Settled — do not change without a product decision and concurrency testing.

## Problem

Cinema seat booking has a classic double-booking race: two users select the same seat at the same time. A DB transaction alone is not fast enough to prevent visible conflicts at the seat-selection UI.

## Decision

Two-layer seat hold:

1. **Redis (source of truth for real-time availability)** — seat held atomically using a Lua compare-and-delete script. This prevents TOCTOU races between check and write.
2. **DB `SeatHold` row (fallback for confirm-step validation)** — written after the Redis hold succeeds. Used as a safety net if Redis is unavailable at confirm time.

## Redis Key Design

```
cinema:hold:showtime:{showtime_id}:seat:{seat_label}  → value: user_id, TTL: 5 min (per-seat)
cinema:session:{user_id}:showtime:{showtime_id}       → value: timestamp, TTL: 15 min (session hard cap)
```

The session key is set once and **never refreshed**. This is intentional — it prevents users from holding seats indefinitely by refreshing the per-seat key.

## Lua CAS Script

Release uses a Lua compare-and-delete: `if redis.call("GET", key) == user_id then redis.call("DEL", key) end`. This ensures a user cannot accidentally release a seat that another user has since taken.

**Never replace this with a plain `GET` + conditional `DEL`** — those two operations are not atomic.

## WebSocket

Every hold, release, and book operation calls `broadcast_seat_update(showtime_id, action, seats)` in `bookings/services.py`. This is the only place WebSocket events are emitted — do not push to the Channels layer from views or tasks directly.

Frontend reconnects with exponential backoff (500 ms → 15 s max) — short network blips do not require a page reload.

## Constraints

- **15-min session hard cap** is non-refreshable by product design (anti-squatting)
- **5-min per-seat TTL** is refreshable within the session window
- Both TTLs are configured in `apps/bookings/services.py` — do not hardcode them in views or frontend

## What Must Not Change Without a New Design Doc

- The two-layer architecture (Redis + DB)
- The Lua CAS release script
- The non-refreshable session TTL
- The `broadcast_seat_update()` as the single dispatch point
