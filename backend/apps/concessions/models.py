from decimal import Decimal

from apps.bookings.models import Booking
from apps.core.models import BaseModel
from apps.users.models import User
from django.db import models


class ConcessionCategory(BaseModel):
    name = models.CharField(
        max_length=100,
        unique=True,
        blank=False,
        db_index=True,
    )
    is_active = models.BooleanField(
        blank=False,
        default=True,
    )

    def __str__(self):
        if self.is_active:
            return self.name
        return self.name + " (Inactive)"


class Concession(BaseModel):
    name = models.CharField(
        max_length=100,
        unique=True,
        blank=False,
        db_index=True,
    )
    is_active = models.BooleanField(
        blank=False,
        default=True,
    )
    description = models.TextField(
        unique=False,
        blank=True,
        default="",
    )
    category = models.ForeignKey(
        to=ConcessionCategory,
        on_delete=models.PROTECT,
        related_name="concessions",
        null=False,
    )
    image_url = models.CharField(
        max_length=512,
        blank=True,
        null=True,
        default=None,
    )
    is_combo = models.BooleanField(
        blank=False,
        default=False,
    )
    priority = models.FloatField(
        blank=False,
        null=False,
        default=0.0,
        help_text="Priority value, from 0.0 to 1.0.",
    )

    class Meta:
        indexes = [
            models.Index(fields=["is_active"]),
        ]

    def __str__(self):
        notes = []
        if self.is_combo:
            notes.append("Combo")
        if not self.is_active or not self.category.is_active:
            notes.append("Inactive")
        s = f"{self.category.name}: {self.name}"
        return f"{s} ({'; '.join(notes)})" if notes else s


class ConcessionVariant(BaseModel):
    concession = models.ForeignKey(
        to=Concession,
        on_delete=models.CASCADE,
        related_name="variants",
    )
    name = models.CharField(
        max_length=100,
        blank=False,
        db_index=True,
    )
    base_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0"),
    )
    in_combo_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0"),
        verbose_name="in-combo price",
    )
    sku = models.CharField(
        max_length=64,
        unique=True,
        blank=False,
        db_index=True,
    )
    is_active = models.BooleanField(
        blank=False,
        default=True,
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["concession", "name"],
                name="uq_variant_concession_name",
            ),
            models.CheckConstraint(
                condition=models.Q(base_price__gte=0),
                name="ck_variant_base_price_nonneg",
            ),
            models.CheckConstraint(
                condition=models.Q(in_combo_price__gte=0),
                name="ck_variant_in_combo_price_nonneg",
            ),
        ]
        indexes = [
            models.Index(fields=["concession", "is_active"]),
        ]

    def __str__(self):
        s = (
            f"{self.concession.category.name}: {self.concession.name}"
            + f" [{self.name}]"
        )
        return s if (
            self.is_active
            and self.concession.is_active
            and self.concession.category.is_active
        ) else f"{s} (Inactive)"


class ComboComponent(BaseModel):
    combo_concession = models.ForeignKey(
        to=Concession,
        on_delete=models.CASCADE,
        related_name="components",
    )
    variant = models.ForeignKey(
        to=ConcessionVariant,
        on_delete=models.PROTECT,
    )
    quantity = models.PositiveIntegerField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["combo_concession", "variant"],
                name="uq_combo_component",
            ),
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0),
                name="ck_combo_qty_positive",
            )
        ]

    def __str__(self):
        return str(self.variant)


class ConcessionOrder(BaseModel):
    SALES_CHANNEL_CHOICES = [
        ("KIOSK", "Kiosk"),
        ("WEB", "Web"),
        ("APP", "App"),
        ("IN_SEAT", "In-Seat"),
    ]

    booking = models.ForeignKey(
        to=Booking,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="concession_orders",
    )
    order_total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0"),
    )
    sales_channel = models.CharField(
        max_length=20,
        blank=False,
        choices=SALES_CHANNEL_CHOICES,
        db_index=True,
    )
    order_code = models.CharField(
        max_length=40,
        unique=True,
    )
    user = models.ForeignKey(
        to=User,
        on_delete=models.PROTECT,
        related_name="orders",
        null=False,
        db_index=True,
    )

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(order_total__gte=0),
                name="ck_order_total_nonneg",
            )
        ]

    def __str__(self):
        return f"Order {self.order_code} via {self.sales_channel}"


class ConcessionItem(BaseModel):
    order = models.ForeignKey(
        to=ConcessionOrder,
        on_delete=models.CASCADE,
        blank=False,
        related_name="items",
    )
    variant = models.ForeignKey(
        to=ConcessionVariant,
        on_delete=models.PROTECT,
        related_name="order_items",
    )
    display_name = models.CharField(
        max_length=100,
        blank=False,
        db_index=True,
    )
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )
    line_total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )
    notes = models.CharField(
        max_length=100,
        blank=True,
    )

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0),
                name="ck_item_qty_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(unit_price__gte=0),
                name="ck_item_unit_price_nonneg",
            ),
            models.CheckConstraint(
                condition=models.Q(line_total__gte=0),
                name="ck_item_line_total_nonneg",
            )
        ]
        indexes = [
            models.Index(fields=["order", "id"]),
        ]

    def __str__(self):
        return self.display_name
