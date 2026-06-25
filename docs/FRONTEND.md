# CineBook — Frontend

## Principles

- Default to server components; add `"use client"` only when hooks, browser APIs, or event handlers are needed
- Booking wizard state lives in Redux (`bookingSlice`) — step components read and dispatch, never set `currentStep` directly
- Navigation between wizard steps goes through `requestStep(n)` from `BookingNavContext` only
- Seat availability is real-time (WebSocket) — never derive it from Redux or stale SWR cache

## Component and Data Fetching Patterns

| Context | Pattern |
|---------|---------|
| Movie listing / account pages | `SWR` in client components |
| Movie detail page | `fetch` + `React cache()` in server component |
| Booking wizard steps | Axios via `lib/api/` modules + Redux |
| Forms | React Hook Form + Zod for new forms; existing Formik forms stay as-is |

Never call `fetch` or `axios` directly from components — use the `lib/api/` modules.

## Redux Store

| Slice | Persisted | Resets on |
|-------|-----------|-----------|
| `authSlice` | 7 days (localStorage) | Logout / refresh failure |
| `bookingSlice` | Until `holdExpiresAt` | Hold expiry on rehydration, step 7 completion, leave-confirm modal |
| `cartSlice` | No | Page reload |

Promotion and points state (`appliedPromotion`, `appliedPromoCode`, `usePoints`, `pointsToRedeem`) is not persisted — it resets on page reload by design.

Import `useAppDispatch` and `useAppSelector` from `lib/store/hooks.ts`, never from `react-redux` directly.

## Booking Wizard (components/booking/)

7 steps — all state in `bookingSlice`:

| Step | Component | State written |
|------|-----------|--------------|
| 1 | `step-movie.tsx` | `selectedMovieId` |
| 2 | `step-showtime.tsx` | `selectedDate`, `selectedShowtimeId` |
| 3 | `step-seats.tsx` | `selectedSeats`, `holdExpiresAt` |
| 4 | `step-concession.tsx` | `selectedConcessions` |
| 5 | `step-confirm.tsx` | `appliedPromotion`, `usePoints`, `pointsToRedeem` |
| 6 | `step-payment.tsx` | polls `/bookings/payment-status/{txnRef}` every 3 s |
| 7 | `step-receipt.tsx` | resets slice |

Abandoning at step ≥ 3 with an active hold shows `ConfirmLeaveModal` which calls `releaseSeats()` before resetting.

## WebSocket (step-seats.tsx)

- Connects to `ws://127.0.0.1:8000/ws/showtime/{showtimeId}/`
- Message: `{ action: "hold" | "release" | "book", seats: string[] }`
- Reconnects with exponential backoff: 500 ms → 15 s max, 300 ms jitter
- Updates component-local seat state only — does not write to Redux

## API Client (lib/api/client.ts)

- Attaches `Authorization: Bearer <token>` to every request
- On 401: queues all in-flight requests and fires a single `POST /token/refresh/`
- On refresh failure: dispatches `logout()` and redirects to `/login`
- Do not add token refresh logic anywhere else

Custom errors in `cinemas.ts`:
- `SeatConflictError` (409) — seat held by another user
- `SessionExpiredError` (408) — 15-min session cap exceeded

Always catch these specifically in seat-related flows.

## Key Guardrails

- `"use client"` only when required — do not convert server components unnecessarily
- `ignoreBuildErrors: true` is set in `next.config.mjs` — type errors will not fail the build, but do not introduce new ones
- Tailwind utility classes only — no inline styles, no CSS modules
- Toast notifications: `sonner` only (`import { toast } from "sonner"`) — do not use the legacy `use-toast` hook
- Images: `next/image` only; `http://127.0.0.1:8000` is whitelisted in `next.config.mjs`
- Shadcn components are in `components/ui/` — do not re-install or duplicate them

## Verification

```bash
cd frontend && pnpm run type-check   # TypeScript — must pass before any PR
cd frontend && pnpm run build        # Production build — must exit 0
cd frontend && pnpm lint             # ESLint
```

Critical user journeys to walk through in-browser before marking a frontend feature passing:
1. Full booking flow: movie → showtime → seats → concessions → confirm → payment redirect
2. Seat conflict: two tabs hold the same seat; second should show error
3. Hold expiry: countdown reaches zero; user is prompted to restart
4. Guest gate: unauthenticated user reaches step 3; `LoginGateDialog` appears
