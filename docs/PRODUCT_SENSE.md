# CineBook — Product Sense

This file captures product judgment that cannot be inferred reliably from code alone.

## Product Core

- **Primary user**: Vietnamese moviegoers booking tickets online (mobile and desktop)
- **Job to be done**: Reserve specific seats for a specific showtime and pay — quickly, without losing the seats mid-flow
- **Main frustration to remove**: Seat conflicts mid-checkout; payment success with no ticket confirmation; unclear promo/points eligibility
- **Quality bar for acceptance**: The full booking flow (browse → seat hold → pay → QR ticket) completes without errors on a clean session; payment callbacks correctly confirm or fail the booking

## Business Constraints That Shape Design

- All prices in Vietnamese Dong (VND) — integers, no decimals, no rounding
- Seat holds are non-refreshable (15-min session hard cap) to prevent seat squatting
- Points and promotions are mutually exclusive — mixing them is never valid, even if the math would work
- `FlatPricePromotion.is_active` is managed by a nightly Celery job — UI and API must not override it in real-time

## Product Rules

- Favor booking-flow reliability over feature count — a broken checkout is worse than a missing feature
- Treat ambiguous behavior (e.g., "what if the hold expires mid-payment?") as a spec gap, not permission to guess
- If implementation changes what users see at the confirm step, update `design-docs/booking-flow.md`
- Seat availability shown to the user must match the Redis source of truth — never derive availability from DB alone

## No-Go Patterns

- Silent seat loss (user thinks they have seats but the hold expired without notice)
- Payment confirmed but booking status not updated (callback silent failure)
- Points awarded on discounted bookings
- Two active promotions applied to the same booking
- Showtimes created or edited within 60 minutes of start time
