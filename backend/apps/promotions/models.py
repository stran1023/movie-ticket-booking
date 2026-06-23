from apps.core.models import BaseModel
from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

# class Promotion(models.Model):
#    DISCOUNT_TYPE_CHOICES = [
#        ("percentage", "Percentage"),
#        ("fixed", "Fixed Amount"),
#        ("percentage", "Percentage"),
#        ("fixed", "Fixed Amount"),
#    ]
#    title = models.CharField(max_length=255)
#    description = models.TextField(blank=True, null=True)
#    discount_value = models.DecimalField(max_digits=10, decimal_places=2)
#    discount_type = models.CharField(max_length=20, choices=DISCOUNT_TYPE_CHOICES)
#    start_date = models.DateField()
#    end_date = models.DateField()
#    banner_url = models.CharField(max_length=500, blank=True, null=True)
#    created_at = models.DateTimeField(auto_now_add=True)
#    updated_at = models.DateTimeField(auto_now=True)
#    is_deleted = models.BooleanField(default=False)


class PromotionType(models.TextChoices):
    USER = "USER", "User"
    MOVIE = "MOVIE", "Movie"


class DiscountType(models.TextChoices):
    PERCENTAGE = "PERCENTAGE", "Percentage"
    FIXED_AMOUNT = "FIXED_AMOUNT", "Fixed amount"


class StackingRule(models.TextChoices):
    STACKABLE = "STACKABLE", "Stackable"
    EXCLUSIVE = "EXCLUSIVE", "Exclusive"


class PromotionBase(BaseModel):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)

    discount_type = models.CharField(
        max_length=20,
        choices=DiscountType.choices,
    )

    discount_value = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        validators=[MinValueValidator(0)],
    )

    stacking_rule = models.CharField(
        max_length=20,
        choices=StackingRule.choices,
        default=StackingRule.EXCLUSIVE,
    )

    max_discount_cap = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
    )

    type = models.CharField(
        max_length=10,
        choices=PromotionType.choices,
        editable=False,
    )
    start_date = models.DateField()
    end_date = models.DateField()
    banner_url = models.URLField(max_length=500, blank=True, null=True)
    is_active = models.BooleanField(
        default=False,
        help_text="Automatically managed flag indicating if the promotion is currently active.",
    )

    class Meta:
        abstract = True


class UserPromotion(PromotionBase):
    class TargetCampaign(models.TextChoices):
        HOLIDAY = "HOLIDAY", "Holiday"
        BIRTHDAY = "BIRTHDAY", "Birthday"
        AGE_RANGE = "AGE_RANGE", "Age range"

    target_campaign = models.CharField(
        max_length=20,
        choices=TargetCampaign.choices,
        null=True,
        blank=True,
    )
    min_age = models.PositiveIntegerField(null=True, blank=True)
    max_age = models.PositiveIntegerField(null=True, blank=True)

    def save(self, *args, **kwargs):
        self.type = PromotionType.USER
        super().save(*args, **kwargs)

    def __str__(self):
        return f"[USER] {self.title}"


class MoviePromotion(PromotionBase):
    code = models.CharField(
        max_length=50,
        unique=True,
    )

    movie = models.ForeignKey(
        "movies.Movie",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="promotions",
    )

    usage_limit = models.PositiveIntegerField()
    used_count = models.PositiveIntegerField(default=0)

    def save(self, *args, **kwargs):
        self.type = PromotionType.MOVIE
        super().save(*args, **kwargs)

    def __str__(self):
        # guard if movie might be null
        movie_title = self.movie.title if self.movie else "No movie"
        return f"[MOVIE] {self.code} ({movie_title})"


class GlobalPromoSettings(models.Model):
    class CalculationMethod(models.TextChoices):
        ADDITIVE = "ADDITIVE", "Additive"
        COMPOUNDED = "COMPOUNDED", "Compounded"

    # optional: make this a singleton configuration, but keep it simple for now
    max_total_discount_percentage = models.PositiveIntegerField(
        default=50,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )

    stacking_order = models.JSONField(
        default=list,
        help_text="An ordered list of PromotionType values, e.g. ['USER', 'MOVIE']",
    )

    calculation_method = models.CharField(
        max_length=20,
        choices=CalculationMethod.choices,
        default=CalculationMethod.COMPOUNDED,
    )

    def save(self, *args, **kwargs):
        # simple default if nothing is set
        if not self.stacking_order:
            self.stacking_order = [PromotionType.USER, PromotionType.MOVIE]
        super().save(*args, **kwargs)

    def __str__(self):
        return f"GlobalPromoSettings({self.pk})"


class FlatPricePromotion(models.Model):
    """
    A promotion that sets seats to a fixed flat price for a specific period or weekday.
    Completely separate from MoviePromotion/UserPromotion (no promo code involved).
    """

    title = models.CharField(max_length=255)
    description = models.TextField()
    small_description = models.CharField(
        max_length=150,
        help_text="Short version shown in the booking UI dropdown.",
    )

    # Optional banner image so it can be displayed together
    # with regular promotions in the unified listing API.
    banner_url = models.URLField(max_length=500, blank=True, null=True)

    flat_price = models.PositiveIntegerField(
        help_text="Flat price per seat in VND (e.g. 60000)."
    )

    class SeatScope(models.TextChoices):
        NORMAL = "normal", "Normal"
        VIP = "vip", "VIP"
        COUPLE = "couple", "Couple"
        ALL = "all", "All Seat Types"

    seat_scope = models.CharField(
        max_length=10,
        choices=SeatScope.choices,
        default=SeatScope.ALL,
        help_text="Which seat types this flat price applies to.",
    )

    # null = applies to all cinema versions; set = scoped to a specific version (e.g. IMAX)
    cinema_version = models.ForeignKey(
        "movies.Version",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="flat_price_promotions",
        help_text="Leave blank to apply to all cinema versions.",
    )

    class Weekday(models.IntegerChoices):
        MONDAY = 0, "Monday"
        TUESDAY = 1, "Tuesday"
        WEDNESDAY = 2, "Wednesday"
        THURSDAY = 3, "Thursday"
        FRIDAY = 4, "Friday"
        SATURDAY = 5, "Saturday"
        SUNDAY = 6, "Sunday"

    # Scheduling: weekday + date range are optional and can be combined.
    # Logic is enforced in the validate API, not as model constraints.
    recurring_weekday = models.IntegerField(
        choices=Weekday.choices,
        null=True,
        blank=True,
        help_text=(
            "If set, promotion applies on this weekday every week. "
            "Can be combined with a date range to limit the recurrence window."
        ),
    )
    start_date = models.DateField(
        null=True,
        blank=True,
        help_text="Inclusive start date. Leave blank for open-ended start.",
    )
    end_date = models.DateField(
        null=True,
        blank=True,
        help_text="Inclusive end date. Leave blank for open-ended end.",
    )

    # is_active is the sole on/off switch; dates/weekday are reference/filter fields only.
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "flat_price_promotion"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} ({self.flat_price} VND)"


class PromoRedemption(BaseModel):
    """
    Audit model tracking successful promo code redemptions.

    A promo code can only be redeemed once per user, enforced via the
    unique_together constraint on (user, promo_code).
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="promo_redemptions",
    )
    promo_code = models.ForeignKey(
        MoviePromotion,
        on_delete=models.CASCADE,
        related_name="redemptions",
    )
    # Optional link to the booking created using this promo
    booking = models.ForeignKey(
        "bookings.Booking",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="promo_redemptions",
    )

    class Meta:
        db_table = "promo_redemption"
        unique_together = ("user", "promo_code")

    def __str__(self):
        return f"{self.user} → {self.promo_code.code}"
