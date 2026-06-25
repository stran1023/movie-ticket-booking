# Points and Promotions

**Status**: Settled — mutually exclusive, backend-authoritative, UI mirrors the rule.

## Promotion Types

| Type | Model | Scope | Active flag |
|------|-------|-------|-------------|
| `MoviePromotion` | `apps/promotions/` | Per-movie promo code | Always active while valid |
| `UserPromotion` | `apps/promotions/` | User-specific code | Always active while valid |
| `FlatPricePromotion` | `apps/promotions/` | Flat seat price override | `is_active` managed by nightly Beat task |
| Loyalty points | `apps/users/` | Earned from full-price bookings | User balance |

## Mutual Exclusion Rule

Points and promotions **cannot be used in the same booking**. This is a product rule, not a technical constraint.

- **Frontend** (`step-confirm.tsx`): enabling points clears `appliedPromotion`/`appliedPromoCode`; applying a promo dispatches `clearPoints()`
- **Backend** (`bookings/services.py`): validates `points_used == 0 OR discount_amount == 0` before confirming; returns 400 if both are non-zero

Both layers must enforce this. The backend is authoritative; the frontend is a convenience guard.

## Points Earn

`award_points(booking)` is called in the payment callback after CONFIRMED status is set.

Earn condition: `booking.points_used == 0 AND booking.discount_amount == 0`

The function is idempotent — it checks for an existing `PointTransaction(type=EARN, booking=booking)` before creating one.

## Points Redeem

`redeem_points(user, points_amount, booking)` uses `SELECT FOR UPDATE` on `UserPoint` to prevent concurrent double-redemption.

Max redeemable amount is capped by `PointRedemptionConfig` (singleton admin row). Access via `PointRedemptionConfig.get_config()` — never create or delete this row.

## Promo Code Caching

`MoviePromotion` validation results are cached 30 min in Redis (`cinema:promo:cache:{CODE}`). The cache is invalidated when the promo is updated via admin.

`PromoRedemption` enforces one-time use per user via `unique_together(user, promo_code)` with `SELECT FOR UPDATE`.

## Community Codes

A Redis sorted set tracks successful community code validations — used to surface popular codes in the promotions listing. Updated on every successful `validatePromotion()` call.

## FlatPricePromotion Lifecycle

`is_active` is set by `refresh_promotions_is_active` Celery task (nightly Beat). **Never set it in application code.** The task checks `valid_from` / `valid_until` dates and the seat count threshold.

## What Must Not Change Without a New Design Doc

- The mutual exclusion rule (points XOR promotions)
- `award_points()` eligibility criteria
- `PointRedemptionConfig` singleton pattern
- `FlatPricePromotion.is_active` being Beat-managed only
