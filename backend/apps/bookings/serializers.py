from apps.bookings.models import Booking, Ticket
from apps.movies.models import Movie
from django.utils import timezone
from rest_framework import serializers


class TicketDetailSerializer(serializers.ModelSerializer):
    seatLabel = serializers.CharField(source="seat_label", read_only=True)
    showDate = serializers.SerializerMethodField()
    showTime = serializers.SerializerMethodField()
    hall = serializers.CharField(source="showtime.cinema_room.name", read_only=True)
    movieTitle = serializers.SerializerMethodField()
    price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    ticketStatus = serializers.CharField(
        source="ticket_status_snapshot", read_only=True
    )

    class Meta:
        model = Ticket
        fields = [
            "id",
            "seatLabel",
            "showDate",
            "showTime",
            "hall",
            "movieTitle",
            "price",
            "ticketStatus",
        ]

    def _get_movie_title(self, movie_id):
        movie_cache = self.context.setdefault("_movie_cache", {})
        if movie_id in movie_cache:
            return movie_cache[movie_id]

        movie_title = (
            Movie.objects.filter(pk=movie_id).values_list("title", flat=True).first()
            or ""
        )
        movie_cache[movie_id] = movie_title
        return movie_title

    def get_showDate(self, obj):
        return timezone.localtime(obj.showtime.start_time).date()

    def get_showTime(self, obj):
        return timezone.localtime(obj.showtime.start_time).strftime("%H:%M")

    def get_movieTitle(self, obj):
        return self._get_movie_title(obj.showtime.movie_id)


class BookedTicketSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="booking_code", read_only=True)
    movieTitle = serializers.SerializerMethodField()
    bookingDate = serializers.SerializerMethodField()
    showDate = serializers.SerializerMethodField()
    showTime = serializers.SerializerMethodField()
    hall = serializers.SerializerMethodField()
    seats = serializers.SerializerMethodField()
    total = serializers.DecimalField(
        source="final_amount", max_digits=12, decimal_places=2
    )
    discountAmount = serializers.DecimalField(
        source="discount_amount", max_digits=12, decimal_places=2, read_only=True
    )
    finalAmount = serializers.DecimalField(
        source="final_amount", max_digits=12, decimal_places=2, read_only=True
    )
    status = serializers.CharField(read_only=True)
    customerName = serializers.CharField(source="customer_name", read_only=True)
    pointsEarned = serializers.IntegerField(source="points_earned", read_only=True)
    pointsUsed = serializers.IntegerField(source="points_used", read_only=True)
    tickets = TicketDetailSerializer(many=True, read_only=True)

    class Meta:
        model = Booking
        fields = [
            "id",
            "movieTitle",
            "bookingDate",
            "showDate",
            "showTime",
            "hall",
            "seats",
            "total",
            "discountAmount",
            "finalAmount",
            "status",
            "customerName",
            "pointsEarned",
            "pointsUsed",
            "tickets",
        ]

    def _get_first_ticket(self, obj):
        tickets = list(obj.tickets.all())
        if not tickets:
            return None
        return tickets[0]

    def _get_movie_title(self, movie_id):
        movie_cache = self.context.setdefault("_movie_cache", {})
        if movie_id in movie_cache:
            return movie_cache[movie_id]

        movie_title = (
            Movie.objects.filter(pk=movie_id).values_list("title", flat=True).first()
            or ""
        )
        movie_cache[movie_id] = movie_title
        return movie_title

    def get_movieTitle(self, obj):
        first_ticket = self._get_first_ticket(obj)
        if first_ticket is None:
            return ""
        return self._get_movie_title(first_ticket.showtime.movie_id)

    def get_bookingDate(self, obj):
        if obj.created_at is None:
            return None
        return obj.created_at.date().isoformat()

    def get_showDate(self, obj):
        first_ticket = self._get_first_ticket(obj)
        if first_ticket is None:
            return None
        return timezone.localtime(first_ticket.showtime.start_time).date()

    def get_showTime(self, obj):
        first_ticket = self._get_first_ticket(obj)
        if first_ticket is None:
            return ""
        return timezone.localtime(first_ticket.showtime.start_time).strftime("%H:%M")

    def get_hall(self, obj):
        first_ticket = self._get_first_ticket(obj)
        if first_ticket is None:
            return ""
        return first_ticket.showtime.cinema_room.name

    def get_seats(self, obj):
        labels = list(obj.tickets.values_list("seat_label", flat=True))
        return ", ".join(labels)
