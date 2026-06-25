# CineBook — Security

## Secrets and Credentials

- All secrets live in `.env` (local, never committed). Copy `.env.example` → `.env` on setup.
- Required secrets: `SECRET_KEY`, `DB_*`, `REDIS_BROKER_URL`, `VNPAY_*`, `MOMO_*`
- Never log or return secret values from API views
- Redact tokens, API keys, and payment references from logs and screenshots

## Payment Security

- **VNPay return** (`GET /api/bookings/vnpay-return/`): verify HMAC-SHA512 over the query string before processing
- **MoMo IPN** (`POST /api/bookings/momo-ipn/`): verify HMAC-SHA256 over the request body before processing
- Both endpoints are `AllowAny` by design — the payment gateway cannot present a JWT. HMAC is the auth layer.
- If HMAC verification fails, return 400 and do not update booking state
- Never re-expose raw gateway parameters in API responses

## Authentication and Authorization

- JWT via `simplejwt` — access token (short-lived) + refresh token (httpOnly cookie)
- The 401 refresh queue in `lib/api/client.ts` fires exactly one `POST /token/refresh/` — do not add refresh logic elsewhere
- Every DRF view must declare `permission_classes` explicitly — no implicit `IsAuthenticated` from defaults
- Guest users can browse; booking steps 3+ require authentication (enforced by `LoginGateDialog` in frontend and `IsAuthenticated` in backend)

## Untrusted Input

- All API input goes through DRF serializers — no raw `request.data` access in views
- Seat labels from WebSocket messages are validated against DB before processing
- Promo codes are validated server-side on every use (`SELECT FOR UPDATE` on `PromoRedemption`) — client-side validation is display-only
- The `returnUrl` on login is validated against an allowlist to prevent open redirect

## Data Integrity

- Seat hold atomicity: Lua compare-and-delete script prevents TOCTOU race — do not replace with plain GET+DEL
- Points redemption: `SELECT FOR UPDATE` on `UserPoint` prevents double-spend
- Soft delete: never call `.delete()` — set `is_deleted = True` to preserve audit trail

## External Actions Requiring Approval

- Any operation that writes to the payment gateway (replay, refund) must be done manually via the admin panel
- Celery Beat tasks (`update_movie_statuses`, `refresh_promotions_is_active`) must not be triggered manually in production outside of incident response

## Dependency Rules

- New Python dependencies: `uv add <package>` — justify in the PR description
- New npm dependencies: `pnpm add <package>` — check for known CVEs before adding
- Security-sensitive changes (auth, payments, seat locks) require explicit verification steps in `feature_list.json` before marking passing
