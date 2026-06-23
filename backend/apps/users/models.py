from apps.core.models import BaseModel
from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser, BaseModel):
    email = models.EmailField(unique=True)

    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = ["email"]

    def __str__(self):
        return self.username


class UserProfile(BaseModel):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    full_name = models.CharField(max_length=255)
    phone_number = models.CharField(max_length=20, unique=True, null=False)
    identity_card = models.CharField(max_length=20, unique=True, null=False)
    province = models.CharField(max_length=100, blank=True, null=True)
    ward = models.CharField(max_length=100, blank=True, null=True)
    street_address = models.CharField(max_length=255, blank=True, null=True)
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(
        max_length=10,
        choices=[("male", "Male"), ("female", "Female"), ("other", "Other")],
    )
    total_points = models.IntegerField(default=0)
    avatar_url = models.CharField(max_length=500, blank=True)
    avatar = models.ImageField(upload_to="avatars/", null=True, blank=True)

    def __str__(self):
        return self.full_name


class PointHistory(BaseModel):
    class Type(models.TextChoices):
        REDEEM = "REDEEM", "Redeem"
        ACCUMULATE = "ACCUMULATE", "Accumulate"

    user_profile = models.ForeignKey(
        UserProfile,
        on_delete=models.CASCADE,
        related_name="point_histories",
    )

    booking = models.ForeignKey(
        "bookings.Booking",
        on_delete=models.CASCADE,
        related_name="point_histories",
    )

    point_type = models.CharField(
        max_length=10,
        choices=Type.choices,
        help_text="Type of point transaction (Accumulate, Redeem).",
    )

    points_amount = models.IntegerField(
        help_text="Positive for Accumulate; negative for Redeem."
    )

    description = models.TextField(blank=True)

    class Meta:
        verbose_name = "Point History"
        verbose_name_plural = "Point Histories"

    def __str__(self):
        if self.points_amount > 0:
            sign = "+"
        elif self.points_amount < 0:
            sign = "-"
        else:
            sign = ""
        abs_amount = abs(self.points_amount)
        return f"[{self.get_point_type_display()}] {sign}{abs_amount} pts · Booking #{self.booking_id}"


# ── Points Discount System ───────────────────────────────────────────────


class UserPoint(models.Model):
    """Track each user's redeemable point balance and lifetime stats."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="points",
    )
    balance = models.PositiveIntegerField(default=0)
    total_earned = models.PositiveIntegerField(default=0)
    total_redeemed = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} — {self.balance} pts"


class PointTransaction(models.Model):
    """Immutable audit log: every earn, redeem, or admin adjustment."""

    class TransactionType(models.TextChoices):
        EARN = "earn", "Earn"
        REDEEM = "redeem", "Redeem"
        ADJUST = "adjust", "Manual Adjustment"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="point_transactions",
    )
    transaction_type = models.CharField(max_length=10, choices=TransactionType.choices)
    points = models.IntegerField()
    balance_after = models.PositiveIntegerField()
    booking = models.ForeignKey(
        "bookings.Booking",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="point_transactions",
    )
    note = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.username} | {self.transaction_type} {self.points:+d} pts"


class PointRedemptionConfig(models.Model):
    """
    Admin-configurable rules for point redemption.
    Only one active row should ever exist (enforced in admin).
    """

    max_redeem_percentage = models.PositiveIntegerField(
        default=50,
        help_text="Maximum % of subtotal that can be covered by points.",
    )
    min_points_to_redeem = models.PositiveIntegerField(
        default=4,
        help_text="Minimum points required to redeem (default 4 pts = 2,000 VND).",
    )
    points_per_vnd = models.PositiveIntegerField(
        default=500,
        help_text="1 redeemed point = this many VND discount (default 500).",
    )
    ratio_earned = models.DecimalField(
        max_digits=2,
        decimal_places=2,
        default=0.1,
        help_text="Point earned when payment successful.",
    )
    is_active = models.BooleanField(
        default=True,
        help_text="If False, point redemption is completely disabled system-wide.",
    )
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )

    class Meta:
        verbose_name = "Point Redemption Config"

    def __str__(self):
        return f"Config: max {self.max_redeem_percentage}%, min {self.min_points_to_redeem} pts"
