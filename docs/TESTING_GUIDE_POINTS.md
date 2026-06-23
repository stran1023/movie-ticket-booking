# Points Discount System — Testing Guide

## Prerequisites

1. Run migrations:
   ```bash
   cd backend
   python manage.py makemigrations users
   python manage.py migrate
   ```
2. Create a `PointRedemptionConfig` row via Django Admin:
   - Navigate to `/admin/` → "Point Redemption Config" → Add
   - Default values: `max_redeem_percentage=50`, `min_points_to_redeem=4`, `points_per_vnd=500`, `is_active=True`
3. Start backend and frontend servers

---

## 1. Backend (Manual / API)

### 1a. Confirm a booking and verify points are awarded (floor logic)

1. Create a booking via the normal flow (select seats, confirm, pay via VNPay sandbox)
2. After payment succeeds, check:
   ```
   GET /api/points/balance/
   ```
   - If `final_amount = 182,000` → `points_earned = floor(182000/1000) = 182`
   - Verify `balance` increased by 182

3. Check transaction log:
   ```
   GET /api/points/history/
   ```
   - Should have an `earn` entry with `points = 182`, `note = "Earned from booking #BK-XXXXX"`

### 1b. Test `calculate` endpoint

```
GET /api/points/calculate/?subtotal=200000&amount_already_discounted=0
```
- With user having 200 pts and 50% cap:
  - `max_vnd_by_policy = ceil(200000 * 50 / 100) = 100,000`
  - `max_points_by_policy = ceil(100000 / 500) = 200`
  - `redeemable_points = min(200, user_balance)` → capped at user's balance

```
GET /api/points/calculate/?subtotal=200000&amount_already_discounted=50000
```
- `discountable_base = 150,000`
- `max_vnd_by_policy = ceil(150000 * 50 / 100) = 75,000`
- `max_points_by_policy = ceil(75000 / 500) = 150`

### 1c. Verify the 50% cap

- User has 200 pts, subtotal = 200,000
- `redeemable_points` should be capped at 200 (= ceil(100000/500))
- `max_discount_vnd = 200 * 500 = 100,000` (exactly 50%)

### 1d. Verify minimum threshold

- User has 3 pts (below min of 4):
  ```
  GET /api/points/calculate/?subtotal=200000
  ```
  - `is_redemption_available = false`
  - `redeemable_points = 0`

- User has exactly 4 pts:
  - `is_redemption_available = true`
  - `redeemable_points = 4`

### 1e. Test redeem endpoint

**Valid redemption:**
```
POST /api/points/redeem/
{
  "booking_id": 1,
  "points_to_redeem": 38,
  "subtotal": 200000,
  "amount_already_discounted": 0
}
```
- Should return updated `balance` and `discount_applied = 38 * 500 = 19,000`

**Over-redemption attempt:**
```
POST /api/points/redeem/
{
  "booking_id": 1,
  "points_to_redeem": 999,
  "subtotal": 200000,
  "amount_already_discounted": 0
}
```
- Should return 400 with error message

**Insufficient balance:**
- Set user balance to 5 via admin, then try to redeem 50 → should fail

### 1f. Config changes

- Change `max_redeem_percentage` to 30% in admin
- Re-run calculate endpoint:
  ```
  GET /api/points/calculate/?subtotal=200000
  ```
  - `max_vnd_by_policy = ceil(200000 * 30 / 100) = 60,000`
  - `max_points_by_policy = ceil(60000 / 500) = 120`

### 1g. Idempotency test

- Call `award_points_for_booking(booking)` twice for the same booking
- Points should only be awarded once (second call returns `None`)

---

## 2. Frontend (Manual)

### 2a. Point balance and redeemable amount

1. Log in and navigate to the booking confirmation step
2. The "Use Points" section should show:
   - Current balance (e.g., "120 pts (60,000 d)")
   - Toggle switch

### 2b. Slider interaction

1. Enable the "Use Points" toggle
2. Slider should appear with bounds `[min_points, redeemable_points]`
3. Move the slider and confirm the discount updates live:
   - "Redeeming: 38 pts → -19,000 d"
4. The "Continue to Payment" button amount should update in real-time

### 2c. Flat price promo first, then points

1. Select a flat price promotion (e.g., saves 135,000 d)
2. Enable points → the flat price promo should be cleared
3. The points cap should recalculate against the full subtotal

### 2d. Promo code, then points

1. Apply a promo code (e.g., SUMMER20 saves 20,000 d)
2. Enable points → the promo code should be cleared
3. Points cap recalculates

### 2e. Seats change

1. Go back to seat selection, change seats
2. Return to confirmation → all discount sections should recalculate

### 2f. Full discount breakdown

Verify the order summary shows:
```
Subtotal:                     375,000 d
Points Redeemed (38 pts):     -19,000 d
────────────────────────────────────────
Final Total:                  356,000 d
Points you will earn:         +356 pts
```

### 2g. Account pages

1. Visit `/account/points` → verify balance, total earned, total redeemed
2. Filter by "all", "added", "used" → correct results
3. Visit `/account/tickets` → click a booking → verify discount and points info shown

---

## 3. Admin

### 3a. PointRedemptionConfig — single row

1. Go to Admin → "Point Redemption Config"
2. If a config row exists, the "Add" button should be **hidden**
3. Cannot delete the config row
4. Edit `max_redeem_percentage` → verify `updated_by` auto-populates with admin user

### 3b. Manual balance adjustment

1. Go to Admin → "User Points"
2. Change a user's `balance` (e.g., from 100 to 150)
3. Save → check "Point Transactions":
   - An `adjust` entry should appear with `points = +50`, `note = "Admin adjustment by ..."`

### 3c. PointTransaction read-only

1. Go to Admin → "Point Transactions"
2. Verify the "Add" button is **not available**
3. Click any transaction → all fields should be **read-only**

### 3d. Reset balance to zero

1. Go to Admin → "User Points"
2. Select a user with balance > 0
3. Use action "Reset balance to zero"
4. Verify balance = 0 and an `adjust` transaction with negative points is logged

---

## 4. Edge Cases

### 4a. `floor()` for earning

- Booking amount = 60,129 VND
- `points_earned = floor(60129 / 1000) = 60` (NOT 61)

### 4b. `ceil()` on policy cap

- 50% of 75,129 = 37,564.5
- `max_vnd_by_policy = ceil(37564.5) = 37,565`
- `max_points_by_policy = ceil(37565 / 500) = ceil(75.13) = 76` points

### 4c. Minimum threshold boundary

- User has exactly `min_points` (4 pts) → `is_redemption_available = true`
- User has `min_points - 1` (3 pts) → `is_redemption_available = false`

### 4d. All three discounts — mutual exclusion

- When using points, flat price and promo code sections are disabled/cleared
- The "points you will earn" preview at the bottom shows floor(final_total / 1000)

### 4e. Config `is_active = False`

1. Set `is_active = False` in admin
2. Frontend: the points section should show "Point redemption is currently unavailable."
3. Backend: `GET /api/points/calculate/` returns `is_redemption_available = false`
4. `POST /api/points/redeem/` should return 400

### 4f. Zero-balance user

- User with 0 points:
  - Points section visible but greyed out
  - Message: "You need at least 4 points to redeem (you have 0 pts)."
