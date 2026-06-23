from datetime import date, timedelta

from django.utils import timezone
from rest_framework import serializers

from apps.movies.models import Movie

from .models import GAP_MINUTES_DEFAULT, LOCKOUT_MINUTES, CinemaRoom, SeatHold, Showtime
from .services import find_conflicts

VALID_SEAT_TYPES = {"normal", "vip", "couple"}
# ── CinemaRoom ────────────────────────────────────────────────────────


class CinemaRoomListSerializer(serializers.ModelSerializer):
    assignedMovies = serializers.SerializerMethodField()

    class Meta:
        model = CinemaRoom
        fields = ["id", "name", "total_seats", "assignedMovies"]

    def get_assignedMovies(self, obj):
        return list(
            obj.assigned_movies.filter(is_deleted=False).values(
                "id", "title", "status", "duration"
            )
        )


class CinemaRoomDetailSerializer(CinemaRoomListSerializer):
    seatMap = serializers.JSONField(source="seat_map", read_only=True)

    class Meta(CinemaRoomListSerializer.Meta):
        fields = CinemaRoomListSerializer.Meta.fields + ["seatMap"]


class AssignMoviesSerializer(serializers.Serializer):
    movie_ids = serializers.ListField(
        child=serializers.IntegerField(),
        help_text="List of movie IDs to assign to this room",
    )


class SeatMapUpdateSerializer(serializers.Serializer):
    """Update a single seat's status or type inside the seat_map."""

    row = serializers.CharField(max_length=2)
    number = serializers.IntegerField()
    status = serializers.ChoiceField(
        choices=["available", "broken", "maintenance"],
        required=False,
    )
    type = serializers.ChoiceField(
        choices=["normal", "vip", "couple"],
        required=False,
    )


# ── Showtime ──────────────────────────────────────────────────────────


class ShowtimeListSerializer(serializers.ModelSerializer):
    movieId = serializers.IntegerField(source="movie_id")
    movieTitle = serializers.SerializerMethodField()
    date = serializers.SerializerMethodField()
    time = serializers.SerializerMethodField()
    endTime = serializers.SerializerMethodField()
    hall = serializers.CharField(source="cinema_room.name", read_only=True)
    format = serializers.CharField(source="version_id.name", read_only=True)
    availableSeats = serializers.SerializerMethodField()
    totalSeats = serializers.IntegerField(
        source="cinema_room.total_seats", read_only=True
    )
    basePrice = serializers.DecimalField(
        source="base_price", max_digits=10, decimal_places=2, read_only=True
    )

    class Meta:
        model = Showtime
        fields = [
            "id",
            "movieId",
            "movieTitle",
            "date",
            "time",
            "endTime",
            "hall",
            "format",
            "availableSeats",
            "totalSeats",
            "basePrice",
            "status",
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Per-request cache — avoids the stale class-level dict that
        # persisted across requests and hid renamed / deleted movies.
        self._movie_cache: dict = {}

    def get_movieTitle(self, obj):
        mid = obj.movie_id
        if mid not in self._movie_cache:
            title = (
                Movie.objects.filter(pk=mid, is_deleted=False)
                .values_list("title", flat=True)
                .first()
            )
            self._movie_cache[mid] = title or ""
        return self._movie_cache[mid]

    def get_date(self, obj):
        return timezone.localtime(obj.start_time).strftime("%Y-%m-%d")

    def get_time(self, obj):
        return timezone.localtime(obj.start_time).strftime("%H:%M")

    def get_endTime(self, obj):
        return timezone.localtime(obj.end_time).strftime("%H:%M")

    def get_availableSeats(self, obj):
        booked = _booked_seat_count(obj)
        bookable = obj.cinema_room.bookable_seat_count
        return bookable - booked


class ShowtimeDetailSerializer(ShowtimeListSerializer):
    seats = serializers.SerializerMethodField()

    class Meta(ShowtimeListSerializer.Meta):
        fields = ShowtimeListSerializer.Meta.fields + ["seats"]

    def get_seats(self, obj):
        seat_map = obj.cinema_room.seat_map or []
        booked_labels = _booked_seat_labels(obj)

        # When a couple seat anchor (odd position) is booked, its pair slot
        # (anchor + 1) is implicitly unavailable — propagate that status so
        # the frontend never shows the pair slot as selectable.
        expanded_booked = set(booked_labels)
        for seat in seat_map:
            raw_type = seat.get("type", "normal").lower()
            seat_type = raw_type if raw_type in VALID_SEAT_TYPES else "normal"
            if seat_type == "couple":
                label = f"{seat['row']}{seat['number']}"
                if label in booked_labels:
                    pair_label = f"{seat['row']}{seat['number'] + 1}"
                    expanded_booked.add(pair_label)

        result = []
        for seat in seat_map:
            label = f"{seat['row']}{seat['number']}"
            if seat.get("status") != "available":
                continue
            raw_type = seat.get("type", "normal").lower()
            seat_type = raw_type if raw_type in VALID_SEAT_TYPES else "normal"
            seat_status = "occupied" if label in expanded_booked else "available"
            result.append(
                {
                    "id": label,
                    "row": seat["row"],
                    "number": seat["number"],
                    "type": seat_type,
                    "status": seat_status,
                }
            )
        return result


class ShowtimeWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Showtime
        fields = [
            "id",
            "movie_id",
            "cinema_room",
            "start_time",
            "version_id",
            "base_price",
            "status",
        ]

    def validate_start_time(self, value):
        if value < timezone.now() + timedelta(minutes=LOCKOUT_MINUTES):
            raise serializers.ValidationError(
                f"Cannot create/edit a showtime starting within "
                f"{LOCKOUT_MINUTES} minutes from now."
            )
        return value

    def validate(self, attrs):
        # Full lock: if the existing showtime already starts within lockout,
        # block ALL edits (price, room, time, status — everything).
        if self.instance:
            if self.instance.start_time < timezone.now() + timedelta(
                minutes=LOCKOUT_MINUTES
            ):
                raise serializers.ValidationError(
                    f"This showtime starts within {LOCKOUT_MINUTES} minutes "
                    f"and is locked for editing."
                )

        attrs = super().validate(attrs)
        start_time = attrs.get("start_time") or (
            self.instance.start_time if self.instance else None
        )
        room = attrs.get("cinema_room") or (
            self.instance.cinema_room if self.instance else None
        )
        movie_id = attrs.get("movie_id") or (
            self.instance.movie_id if self.instance else None
        )

        if not (start_time and room and movie_id):
            return attrs

        movie = Movie.objects.filter(pk=movie_id, is_deleted=False).first()
        if not movie:
            raise serializers.ValidationError({"movie_id": "Movie not found."})

        exclude_pk = self.instance.pk if self.instance else None
        conflicts = find_conflicts(
            room=room,
            start_time=start_time,
            duration_minutes=movie.duration,
            gap_minutes=GAP_MINUTES_DEFAULT,
            exclude_pk=exclude_pk,
        )
        if conflicts:
            raise serializers.ValidationError({"start_time": conflicts})

        return attrs


# ── Hold / Confirm serializers ────────────────────────────────────────


class HoldSeatsSerializer(serializers.Serializer):
    seat_labels = serializers.ListField(
        child=serializers.CharField(max_length=10),
        min_length=1,
        max_length=8,
    )


class ConfirmBookingSerializer(serializers.Serializer):
    showtime_id = serializers.IntegerField()
    seat_labels = serializers.ListField(
        child=serializers.CharField(max_length=10),
        min_length=1,
        max_length=8,
    )
    promo_code = serializers.CharField(
        required=False, allow_null=True, allow_blank=True
    )
    movie_id = serializers.IntegerField(required=False, allow_null=True)
    flat_price_promotion_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="Optional FlatPricePromotion id to apply (if active).",
    )
    points_to_redeem = serializers.IntegerField(
        required=False,
        default=0,
        min_value=0,
        help_text="Number of points the user wants to redeem for this booking.",
    )
    payment_method = serializers.ChoiceField(
        choices=["cash", "credit_card", "e_wallet", "bank_transfer", "vnpay", "momo"],
        default="vnpay",
    )
    concession_amount = serializers.DecimalField(
        max_digits=12, decimal_places=0, required=False, default=0, min_value=0
    )


# ── Showtime Generator ────────────────────────────────────────────────

VALID_TIME_SLOTS = ["morning", "afternoon", "night"]


class MovieScheduleConfigSerializer(serializers.Serializer):
    movie_id = serializers.IntegerField()
    priority = serializers.IntegerField(min_value=1, max_value=10)
    time_slots = serializers.ListField(
        child=serializers.ChoiceField(choices=VALID_TIME_SLOTS),
        min_length=1,
    )
    base_price = serializers.DecimalField(max_digits=10, decimal_places=2)
    enabled = serializers.BooleanField(
        default=True,
        required=False,
        help_text="If false, this movie is skipped during generation.",
    )


class GenerateShowtimesSerializer(serializers.Serializer):
    start_date = serializers.DateField()
    num_days = serializers.IntegerField(min_value=1, max_value=7)
    traffic_gap_minutes = serializers.IntegerField()
    cleanup_minutes = serializers.IntegerField()
    room_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, default=None
    )
    movie_configs = MovieScheduleConfigSerializer(many=True)
    clear_existing_drafts = serializers.BooleanField(default=False)

    def validate_start_date(self, value):
        if value < date.today():
            raise serializers.ValidationError("Start date cannot be in the past.")
        return value

    def validate_movie_configs(self, value):
        enabled_configs = [mc for mc in value if mc.get("enabled", True)]
        if not enabled_configs:
            raise serializers.ValidationError(
                "At least one movie must be enabled for generation."
            )
        if not value:
            raise serializers.ValidationError(
                "At least one movie configuration is required."
            )
        movie_ids = [mc["movie_id"] for mc in enabled_configs]
        existing = set(
            Movie.objects.filter(pk__in=movie_ids, is_deleted=False).values_list(
                "id", flat=True
            )
        )
        missing = [mid for mid in movie_ids if mid not in existing]
        if missing:
            raise serializers.ValidationError(f"Movies not found: {missing}")
        return enabled_configs

    def validate_room_ids(self, value):
        if value is None:
            return value
        existing = set(
            CinemaRoom.objects.filter(pk__in=value, is_deleted=False).values_list(
                "id", flat=True
            )
        )
        missing = [rid for rid in value if rid not in existing]
        if missing:
            raise serializers.ValidationError(f"Rooms not found: {missing}")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)

        room_ids = attrs.get("room_ids")
        if room_ids:
            rooms = CinemaRoom.objects.filter(
                pk__in=room_ids, is_deleted=False
            ).prefetch_related("assigned_movies")
        else:
            rooms = CinemaRoom.objects.filter(is_deleted=False).prefetch_related(
                "assigned_movies"
            )

        movie_ids = {mc["movie_id"] for mc in attrs["movie_configs"]}
        all_assigned: set[int] = set()
        for room in rooms:
            all_assigned.update(room.assigned_movies.values_list("id", flat=True))

        unassigned = movie_ids - all_assigned
        if unassigned:
            raise serializers.ValidationError(
                {
                    "movie_configs": (
                        f"Movies {sorted(unassigned)} are not assigned "
                        f"to any of the selected rooms."
                    )
                }
            )
        return attrs


# ── Helpers ───────────────────────────────────────────────────────────


def _booked_seat_labels(showtime):
    from apps.bookings.models import Ticket

    booked = set(
        Ticket.objects.filter(
            showtime=showtime,
            is_deleted=False,
            ticket_status_snapshot__in=["active", "used"],
        ).values_list("seat_label", flat=True)
    )
    held = set(SeatHold.active_holds(showtime).values_list("seat_label", flat=True))
    return booked | held


def _booked_seat_count(showtime):
    from apps.bookings.models import Ticket

    booked_labels = set(
        Ticket.objects.filter(
            showtime=showtime,
            is_deleted=False,
            ticket_status_snapshot__in=["active", "used"],
        ).values_list("seat_label", flat=True)
    )
    held_labels = set(
        SeatHold.active_holds(showtime).values_list("seat_label", flat=True)
    )

    # Build a label→type lookup so couple anchors can be counted as 2 seats.
    seat_type_map = {
        f"{s['row']}{s['number']}": s.get("type", "normal").lower()
        for s in (showtime.cinema_room.seat_map or [])
        if s.get("kind") == "seat" and "row" in s and "number" in s
    }

    count = 0
    for label in booked_labels | held_labels:
        count += 2 if seat_type_map.get(label, "normal") == "couple" else 1
    return count
