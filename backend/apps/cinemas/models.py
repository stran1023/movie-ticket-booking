from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

GAP_MINUTES_DEFAULT = 10
LOCKOUT_MINUTES = 60
SEAT_HOLD_MINUTES = 5

SEAT_TYPE_CHOICES = ("normal", "vip", "couple")
SEAT_STATUS_CHOICES = ("available", "broken", "maintenance")


class RoomType(models.TextChoices):
    TWO_D = "2D", "2D"
    THREE_D = "3D", "3D"
    IMAX = "IMAX", "IMAX"


class CinemaRoom(models.Model):
    name = models.CharField(max_length=255)

    room_type = models.CharField(
        max_length=10,
        choices=RoomType.choices,
        default=RoomType.TWO_D,
    )

    total_seats = models.PositiveIntegerField(editable=False)

    seat_map = models.JSONField(
        default=list,
        blank=True,
        help_text=(
            "Seat layout data. Use the visual editor in admin to modify. "
            "Each seat has: x, y, kind, type, row, number, endNumber (for couple seats). "
            "Couple seats occupy two positions but are stored as one entry."
        ),
    )

    assigned_movies = models.ManyToManyField(
        "movies.Movie",
        related_name="assigned_rooms",
        blank=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    is_deleted = models.BooleanField(default=False)

    class Meta:
        db_table = "cinema_room"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.room_type})"

    def clean(self):
        seat_map = self.seat_map or []

        if not isinstance(seat_map, list):
            raise ValidationError("seat_map must be a list")
        # Calculate total seats from seat map
        seat_count = len(seat_map)
        if seat_count > 200:
            raise ValidationError("Cinema room cannot exceed 200 seats")

        # Validate row consistency (can't mix couple with normal/vip in same row)
        rows = {}  # row -> set[str] of seat types in that row

        for seat in seat_map or []:
            row = seat.get("row")
            seat_type = seat.get("type")

            if row is None or seat_type is None:
                # If you want strict validation, raise instead of continue:
                # raise ValidationError("Each seat must include 'row' and 'type'")
                continue

            # Normalize for consistency
            row = str(row)
            seat_type = str(seat_type).strip().lower()

            rows.setdefault(row, set()).add(seat_type)

        # Rule: 'couple' cannot be mixed with any other type in the same row
        offending = []
        for row, types in rows.items():
            if "couple" in types and len(types) > 1:
                offending.append((row, sorted(types)))

        if offending:
            details = "; ".join(
                [f"Row {r} has types: {', '.join(ts)}" for r, ts in offending]
            )
            raise ValidationError(
                "Rows containing 'couple' seats cannot mix with other types. " + details
            )

        # Update total_seats automatically
        self.total_seats = seat_count

    @property
    def bookable_seat_count(self) -> int:
        """Count available seats (not implemented - placeholder)"""
        return self.total_seats


class Showtime(models.Model):
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("confirmed", "Confirmed"),
        ("cancelled", "Cancelled"),
    ]

    movie_id = models.IntegerField()
    cinema_room = models.ForeignKey(
        CinemaRoom,
        on_delete=models.PROTECT,
        related_name="showtimes",
    )
    start_time = models.DateTimeField()
    version_id = models.ForeignKey(
        "movies.Version",
        on_delete=models.PROTECT,
        related_name="showtime",
    )
    base_price = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="draft",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False)

    class Meta:
        db_table = "showtime"
        ordering = ["start_time"]

    def __str__(self):
        return (
            f"Showtime {self.id} - Room {self.cinema_room} "
            f"@ {self.start_time:%Y-%m-%d %H:%M}"
        )

    # ── Derived fields ────────────────────────────────────────────────

    @property
    def movie(self):
        from apps.movies.models import Movie

        if not hasattr(self, "_movie_cache"):
            self._movie_cache = Movie.objects.filter(
                pk=self.movie_id, is_deleted=False
            ).first()
        return self._movie_cache

    @property
    def duration_minutes(self) -> int:
        m = self.movie
        return m.duration if m else 0

    @property
    def end_time(self):
        return self.start_time + timedelta(minutes=self.duration_minutes)

    # ── Validation ────────────────────────────────────────────────────

    def clean(self):
        super().clean()
        errors = {}

        if not self.start_time or not self.cinema_room_id:
            return

        # Full lock: if an existing showtime already starts within lockout,
        # block ALL edits (any field).
        if self.pk:
            original_start = (
                Showtime.objects.filter(pk=self.pk)
                .values_list("start_time", flat=True)
                .first()
            )
            if original_start and original_start < timezone.now() + timedelta(minutes=LOCKOUT_MINUTES):
                raise ValidationError(
                    {"__all__": (
                        f"This showtime starts within {LOCKOUT_MINUTES} minutes "
                        f"and is locked for editing."
                    )}
                )

        # Lockout: cannot add or edit a showtime targeting a start_time within LOCKOUT_MINUTES
        if self.start_time < timezone.now() + timedelta(minutes=LOCKOUT_MINUTES):
            errors["start_time"] = (
                f"Cannot create/edit a showtime that starts within "
                f"{LOCKOUT_MINUTES} minutes from now."
            )

        movie = self.movie
        if not movie:
            errors["movie_id"] = "Movie not found."
            raise ValidationError(errors)

        # Overlap & gap checks for both new and edited showtimes
        duration = timedelta(minutes=movie.duration)
        new_end = self.start_time + duration
        gap = timedelta(minutes=GAP_MINUTES_DEFAULT)

        qs = Showtime.objects.filter(
            cinema_room=self.cinema_room,
            is_deleted=False,
        ).exclude(status__in=["cancelled", "draft"])

        if self.pk:
            qs = qs.exclude(pk=self.pk)

        for other in qs.select_related():
            other_end = other.end_time
            if self.start_time < other_end and new_end > other.start_time:
                errors["start_time"] = (
                    f"Overlaps with Showtime #{other.pk} "
                    f"({other.start_time:%H:%M}–{other_end:%H:%M})."
                )
                break

            if other_end <= self.start_time and self.start_time < other_end + gap:
                errors["start_time"] = (
                    f"Must start at least {GAP_MINUTES_DEFAULT} min after "
                    f"Showtime #{other.pk} ends at {other_end:%H:%M}."
                )
                break

            if new_end <= other.start_time and new_end + gap > other.start_time:
                errors["start_time"] = (
                    f"Must end at least {GAP_MINUTES_DEFAULT} min before "
                    f"Showtime #{other.pk} starts at {other.start_time:%H:%M}."
                )
                break

        if errors:
            raise ValidationError(errors)


class SeatHold(models.Model):
    showtime = models.ForeignKey(
        Showtime, on_delete=models.CASCADE, related_name="seat_holds"
    )
    seat_label = models.CharField(max_length=10)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="seat_holds",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        db_table = "seat_hold"
        unique_together = ("showtime", "seat_label")

    def __str__(self):
        return f"Hold {self.seat_label} for showtime {self.showtime_id}"

    @property
    def is_expired(self):
        return timezone.now() >= self.expires_at

    @classmethod
    def cleanup_expired(cls):
        """Remove all expired holds."""
        return cls.objects.filter(expires_at__lt=timezone.now()).delete()

    @classmethod
    def active_holds(cls, showtime):
        """Return non-expired holds for a showtime."""
        return cls.objects.filter(
            showtime=showtime,
            expires_at__gt=timezone.now(),
        )
