import logging
from datetime import timedelta

from apps.movies.models import Movie
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response

from .models import SEAT_HOLD_MINUTES, CinemaRoom, SeatHold, Showtime
from .serializers import (
    VALID_SEAT_TYPES,
    AssignMoviesSerializer,
    CinemaRoomDetailSerializer,
    CinemaRoomListSerializer,
    GenerateShowtimesSerializer,
    HoldSeatsSerializer,
    SeatMapUpdateSerializer,
    ShowtimeDetailSerializer,
    ShowtimeListSerializer,
    ShowtimeWriteSerializer,
)

logger = logging.getLogger(__name__)


class CinemaRoomViewSet(viewsets.ReadOnlyModelViewSet):
    """
    list:           GET  /api/cinemas/rooms/
    detail:         GET  /api/cinemas/rooms/{id}/           (includes seat_map)
    seat_map:       GET  /api/cinemas/rooms/{id}/seat-map/
    update_seat:    PATCH /api/cinemas/rooms/{id}/update-seat/ (admin)
    assign_movies:  POST  /api/cinemas/rooms/{id}/assign-movies/ (admin)
    """

    permission_classes = [AllowAny]

    def get_queryset(self):
        return (
            CinemaRoom.objects.filter(is_deleted=False)
            .prefetch_related("assigned_movies")
            .order_by("id")
        )

    def get_serializer_class(self):
        if self.action == "retrieve":
            return CinemaRoomDetailSerializer
        return CinemaRoomListSerializer

    @action(detail=True, methods=["get"], url_path="seat-map")
    def seat_map(self, request, pk=None):
        room = self.get_object()
        return Response(room.seat_map or [])

    @action(
        detail=True,
        methods=["patch"],
        url_path="update-seat",
        permission_classes=[IsAdminUser],
    )
    def update_seat(self, request, pk=None):
        """Admin endpoint to modify a single seat's type or status."""
        room = self.get_object()
        serializer = SeatMapUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        target_row = d["row"]
        target_num = d["number"]

        seat_map = list(room.seat_map or [])
        found = False
        for seat in seat_map:
            if seat["row"] == target_row and seat["number"] == target_num:
                if "status" in d:
                    seat["status"] = d["status"]
                if "type" in d:
                    seat["type"] = d["type"]
                found = True
                break

        if not found:
            return Response(
                {"detail": f"Seat {target_row}{target_num} not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        room.seat_map = seat_map
        room.save(update_fields=["seat_map", "updated_at"])
        return Response(CinemaRoomDetailSerializer(room).data)

    @action(
        detail=True,
        methods=["post"],
        url_path="assign-movies",
        permission_classes=[IsAdminUser],
    )
    def assign_movies(self, request, pk=None):
        room = self.get_object()
        serializer = AssignMoviesSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        movie_ids = serializer.validated_data["movie_ids"]
        movies = Movie.objects.filter(id__in=movie_ids, is_deleted=False)
        room.assigned_movies.set(movies)
        return Response(CinemaRoomDetailSerializer(room).data)


class ShowtimeViewSet(viewsets.ModelViewSet):
    """
    list:     GET  /api/cinemas/showtimes/                  (filter: movie_id, date, status)
    detail:   GET  /api/cinemas/showtimes/{id}/              (includes seat map with occupancy)
    create:   POST /api/cinemas/showtimes/                   (admin)
    update:   PUT  /api/cinemas/showtimes/{id}/              (admin)
    partial:  PATCH /api/cinemas/showtimes/{id}/             (admin)
    seats:    GET  /api/cinemas/showtimes/{id}/seats/        (seat map with occupancy)
    """

    ordering = ["start_time"]
    
    # Showtimes must NOT be paginated — the frontend booking flow needs
    # the full list for a given date/movie.  The global PAGE_SIZE=10
    # was silently truncating results, causing confirmed showtimes to
    # disappear on the frontend.
    pagination_class = None

    def get_permissions(self):
        if self.action in ("list", "retrieve", "seats"):
            return [AllowAny()]
        if self.action in ("hold_seats", "release_seats"):
            return [IsAuthenticated()]
        return [IsAdminUser()]

    def get_queryset(self):
        qs = Showtime.objects.filter(is_deleted=False).select_related(
            "cinema_room", "version_id"
        )

        movie_id = self.request.query_params.get("movie_id")
        if movie_id:
            qs = qs.filter(movie_id=movie_id)

        date = self.request.query_params.get("date")
        if date:
            qs = qs.filter(start_time__date=date)

        if self.action == "list":
            # Allow users to see and select showtimes up to 5 minutes after they start
            cutoff = timezone.now() - timedelta(minutes=5)
            qs = qs.filter(start_time__gte=cutoff)

        st = self.request.query_params.get("status")
        if st:
            qs = qs.filter(status=st)
        else:
            if not (self.request.user and self.request.user.is_staff):
                qs = qs.filter(status="confirmed")

        return qs.order_by("start_time")

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ShowtimeDetailSerializer
        if self.action in ("create", "update", "partial_update"):
            return ShowtimeWriteSerializer
        return ShowtimeListSerializer

    @action(
        detail=False,
        methods=["post"],
        url_path="generate",
        permission_classes=[IsAdminUser],
    )
    def generate_showtimes(self, request):
        """
        POST /api/cinemas/showtimes/generate/

        Auto-generate draft showtimes across cinema rooms.  Respects traffic
        staggering, room cleanup gaps, priority weights, format matching,
        time-slot assignments, and min-2-per-movie quotas.  Calling twice
        fills gaps without creating overlaps (fill-gap idempotency).
        """
        from .showtime_generator import ShowtimeGenerator, build_config

        serializer = GenerateShowtimesSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data

        # Delete existing drafts in the date range before generating
        if data.get("clear_existing_drafts"):
            from datetime import timedelta as td

            start = data["start_date"]
            end = start + td(days=data["num_days"])
            Showtime.objects.filter(
                status="draft",
                start_time__date__gte=start,
                start_time__date__lt=end,
                is_deleted=False,
            ).delete()

        config = build_config(data)
        generator = ShowtimeGenerator(config)
        drafts = generator.generate()

        if drafts:
            created = Showtime.objects.bulk_create(drafts)
        else:
            created = []

        return Response(
            {
                "generated_count": len(created),
                "showtimes": ShowtimeListSerializer(created, many=True).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["get"], url_path="seats")
    def seats(self, request, pk=None):
        """
        GET /api/cinemas/showtimes/{id}/seats/

        Returns every bookable seat for the showtime with an enriched status:

          "occupied"     — sold (finalized Ticket in DB)
          "held"         — held by another user (Redis or DB SeatHold)
          "held_by_you"  — held by the requesting user (Redis or DB)
          "available"    — free to select

        Optimization: Redis holds are fetched with a single SCAN + MGET call
        (O(held_seats)) instead of one GET per seat.  DB queries are also
        kept to two: one for sold Tickets, one for active SeatHolds.
        """
        from apps.bookings.models import Ticket
        from apps.bookings.services import get_held_seats_for_showtime

        showtime = self.get_object()
        seat_map_raw: list[dict] = showtime.cinema_room.seat_map or []

        # ── 1. SOLD: tickets with irrevocable status (single DB query) ──
        sold_labels: set[str] = set(
            Ticket.objects.filter(
                showtime=showtime,
                is_deleted=False,
                ticket_status_snapshot__in=["active", "used"],
            ).values_list("seat_label", flat=True)
        )

        # ── 2. Redis holds — SCAN + MGET, one round-trip ────────────────
        try:
            redis_holds: dict[str, int] = get_held_seats_for_showtime(showtime.pk)
        except Exception as exc:
            logger.warning(
                "Redis unavailable while fetching holds for showtime %s: %s",
                showtime.pk,
                exc,
            )
            redis_holds = {}

        # ── 3. DB SeatHold — legacy path (ShowtimeViewSet.hold_seats) ───
        db_holds: dict[str, int] = {
            h.seat_label: h.user_id for h in SeatHold.active_holds(showtime)
        }

        # Redis takes precedence over DB holds for the same label (more recent)
        all_holds: dict[str, int] = {**db_holds, **redis_holds}

        requesting_user_id: int | None = (
            request.user.id
            if (request.user and request.user.is_authenticated)
            else None
        )

        # ── 4. Pre-compute couple-seat pair propagation ──────────────────
        # When a couple anchor is sold or held, its visual pair slot (anchor+1)
        # must inherit the same status so the frontend never renders it as free.
        pair_override: dict[str, str] = {}
        for seat in seat_map_raw:
            raw_type = seat.get("type", "normal").lower()
            if raw_type != "couple":
                continue
            label = f"{seat['row']}{seat['number']}"
            pair = f"{seat['row']}{seat['number'] + 1}"
            if label in sold_labels:
                pair_override[pair] = "occupied"
            elif label in all_holds:
                holder = all_holds[label]
                if requesting_user_id is not None and holder == requesting_user_id:
                    pair_override[pair] = "held_by_you"
                else:
                    pair_override[pair] = "held"

        # ── 5. Build response ────────────────────────────────────────────
        result: list[dict] = []
        for seat in seat_map_raw:
            if seat.get("status") != "available":
                continue

            raw_type = seat.get("type", "normal").lower()
            seat_type = raw_type if raw_type in VALID_SEAT_TYPES else "normal"
            label = f"{seat['row']}{seat['number']}"

            # Determine booking status (pair_override fills phantom pair slots)
            if label in sold_labels:
                booking_status = "occupied"
            elif label in pair_override:
                booking_status = pair_override[label]
            elif label in all_holds:
                holder = all_holds[label]
                if requesting_user_id is not None and holder == requesting_user_id:
                    booking_status = "held_by_you"
                else:
                    booking_status = "held"
            else:
                booking_status = "available"

            result.append(
                {
                    "id": label,
                    "row": seat["row"],
                    "number": seat["number"],
                    "type": seat_type,
                    "status": booking_status,
                }
            )

        return Response(result)

    # ── Seat hold / release ────────────────────────────────────────────

    @action(
        detail=True,
        methods=["post"],
        url_path="hold-seats",
        permission_classes=[IsAuthenticated],
    )
    def hold_seats(self, request, pk=None):
        """Hold seats for SEAT_HOLD_MINUTES. Replaces any prior holds by this user."""
        showtime = self.get_object()
        serializer = HoldSeatsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        seat_labels = serializer.validated_data["seat_labels"]

        SeatHold.cleanup_expired()

        SeatHold.objects.filter(showtime=showtime, user=request.user).delete()

        from apps.bookings.models import Ticket

        booked = set(
            Ticket.objects.filter(
                showtime=showtime,
                is_deleted=False,
                ticket_status_snapshot__in=["active", "used"],
            ).values_list("seat_label", flat=True)
        )
        held_by_others = set(
            SeatHold.active_holds(showtime)
            .exclude(user=request.user)
            .values_list("seat_label", flat=True)
        )
        seat_map = {
            f"{s['row']}{s['number']}": s for s in (showtime.cinema_room.seat_map or [])
        }

        # Expand unavailable set: if a couple seat anchor is booked/held,
        # its pair slot (anchor + 1) is also implicitly unavailable.
        unavailable = booked | held_by_others
        for lbl in list(unavailable):
            seat = seat_map.get(lbl)
            if seat and seat.get("type", "normal").lower() == "couple":
                pair_lbl = f"{seat['row']}{seat['number'] + 1}"
                unavailable.add(pair_lbl)

        conflicts = [lbl for lbl in seat_labels if lbl in unavailable]
        if conflicts:
            return Response(
                {"detail": f"Seats already taken: {', '.join(conflicts)}"},
                status=status.HTTP_409_CONFLICT,
            )

        invalid = [lbl for lbl in seat_labels if lbl not in seat_map]
        if invalid:
            return Response(
                {"detail": f"Invalid seat labels: {', '.join(invalid)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        expires = timezone.now() + timedelta(minutes=SEAT_HOLD_MINUTES)
        holds = [
            SeatHold(
                showtime=showtime,
                seat_label=lbl,
                user=request.user,
                expires_at=expires,
            )
            for lbl in seat_labels
        ]
        SeatHold.objects.bulk_create(holds)

        return Response(
            {
                "held": seat_labels,
                "expires_at": expires.isoformat(),
                "hold_minutes": SEAT_HOLD_MINUTES,
            }
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="release-seats",
        permission_classes=[IsAuthenticated],
    )
    def release_seats(self, request, pk=None):
        """Release all holds for the current user on this showtime."""
        showtime = self.get_object()
        deleted, _ = SeatHold.objects.filter(
            showtime=showtime, user=request.user
        ).delete()
        return Response({"released": deleted})
