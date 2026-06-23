from django.db import models


class Booking(models.Model):
    BOOKING_STATUS_CHOICES = [
        ("pending", "Pending"),
        ("confirmed", "Confirmed"),
        ("cancelled", "Cancelled"),
        ("completed", "Completed"),
    ]

    PAYMENT_METHOD_CHOICES = [
        ("cash", "Cash"),
        ("credit_card", "Credit Card"),
        ("e_wallet", "E-Wallet"),
        ("bank_transfer", "Bank Transfer"),
        ("vnpay", "VNPay"),
        ("momo", "MoMo"),
    ]

    booking_code = models.CharField(max_length=50, unique=True)
    user_profile_id = models.ForeignKey(
        'users.UserProfile', on_delete=models.PROTECT, related_name='bookings'
    )
    customer_name = models.CharField(max_length=255)
    customer_email = models.EmailField()
    customer_phone = models.CharField(max_length=20, blank=True, null=True)
    #promotion = models.ForeignKey(
    #    "promotions.Promotion",
    #    on_delete=models.SET_NULL,
    #    null=True,
    #    blank=True,
    #    related_name="bookings",
    #)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    final_amount = models.DecimalField(max_digits=12, decimal_places=2)
    points_used = models.IntegerField(default=0)
    points_earned = models.IntegerField(default=0)
    status = models.CharField(
        max_length=20, choices=BOOKING_STATUS_CHOICES, default="pending"
    )
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False)

    class Meta:
        db_table = "booking"

    def __str__(self):
        return self.booking_code


class Ticket(models.Model):
    SEAT_TYPE_CHOICES = [
        ("normal", "Normal"),
        ("vip", "VIP"),
        ("couple", "Couple"),
    ]

    TICKET_STATUS_CHOICES = [
        ("active", "Active"),
        ("used", "Used"),
        ("cancelled", "Cancelled"),
        ("refunded", "Refunded"),
    ]

    booking = models.ForeignKey(
        Booking, on_delete=models.PROTECT, related_name="tickets"
    )
    showtime = models.ForeignKey(
        "cinemas.Showtime", on_delete=models.PROTECT, related_name="tickets"
    )
    seat_label = models.CharField(
        max_length=10,
        default="",
        help_text="Seat coordinate, e.g. A1, B12",
    )
    price = models.DecimalField(max_digits=10, decimal_places=2)
    seat_type_snapshot = models.CharField(max_length=20, choices=SEAT_TYPE_CHOICES)
    ticket_status_snapshot = models.CharField(
        max_length=20, choices=TICKET_STATUS_CHOICES
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False)

    class Meta:
        db_table = "ticket"
        unique_together = ("showtime", "seat_label")

    def __str__(self):
        return f"Ticket {self.id} - {self.booking.booking_code}"


class Payment(models.Model):
    PAYMENT_STATUS_CHOICES = [
        ("pending", "Pending"),
        ("success", "Success"),
        ("failed", "Failed"),
        ("expired", "Expired"),
    ]

    GATEWAY_CHOICES = [
        ("vnpay", "VNPay"),
        ("momo", "MoMo"),
    ]

    booking = models.ForeignKey(
        Booking, on_delete=models.CASCADE, related_name="payments"
    )
    txn_ref = models.CharField(max_length=100, unique=True)
    gateway = models.CharField(max_length=10, choices=GATEWAY_CHOICES)
    amount = models.BigIntegerField(help_text="Amount in VND")
    status = models.CharField(
        max_length=20, choices=PAYMENT_STATUS_CHOICES, default="pending"
    )
    gateway_response_code = models.CharField(max_length=20, blank=True, default="")
    gateway_txn_id = models.CharField(max_length=100, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "payment"

    def __str__(self):
        return f"{self.gateway} {self.txn_ref} ({self.status})"
