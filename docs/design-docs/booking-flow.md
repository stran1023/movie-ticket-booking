# Booking Flow

**Status**: Settled — 7-step wizard, Redux state, WebSocket seat availability.

## Steps

| # | Step | Backend call | State written |
|---|------|-------------|---------------|
| 1 | Movie selection | `GET /api/movies/` | `selectedMovieId` |
| 2 | Showtime selection | `GET /api/movies/{id}/showtimes/` | `selectedDate`, `selectedShowtimeId` |
| 3 | Seat selection | `POST /api/bookings/hold/` (+ WebSocket) | `selectedSeats`, `holdExpiresAt` |
| 4 | Concessions | `POST /api/concessions/preview/` | `selectedConcessions` |
| 5 | Confirm (promo/points) | `POST /api/promotions/validate/` or `POST /api/points/calculate/` | `appliedPromotion`, `pointsToRedeem` |
| 6 | Payment | `POST /api/bookings/confirm/` → gateway redirect | polls `/bookings/payment-status/{txnRef}` every 3 s |
| 7 | Receipt | — | resets `bookingSlice` |

## State Persistence

`bookingSlice` is persisted in localStorage (redux-persist). On rehydration:
- If `holdExpiresAt` is in the past, the hold state is cleared and the user restarts from step 3
- Promotion and points state (`appliedPromotion`, `appliedPromoCode`, `usePoints`, `pointsToRedeem`) is **not** persisted — intentional, so stale promo states cannot survive a reload

## Navigation

All step transitions go through `requestStep(n)` from `BookingNavContext`. Step components must not write `currentStep` to Redux directly.

Abandoning at step ≥ 3 with an active hold triggers `ConfirmLeaveModal`. On confirm: `releaseSeats()` is called, then the slice is reset.

## Payment Flow

1. `POST /api/bookings/confirm/` — creates `Payment` record, returns gateway URL
2. Frontend opens gateway URL in a new tab
3. Frontend polls `GET /api/bookings/payment-status/{txnRef}` every 3 s
4. Gateway calls back to `/api/bookings/vnpay-return/` (GET) or `/api/bookings/momo-ipn/` (POST)
5. Callback: verify HMAC → update `Payment` → update `Booking` to CONFIRMED → issue `Ticket` rows → call `award_points()` → `broadcast_seat_update("book", seats)`

## Points Award Rule

`award_points()` is called only when `points_used == 0 AND discount_amount == 0`. It is idempotent — it checks for an existing EARN transaction before creating one.

## What Must Not Change Without a New Design Doc

- The 7-step order (steps 3-5 depend on hold being active)
- The single-tab polling pattern for payment status
- The `ConfirmLeaveModal` → `releaseSeats()` path on wizard abandonment
- `award_points()` eligibility logic
