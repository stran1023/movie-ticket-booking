"""
Unit tests for F13, F17, F22 showtimes features.

F22 — View Showtimes (public API)
F17 — Admin Generate Showtimes (auto-generation + conflict detection)
F13 — View Ticket History & QR Code
"""

from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.movies.models import Movie, Version

from .models import CinemaRoom, GAP_MINUTES_DEFAULT, Showtime
from .services import find_conflicts
from .showtime_generator import (
    GeneratorConfig,
    MovieScheduleConfig,
    ShowtimeGenerator,
)

User = get_user_model()


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  SHARED FIXTURES                                                    ║
# ╚══════════════════════════════════════════════════════════════════════╝


class ShowtimeTestBase(TestCase):
    """Shared fixtures reused by F22 and F13 test classes."""

    def setUp(self):
        self.version_2d = Version.objects.create(name="2D")
        self.version_3d = Version.objects.create(name="3D")
        self.version_imax = Version.objects.create(name="IMAX")

        self.movie_a = Movie.objects.create(
            title="Movie A", duration=120, directors="Dir A", status="NOW_SHOWING"
        )
        self.movie_a.versions.add(self.version_2d, self.version_3d)

        self.movie_b = Movie.objects.create(
            title="Movie B", duration=90, directors="Dir B", status="NOW_SHOWING"
        )
        self.movie_b.versions.add(self.version_2d, self.version_imax)

        self.room_a = CinemaRoom.objects.create(name="Room A", total_seats=100)
        self.room_b = CinemaRoom.objects.create(name="Room B", total_seats=80)
        self.room_a.assigned_movies.set([self.movie_a, self.movie_b])
        self.room_b.assigned_movies.set([self.movie_a])

    def _make_showtime(self, movie, room, start_offset_hours=24, **kwargs):
        defaults = {
            "movie_id": movie.id,
            "cinema_room": room,
            "start_time": timezone.now() + timedelta(hours=start_offset_hours),
            "version_id": self.version_2d,
            "base_price": Decimal("75000"),
            "status": "confirmed",
        }
        defaults.update(kwargs)
        return Showtime.objects.create(**defaults)


class GeneratorTestBase(TestCase):
    """Shared fixtures reused by F17 generator test classes."""

    def setUp(self):
        self.version_2d = Version.objects.create(name="2D")
        self.version_3d = Version.objects.create(name="3D")
        self.version_imax = Version.objects.create(name="IMAX")

        self.movie_a = Movie.objects.create(
            title="Action Movie", duration=120, directors="Dir A", status="NOW_SHOWING"
        )
        self.movie_a.versions.add(self.version_2d, self.version_3d)

        self.movie_b = Movie.objects.create(
            title="Comedy Movie", duration=90, directors="Dir B", status="NOW_SHOWING"
        )
        self.movie_b.versions.add(self.version_2d)

        self.movie_c = Movie.objects.create(
            title="IMAX Movie", duration=150, directors="Dir C", status="NOW_SHOWING"
        )
        self.movie_c.versions.add(self.version_2d, self.version_imax)

        self.room_2d = CinemaRoom.objects.create(
            name="Room 2D", room_type="2D", total_seats=100
        )
        self.room_3d = CinemaRoom.objects.create(
            name="Room 3D", room_type="3D", total_seats=80
        )
        self.room_imax = CinemaRoom.objects.create(
            name="Room IMAX", room_type="IMAX", total_seats=120
        )

        self.room_2d.assigned_movies.set([self.movie_a, self.movie_b])
        self.room_3d.assigned_movies.set([self.movie_a, self.movie_b])
        self.room_imax.assigned_movies.set([self.movie_c])

        self.target_date = date.today() + timedelta(days=1)

    def _make_config(self, **overrides):
        defaults = dict(
            start_date=self.target_date,
            num_days=1,
            traffic_gap_minutes=15,
            cleanup_minutes=15,
            movie_configs=[
                MovieScheduleConfig(
                    movie_id=self.movie_a.id,
                    priority=5,
                    time_slots=["morning", "afternoon", "night"],
                    base_price=Decimal("75000"),
                ),
                MovieScheduleConfig(
                    movie_id=self.movie_b.id,
                    priority=5,
                    time_slots=["morning", "afternoon", "night"],
                    base_price=Decimal("65000"),
                ),
            ],
            room_ids=[self.room_2d.id, self.room_3d.id],
        )
        defaults.update(overrides)
        return GeneratorConfig(**defaults)


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  F22 — VIEW SHOWTIMES (public API)                                 ║
# ╚══════════════════════════════════════════════════════════════════════╝


class ShowtimeListViewTests(ShowtimeTestBase):
    """
    F22: View Showtimes — GET /api/cinemas/showtimes/
    Tests filtering, pagination bypass, format/room mapping, and status visibility.
    """

    def setUp(self):
        super().setUp()
        self.client = APIClient()
        self.url = "/api/cinemas/showtimes/"

        # Tomorrow: Movie A in Room A, format 2D
        self.st_tomorrow = self._make_showtime(
            self.movie_a, self.room_a, start_offset_hours=24,
            version_id=self.version_2d,
        )
        # Day after tomorrow: Movie B in Room B, format IMAX
        self.st_day_after = self._make_showtime(
            self.movie_b, self.room_b, start_offset_hours=48,
            version_id=self.version_imax,
        )
        # 3 days future: Movie A in Room A, format 3D
        self.st_3_days = self._make_showtime(
            self.movie_a, self.room_a, start_offset_hours=72,
            version_id=self.version_3d,
        )
        # Draft showtime (should be hidden from public)
        self.st_draft = self._make_showtime(
            self.movie_a, self.room_a, start_offset_hours=26, status="draft",
        )

    # ── Original tests ────────────────────────────────────────────────

    def test_list_showtimes_by_movie(self):
        """Filtering by movie_id returns only that movie's confirmed showtimes."""
        response = self.client.get(f"{self.url}?movie_id={self.movie_a.id}")
        self.assertEqual(response.status_code, 200)
        data = response.json()

        # st_tomorrow + st_3_days (draft is excluded for public user)
        self.assertEqual(len(data), 2)
        movie_ids = {st["movieId"] for st in data}
        self.assertEqual(movie_ids, {self.movie_a.id})
        # Verify pagination_class=None → raw list, not paginated dict
        self.assertIsInstance(data, list)

    def test_list_showtimes_by_date(self):
        """Filtering by date returns only showtimes on that specific local day."""
        from django.utils.timezone import localtime

        target_date = localtime(self.st_tomorrow.start_time).strftime("%Y-%m-%d")
        response = self.client.get(f"{self.url}?date={target_date}")
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["id"], self.st_tomorrow.id)
        self.assertEqual(data[0]["date"], target_date)

    def test_list_showtimes_formats_and_rooms(self):
        """Each showtime carries the correct hall name and format string."""
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 3)  # 3 confirmed

        by_id = {st["id"]: st for st in data}

        self.assertEqual(by_id[self.st_tomorrow.id]["format"], "2D")
        self.assertEqual(by_id[self.st_day_after.id]["format"], "IMAX")
        self.assertEqual(by_id[self.st_3_days.id]["format"], "3D")

        self.assertEqual(by_id[self.st_tomorrow.id]["hall"], self.room_a.name)
        self.assertEqual(by_id[self.st_day_after.id]["hall"], self.room_b.name)

    def test_showtime_visibility_by_status(self):
        """Public users see only confirmed; admins can filter by draft."""
        # Public: should see 3 confirmed, draft is hidden
        response = self.client.get(self.url)
        data = response.json()
        self.assertEqual(len(data), 3)
        statuses = {st["status"] for st in data}
        self.assertEqual(statuses, {"confirmed"})

        # Admin: should see draft when explicitly filtering
        admin = User.objects.create_superuser("admin", "admin@test.com", "pass")
        self.client.force_authenticate(user=admin)
        response_admin = self.client.get(f"{self.url}?status=draft")
        data_admin = response_admin.json()
        self.assertEqual(len(data_admin), 1)
        self.assertEqual(data_admin[0]["id"], self.st_draft.id)

    # ── NEW tests ─────────────────────────────────────────────────────

    def test_cancelled_showtimes_hidden_from_public(self):
        """Cancelled showtimes must never appear for unauthenticated users."""
        self._make_showtime(
            self.movie_b, self.room_a, start_offset_hours=30, status="cancelled",
        )
        response = self.client.get(self.url)
        data = response.json()
        for st in data:
            self.assertNotEqual(st["status"], "cancelled")

    def test_response_includes_pricing_and_seat_info(self):
        """Each showtime must carry basePrice, availableSeats, and totalSeats."""
        response = self.client.get(self.url)
        data = response.json()
        self.assertGreater(len(data), 0)
        for st in data:
            self.assertIn("basePrice", st)
            self.assertIn("availableSeats", st)
            self.assertIn("totalSeats", st)
            # basePrice should be a valid number string
            self.assertIsNotNone(st["basePrice"])


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  F17 — ADMIN GENERATE SHOWTIMES                                    ║
# ╚══════════════════════════════════════════════════════════════════════╝


class F17GenerateShowtimesTests(GeneratorTestBase):
    """
    F17: Auto-generate showtimes & finalize schedules.
    Tests overlap detection, cleanup gap enforcement, and generation constraints.
    """

    # ── Original tests ────────────────────────────────────────────────

    def test_overlap_detection_algorithm(self):
        """find_conflicts detects both full overlaps and cleanup-gap violations."""
        start_time = timezone.now().replace(hour=10, minute=0, second=0, microsecond=0)
        if start_time < timezone.now():
            start_time += timedelta(days=1)

        Showtime.objects.create(
            movie_id=self.movie_a.id,  # 120 min
            cinema_room=self.room_2d,
            start_time=start_time,
            version_id=self.version_2d,
            base_price=Decimal("75000"),
            status="confirmed",
        )

        # Test 1: Complete overlap — starts 60 min into existing 120-min movie
        conflicts = find_conflicts(
            room=self.room_2d,
            start_time=start_time + timedelta(minutes=60),
            duration_minutes=self.movie_b.duration,
            gap_minutes=10,
        )
        self.assertGreater(len(conflicts), 0)
        self.assertTrue(any("Overlaps" in c for c in conflicts))

        # Test 2: Gap violation — starts exactly when movie A ends (no cleanup gap)
        conflicts_edge = find_conflicts(
            room=self.room_2d,
            start_time=start_time + timedelta(minutes=120),
            duration_minutes=self.movie_b.duration,
            gap_minutes=10,
        )
        self.assertGreater(len(conflicts_edge), 0)
        self.assertTrue(any("min after" in c.lower() for c in conflicts_edge))

    def test_10_minute_cleanup_gap_calculation(self):
        """Auto-generated showtimes maintain ≥10 min gap between consecutive movies in the same room."""
        config = self._make_config(cleanup_minutes=10)
        gen = ShowtimeGenerator(config)
        drafts = gen.generate()
        Showtime.objects.bulk_create(drafts)

        room_sts = sorted(
            [d for d in drafts if d.cinema_room_id == self.room_2d.id],
            key=lambda s: s.start_time,
        )
        self.assertGreater(len(room_sts), 1, "Need ≥2 showtimes to verify gap")

        for i in range(1, len(room_sts)):
            prev_movie = Movie.objects.get(pk=room_sts[i - 1].movie_id)
            prev_end = room_sts[i - 1].start_time + timedelta(minutes=prev_movie.duration)
            gap_seconds = (room_sts[i].start_time - prev_end).total_seconds()
            self.assertGreaterEqual(
                gap_seconds, 600,
                f"Cleanup gap violated: {prev_end} → {room_sts[i].start_time} "
                f"(gap={gap_seconds / 60:.1f} min)",
            )

    # ── NEW tests ─────────────────────────────────────────────────────

    def test_generator_produces_only_draft_status(self):
        """Every auto-generated showtime must have status='draft'."""
        config = self._make_config()
        gen = ShowtimeGenerator(config)
        drafts = gen.generate()
        self.assertGreater(len(drafts), 0)
        for st in drafts:
            self.assertEqual(
                st.status, "draft",
                f"Expected draft, got '{st.status}' for showtime at {st.start_time}",
            )

    def test_no_overlap_in_same_room(self):
        """No two generated showtimes in the same room may overlap in time."""
        config = self._make_config()
        gen = ShowtimeGenerator(config)
        drafts = gen.generate()

        for room_id in [self.room_2d.id, self.room_3d.id]:
            room_sts = sorted(
                [d for d in drafts if d.cinema_room_id == room_id],
                key=lambda s: s.start_time,
            )
            for i in range(1, len(room_sts)):
                prev_movie = Movie.objects.get(pk=room_sts[i - 1].movie_id)
                prev_end = room_sts[i - 1].start_time + timedelta(minutes=prev_movie.duration)
                self.assertLessEqual(
                    prev_end, room_sts[i].start_time,
                    f"Overlap in room {room_id}: prev ends {prev_end}, "
                    f"curr starts {room_sts[i].start_time}",
                )

    def test_format_matching_3d_room(self):
        """A 3D room should assign the 3D version for movies that support it."""
        config = self._make_config(
            room_ids=[self.room_3d.id],
            movie_configs=[
                MovieScheduleConfig(
                    movie_id=self.movie_a.id,
                    priority=5,
                    time_slots=["morning"],
                    base_price=Decimal("85000"),
                ),
            ],
        )
        gen = ShowtimeGenerator(config)
        drafts = gen.generate()
        self.assertGreater(len(drafts), 0)
        for st in drafts:
            self.assertEqual(st.version_id.name, "3D")


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  F13 — VIEW TICKET HISTORY & QR CODE                               ║
# ╚══════════════════════════════════════════════════════════════════════╝


class F13ViewTicketHistoryTests(ShowtimeTestBase):
    """
    F13: View ticket history & QR Code — GET /api/me/tickets/
    Tests payload completeness, auth gating, and cross-user isolation.
    """

    def setUp(self):
        super().setUp()
        from apps.bookings.models import Booking, Ticket
        from apps.users.models import UserProfile

        self.client = APIClient()
        self.url = "/api/me/tickets/"

        # User A (with booking)
        self.user_a = User.objects.create_user(
            username="usera", email="a@test.com", password="pwd"
        )
        self.profile_a = UserProfile.objects.create(
            user=self.user_a,
            full_name="User A",
            identity_card="123456789A",
            phone_number="0901234567",
        )

        # User B (no bookings)
        self.user_b = User.objects.create_user(
            username="userb", email="b@test.com", password="pwd"
        )
        self.profile_b = UserProfile.objects.create(
            user=self.user_b,
            full_name="User B",
            identity_card="987654321B",
            phone_number="0909876543",
        )

        # Showtime + booking for user A
        self.showtime = self._make_showtime(
            self.movie_a, self.room_a, start_offset_hours=24
        )
        self.booking_a = Booking.objects.create(
            booking_code="BK-USER-A-123",
            user_profile_id=self.profile_a,
            customer_name="User A",
            total_amount=Decimal("150000"),
            final_amount=Decimal("150000"),
            status="confirmed",
            payment_method="vnpay",
        )
        Ticket.objects.create(
            booking=self.booking_a,
            showtime=self.showtime,
            seat_label="A1",
            price=Decimal("75000"),
            seat_type_snapshot="normal",
            ticket_status_snapshot="active",
        )
        Ticket.objects.create(
            booking=self.booking_a,
            showtime=self.showtime,
            seat_label="A2",
            price=Decimal("75000"),
            seat_type_snapshot="normal",
            ticket_status_snapshot="active",
        )

    # ── Original tests ────────────────────────────────────────────────

    def test_view_ticket_history_success(self):
        """Authenticated user sees their booking with all fields needed for QR rendering."""
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertEqual(len(data), 1)
        booking = data[0]

        # Key fields for QR code rendering
        self.assertEqual(booking["id"], "BK-USER-A-123")
        self.assertEqual(booking["movieTitle"], self.movie_a.title)
        self.assertEqual(booking["hall"], self.room_a.name)
        self.assertIn("A1", booking["seats"])
        self.assertIn("A2", booking["seats"])
        self.assertEqual(len(booking["tickets"]), 2)
        self.assertEqual(booking["tickets"][0]["seatLabel"], "A1")

    def test_ticket_history_unauthenticated(self):
        """Unauthenticated requests are rejected with 401."""
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 401)

    def test_ticket_history_only_shows_own_tickets(self):
        """User B cannot see user A's bookings — strict profile isolation."""
        self.client.force_authenticate(user=self.user_b)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 0)

    # ── NEW tests ─────────────────────────────────────────────────────

    def test_ticket_history_returns_financial_fields(self):
        """Response must include total, discountAmount, finalAmount for receipt rendering."""
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get(self.url)
        data = response.json()
        booking = data[0]

        self.assertIn("total", booking)
        self.assertIn("discountAmount", booking)
        self.assertIn("finalAmount", booking)
        # Values should match what was created
        self.assertEqual(Decimal(booking["finalAmount"]), Decimal("150000"))

    def test_ticket_history_contains_show_date_and_time(self):
        """Response must include showDate and showTime for the user's ticket reference."""
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get(self.url)
        data = response.json()
        booking = data[0]

        self.assertIn("showDate", booking)
        self.assertIn("showTime", booking)
        # showDate should be a valid date string
        self.assertIsNotNone(booking["showDate"])
        self.assertIsNotNone(booking["showTime"])
