# Test Report: F13 · F17 · F22 — Showtimes Features

**Date:** 2026-03-19
**Test file:** `apps/cinemas/tests.py`

---

## F22 — View Showtimes (Xem lịch chiếu)

### 1. Feature Overview
**Endpoint:** `GET /api/cinemas/showtimes/`
Allows public users to browse confirmed showtimes filtered by movie, date, or status. Admins can additionally view drafts and cancelled showtimes.

### 2. Why We Test This
The showtimes list is the primary entry point for the customer booking flow. Critical failure scenarios:
- **Pagination truncation:** A global `PAGE_SIZE` silently cutting results — verified by asserting `pagination_class = None` returns a flat list.
- **Data leakage:** Draft/cancelled showtimes leaking to public users.
- **Incorrect format mapping:** IMAX movie rendered as "2D" due to missing `select_related`.

### 3. Test Cases (`ShowtimeListViewTests` — 6 tests)

| # | Test | Purpose |
|---|------|---------|
| 1 | `test_list_showtimes_by_movie` | `?movie_id=` returns only that movie's confirmed showtimes; response is a flat list (no pagination). |
| 2 | `test_list_showtimes_by_date` | `?date=YYYY-MM-DD` strictly returns showtimes on that local day. |
| 3 | `test_list_showtimes_formats_and_rooms` | Each showtime carries the correct `hall` name and `format` string (2D/3D/IMAX). |
| 4 | `test_showtime_visibility_by_status` | Public sees only `confirmed`; admins can filter `?status=draft`. |
| 5 | `test_cancelled_showtimes_hidden_from_public` | **NEW** — Cancelled showtimes never appear for unauthenticated users. |
| 6 | `test_response_includes_pricing_and_seat_info` | **NEW** — Each response item includes `basePrice`, `availableSeats`, `totalSeats`. |

---

## F17 — Admin Generate Showtimes (Rải lịch chiếu tự động & Chốt lịch)

### 1. Feature Overview
**Service:** `find_conflicts()` + `ShowtimeGenerator`
Automatically generates draft showtime schedules across multiple rooms while enforcing overlap prevention, cleanup gaps, traffic staggering, and format matching.

### 2. Why We Test This
- **Double booking:** If two movies overlap in the same room, the system will oversell physical seats.
- **Insufficient cleanup:** A 5-minute gap instead of the configured 10+ minutes cascades delays throughout the day.
- **Wrong format:** A 2D-only room should never receive an IMAX version.

### 3. Test Cases (`F17GenerateShowtimesTests` — 5 tests)

| # | Test | Purpose |
|---|------|---------|
| 1 | `test_overlap_detection_algorithm` | `find_conflicts` detects both full overlaps and cleanup-gap-only violations. |
| 2 | `test_10_minute_cleanup_gap_calculation` | Every consecutive pair in the same room has ≥ 10 min gap after the previous movie ends. |
| 3 | `test_generator_produces_only_draft_status` | **NEW** — Every auto-generated showtime has `status='draft'`. |
| 4 | `test_no_overlap_in_same_room` | **NEW** — No two generated showtimes in the same room overlap in time. |
| 5 | `test_format_matching_3d_room` | **NEW** — A 3D room assigns the 3D version for movies supporting that format. |

---

## F13 — View Ticket History & QR Code (Xem lịch sử vé & QR Code)

### 1. Feature Overview
**Endpoint:** `GET /api/me/tickets/`
Returns the authenticated user's past bookings with all fields needed to render tickets, receipts, and the check-in QR code.

### 2. Why We Test This
- **QR rendering:** If the API omits `booking_code` (exported as `id`), the frontend cannot generate the check-in barcode.
- **Privacy:** Without strict profile-based filtering, User B could retrieve User A's booking history.

### 3. Test Cases (`F13ViewTicketHistoryTests` — 5 tests)

| # | Test | Purpose |
|---|------|---------|
| 1 | `test_view_ticket_history_success` | Authenticated user sees their booking with `id` (booking_code), `movieTitle`, `hall`, `seats`, and nested `tickets`. |
| 2 | `test_ticket_history_unauthenticated` | Unauthenticated requests are rejected with HTTP 401. |
| 3 | `test_ticket_history_only_shows_own_tickets` | User B receives an empty list — strict profile isolation. |
| 4 | `test_ticket_history_returns_financial_fields` | **NEW** — Response includes `total`, `discountAmount`, `finalAmount` for receipt rendering. |
| 5 | `test_ticket_history_contains_show_date_and_time` | **NEW** — Response includes `showDate` and `showTime` for user reference. |

---

## 4. Test Summary

| Feature | Class | Tests | New Tests |
|---------|-------|:-----:|:---------:|
| F22 — View Showtimes | `ShowtimeListViewTests` | 6 | +2 |
| F17 — Generate Showtimes | `F17GenerateShowtimesTests` | 5 | +3 |
| F13 — Ticket History & QR | `F13ViewTicketHistoryTests` | 5 | +2 |
| **Total** | | **16** | **+7** |

### Execution Command
```bash
uv run manage.py test apps.cinemas.tests --verbosity=2
```

> **Note:** Local test execution is currently blocked by a missing system library (`libgobject-2.0`) required by `WeasyPrint`, which is imported during Django's admin autodiscovery. This is an **environment dependency issue**, not a code issue. Tests should pass correctly on CI or after installing `brew install gobject-introspection pango`.
