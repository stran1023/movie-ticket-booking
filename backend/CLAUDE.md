# CineBook Backend — CLAUDE.md

## Commands
```bash
uv run python manage.py runserver          # Dev server (ASGI via Daphne)
uv run python manage.py migrate            # Apply migrations
uv run python manage.py makemigrations     # Generate migrations (always name them)
uv run python manage.py createsuperuser    # Admin user
uv run python manage.py test               # Run tests

uv run celery -A config worker -l info --pool=solo   # Celery worker
uv run celery -A config beat -l info                 # Celery Beat (scheduled tasks)

uv add <package>       # Add dependency (updates pyproject.toml + uv.lock)
uv sync                # Install from uv.lock
```

## App structure
All apps live under `apps/` and are registered as `apps.<name>` in INSTALLED_APPS.

| App | Models | Key files |
|-----|--------|-----------|
| `core` | BaseModel (abstract) | `models.py`, `permissions.py` |
| `users` | User, UserProfile, UserPoint, PointTransaction, PointRedemptionConfig | `services.py` (point earn/redeem logic) |
| `movies` | Movie, Version, MovieReminder | `tasks.py` (status updates + reminder emails), `search_utils.py` |
| `cinemas` | CinemaRoom, Showtime, SeatHold | `services.py`, `showtime_generator.py` |
| `bookings` | Booking, Ticket, Payment | `services.py` (Redis seat locks), `consumers.py` (WebSocket) |
| `promotions` | UserPromotion, MoviePromotion, FlatPricePromotion, PromoRedemption | `services.py` (validation + cache), `tasks.py` |
| `concessions` | Concession, ConcessionVariant, ComboComponent, ConcessionOrder, ConcessionItem | `views.py`, `filters.py` |
| `contacts` | ContactMessage | — |

`analytics/` (root-level, not under `apps/`) — no models, service layer only (KPIs, trends, PDF export).

## BaseModel pattern (all models inherit this)
```python
# core/models.py
class BaseModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False, db_index=True)

    objects = NotDeletedManager()    # excludes soft-deleted (default)
    all_objects = models.Manager()   # includes soft-deleted

    class Meta:
        abstract = True
```
Always use `objects` for queries. Use `all_objects` only in admin or audit contexts.

## Seat hold system (bookings/services.py)
Two-layer locking — Redis is source of truth for real-time availability; DB SeatHold is fallback for confirm-step validation.

Redis key patterns:
```
cinema:hold:showtime:{showtime_id}:seat:{seat_label}  → TTL 5 min (refreshable)
cinema:session:{user_id}:showtime:{showtime_id}       → TTL 15 min (hard cap, never refreshed)
```

Release uses a **Lua compare-and-delete script** to prevent TOCTOU race conditions — do not replace with plain GET+DEL.

`broadcast_seat_update(showtime_id, action, seats)` in `services.py` is the single place to trigger WebSocket events — always call it after hold/release/book operations.

## WebSocket (bookings/consumers.py)
- Route: `ws://<host>/ws/showtime/<showtime_id>/`
- Channel group: `showtime_{showtime_id}`
- Event shape: `{"action": "hold"|"release"|"book", "seats": ["A1", "B2"]}`
- ASGI config in `config/asgi.py`, Redis channel layer in `config/settings.py`

## Showtime validation rules (cinemas/models.py `Showtime.clean()`)
- **60-minute lockout**: cannot create/edit if showtime starts within 60 min
- **Overlap detection**: no two confirmed showtimes in the same room can overlap
- **Minimum gap**: 10-minute buffer required between back-to-back showtimes in the same room
- Validation runs on both create and edit

## Points system (users/services.py)
```python
award_points(booking)          # Call after payment success; idempotent (checks for existing EARN tx)
calculate_redeemable_points()  # Returns (redeemable_pts, max_vnd, user_balance)
redeem_points()                # Atomic: SELECT FOR UPDATE on UserPoint
```
PointRedemptionConfig is a **singleton admin row** — never create/delete it, only update. Access via `PointRedemptionConfig.get_config()`.

## Promotion system (promotions/services.py)
- MoviePromotion validation is **cached 30 min** in Redis (`cinema:promo:cache:{CODE}`)
- `PromoRedemption` enforces one-time use per user via `unique_together(user, promo_code)` with `SELECT FOR UPDATE`
- `FlatPricePromotion.is_active` is managed by `refresh_promotions_is_active` Celery task — do not set it manually in code
- Community codes: Redis sorted set updated on every successful validation

## Celery tasks
| Task | App | Trigger |
|------|-----|---------|
| `update_movie_statuses` | movies | Daily midnight (Beat) |
| `send_release_day_emails` | movies | On-demand (queued by above) |
| `refresh_promotions_is_active` | promotions | Daily midnight (Beat) |
| `send_activation_email` | users | On registration |
| `send_password_reset_email` | users | On forgot-password |

All on-demand tasks use `task.delay(...)`. Email tasks retry 3× with 60s delay.

## Payment callbacks
- VNPay return: `GET /api/bookings/vnpay-return/` — verify HMAC-SHA512, update Payment + Booking + Tickets, award points, broadcast WebSocket
- MoMo IPN: `POST /api/bookings/momo-ipn/` — verify HMAC-SHA256, same flow server-to-server
- Both callbacks are `AllowAny` (payment gateway cannot authenticate)

## Key conventions
- Migrations: always run `makemigrations` before `migrate`; commit migration files
- New app? Register as `"apps.<name>"` in `INSTALLED_APPS` (not just `"<name>"`)
- Serializers: use DRF serializers for all API I/O — no raw `request.data` access in views
- Views: use class-based `APIView` or `ViewSet`; define `permission_classes` explicitly on every view
- Soft delete: never call `.delete()` on model instances — set `is_deleted = True` and save
- Admin: new models should be registered in the app's `admin.py` with at least `list_display`
- `Showtime.movie` is a property (lazy-loaded from `movie_id` IntegerField) — not a FK, do not join on it

## Environment (.env)
Copy `.env.example` → `.env`. Required vars: `SECRET_KEY`, `DB_*`, `REDIS_BROKER_URL`, `VNPAY_*`, `MOMO_*`.
`DEBUG=True` in development. Never commit `.env`.
