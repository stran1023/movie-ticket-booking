# CineBook Frontend — CLAUDE.md

## Commands
```bash
pnpm dev          # Dev server (http://localhost:3000)
pnpm build        # Production build
pnpm lint         # ESLint
```

Environment: create `.env.local` with:
```
NEXT_PUBLIC_API_BASE=http://localhost:8000
NEXT_PUBLIC_API_URL=http://localhost:8000
```
The committed `.env` contains the same localhost defaults — `.env.local` overrides it.

## Page routing (App Router)
```
app/
  page.tsx                    # Home (hero, now showing, upcoming, promotions)
  movies/page.tsx             # Movie listing — SWR + filters + search (debounced 500ms)
  movies/[id]/page.tsx        # Movie detail — server component, React cache()
  booking/page.tsx            # 7-step booking wizard (main orchestrator)
  account/
    info/page.tsx             # User profile
    tickets/page.tsx          # Booked tickets
    points/page.tsx           # Points balance + history
    reminders/page.tsx        # Movie release reminders
  login/page.tsx              # Formik form, safe returnUrl handling
  register/page.tsx           # Address picker + multi-field form
  promotions/page.tsx         # Promotion listing
  promotions/[id]/page.tsx    # Promotion detail
```

## Booking wizard — 7 steps (components/booking/)
| Step | Component | Key behaviour |
|------|-----------|--------------|
| 1 | `step-movie.tsx` | Paginated movie grid, saves `selectedMovieId` to Redux |
| 2 | `step-showtime.tsx` | Date chips + time slots; shows `LoginGateDialog` for guests |
| 3 | `step-seats.tsx` | Interactive seat grid; WebSocket live updates; seat hold begins; countdown timer |
| 4 | `step-concession.tsx` | Categorized items + combo expansion; server price preview |
| 5 | `step-confirm.tsx` | Flat-price promos + promo code + points redemption (mutually exclusive); payment method |
| 6 | `step-payment.tsx` | Opens gateway in new tab; polls `/bookings/payment-status/{txnRef}` every 3 s |
| 7 | `step-receipt.tsx` | QR code + barcode; download PNG via html-to-image; reset booking |

Navigation is managed by `BookingNavContext` (`booking-nav-context.tsx`) — use `requestStep(n)` to advance; never set `currentStep` in Redux directly from step components.

Abandoning at step ≥ 3 with an active hold triggers `ConfirmLeaveModal` → releases seats before resetting.

## Redux store (lib/store/)
```
store.ts          — configureStore with redux-persist
slices/
  authSlice.ts    — role, profile (MemberProfile), accessToken  [persisted 7 days]
  bookingSlice.ts — full booking wizard state                   [persisted with hold expiry]
  cartSlice.ts    — items, discount (currently unused)          [not persisted]
```

**bookingSlice persisted fields:** `selectedMovieId`, `selectedDate`, `selectedShowtimeId`, `selectedSeats`, `holdExpiresAt`, `currentStep`, `selectedConcessions`.
`holdExpiresAt` is checked on rehydration — if past, the hold state is cleared automatically.

Promotion and points state (`appliedPromotion`, `appliedPromoCode`, `usePoints`, `pointsToRedeem`) is **not** persisted — it resets on page reload.

Import hooks from `lib/store/hooks.ts` (`useAppDispatch`, `useAppSelector`), never from `react-redux` directly.

## API client (lib/api/)
```
client.ts         — Axios instance; attaches Bearer token; 401 refresh queue; auto-logout on refresh failure
movies.ts         — getMovies(), getMovieById() (server-side with React cache())
auth.ts           — verifyEmail(), forgotPassword(), resetPassword()
cinemas.ts        — fetchShowtimes(), fetchSeats(), holdSeats(), releaseSeats(), confirmBooking(), getPaymentStatus()
concessions.ts    — fetchConcessions(), fetchComboConcessions(), previewConcessionPrice()
promotions.ts     — validatePromotion(), validateFlatPricePromotion(), redeemPromotion(), getCommunityPromoTickets()
points.ts         — getBalance(), calculate(), redeem(), getHistory()
account.ts        — getProfile(), updateProfile(), uploadAvatar(), deleteAccount()
```

Custom error classes in `cinemas.ts`:
- `SeatConflictError` — thrown on 409 (seat already held by another user)
- `SessionExpiredError` — thrown on 408 (15-min session hard cap exceeded)
Always catch these specifically in seat-related flows.

**401 refresh queue**: the interceptor in `client.ts` queues all requests that get a 401 and fires a single `/token/refresh/`. Do not add token refresh logic anywhere else.

## WebSocket (components/booking/step-seats.tsx)
- Connects to `ws://127.0.0.1:8000/ws/showtime/{showtimeId}/`
- Message shape: `{ action: "hold" | "release" | "book", seats: string[] }`
- Reconnects with exponential backoff: 500 ms initial, 15 s max, 300 ms jitter
- Updates seat status in component-local state, not Redux

## Seat validation (lib/seat-validation.ts)
`canToggleSeat(seatLabel, currentlySelected, allSeats)` — prevents selecting a seat that would leave a single isolated empty seat between two occupied/held seats. Call this before dispatching `toggleSeat`.

## Promotions + points mutual exclusion (step-confirm.tsx)
- Enabling points → clears `appliedPromotion`, `appliedPromoCode`, `appliedDiscount`
- Applying a flat-price promo or promo code → dispatches `clearPoints()`
- This is enforced in UI only; the backend validates independently

## Key conventions
- **Client vs server components**: default to server components; add `"use client"` only when the component uses hooks, browser APIs, or event handlers
- **Data fetching**: server components use `fetch` or the `movies.ts` server functions; client components use `SWR` (listing pages) or `axios` via the API modules
- **Forms**: use React Hook Form + Zod for new forms; existing Formik forms (login, register) stay as-is
- **Toast notifications**: always use `sonner` (`import { toast } from "sonner"`) — do not use the legacy `use-toast` hook for new code
- **Loading states**: use the `<Spinner />` component from `components/ui/spinner.tsx`
- **Empty states**: use `<Empty />` from `components/ui/empty.tsx`
- **TypeScript**: `next.config.mjs` currently ignores build errors (`ignoreBuildErrors: true`) — do not introduce new type errors even though they won't fail the build
- **Images**: use `next/image`; the API server at `http://127.0.0.1:8000` is whitelisted in `next.config.mjs`
- **Styling**: Tailwind utility classes only — no inline styles, no CSS modules
- **Shadcn components**: already installed in `components/ui/` — do not re-install or duplicate them

## Auth flow
1. `POST /api/login/` → access token saved to `authSlice`
2. Axios interceptor attaches `Authorization: Bearer <token>` to every request
3. On 401 → silent refresh via `POST /api/token/refresh/` (httpOnly cookie)
4. On refresh failure → `dispatch(logout())` + redirect to `/login`
5. Access token persisted 7 days in localStorage via redux-persist

Guests can browse movies. Step 2 → step 3 shows `LoginGateDialog`. Step 3+ redirects unauthenticated users back to the login gate.
