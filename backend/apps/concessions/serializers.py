from decimal import ROUND_HALF_UP, Decimal

from apps.bookings.models import Booking
from rest_framework import serializers

from .models import (
    ComboComponent,
    Concession,
    ConcessionCategory,
    ConcessionItem,
    ConcessionOrder,
    ConcessionVariant,
)


class CategorySerializer(serializers.ModelSerializer):
    concessions_total = serializers.IntegerField(read_only=True)
    concessions_active = serializers.IntegerField(read_only=True)

    class Meta:
        model = ConcessionCategory
        fields = [
            "id",
            "name",
            "is_active",
            "concessions_total",
            "concessions_active",
        ]


class MinimalCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ConcessionCategory
        fields = ["id", "name"]


class MinimalConcessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Concession
        fields = ["id", "name"]


class VariantSerializer(serializers.ModelSerializer):
    concession = MinimalConcessionSerializer(read_only=True)

    class Meta:
        model = ConcessionVariant
        fields = [
            "id",
            "concession",
            "name",
            "sku",
            "base_price",
            "in_combo_price",
            "is_active",
        ]


class ConcessionSerializer(serializers.ModelSerializer):
    category = MinimalCategorySerializer(read_only=True)
    price_range = serializers.SerializerMethodField()
    combo_price_range = serializers.SerializerMethodField()
    variants = VariantSerializer(many=True, read_only=True)

    class Meta:
        model = Concession
        fields = [
            "id",
            "name",
            "description",
            "is_active",
            "is_combo",
            "category",
            "price_range",
            "combo_price_range",
            "variants",
            "image_url",
            "priority",
        ]

    def get_price_range(self, obj):
        pmin = getattr(obj, "pmin", None)
        pmax = getattr(obj, "pmax", None)
        if pmin is None or pmax is None:
            prices = [v.base_price for v in obj.variants.all()]
            if not prices:
                return None
            pmin = min(prices)
            pmax = max(prices)
        return {"min": str(pmin), "max": str(pmax)}

    def get_combo_price_range(self, obj):
        icpmin = getattr(obj, "icpmin", None)
        icpmax = getattr(obj, "icpmax", None)
        if icpmin is None or icpmax is None:
            prices = [v.in_combo_price for v in obj.variants.all()]
            if not prices:
                return None
            icpmin = min(prices)
            icpmax = max(prices)
        return {"min": str(icpmin), "max": str(icpmax)}

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        include = (
            request.query_params.get("include") if request else ""
        ) or ""
        if "variants" not in include.split(","):
            data.pop("variants", None)
        return data


class ComboComponentSerializer(serializers.ModelSerializer):
    variant = VariantSerializer(read_only=True)
    variant_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        source="variant",
        queryset=ConcessionVariant.objects.select_related("concession"),
        required=True,
    )

    class Meta:
        model = ComboComponent
        fields = ["id", "variant", "variant_id", "quantity"]


class OrderItemReadSerializer(serializers.ModelSerializer):
    variant = VariantSerializer(read_only=True)

    class Meta:
        model = ConcessionItem
        fields = [
            "id",
            "variant",
            "display_name",
            "quantity",
            "unit_price",
            "line_total",
            "notes",
        ]


class OrderItemWriteSerializer(serializers.ModelSerializer):
    variant_id = serializers.PrimaryKeyRelatedField(
        write_only=True,
        source="variant",
        queryset=ConcessionVariant.objects.select_related(
            "concession", "concession__category"
        ),
    )

    class Meta:
        model = ConcessionItem
        fields = [
            "id",
            "variant_id",
            "display_name",
            "quantity",
            "unit_price",
            "line_total",
            "notes",
        ]
        read_only_fields = ["line_total"]

    def validate(self, attrs):
        variant: ConcessionVariant = attrs.get("variant") or getattr(
            self.instance, "variant", None
        )
        if not variant:
            return attrs

        if not (
            variant.is_active
            and variant.concession.is_active
            and variant.concession.category.is_active
        ):
            raise serializers.ValidationError("Variant is inactive.")

        qty = attrs.get("quantity", getattr(self.instance, "quantity", None))
        if qty is not None and qty <= 0:
            raise serializers.ValidationError("Quantity must be positive.")

        unit_price = attrs.get(
            "unit_price", getattr(self.instance, "unit_price", None)
        )
        if unit_price is not None and unit_price < 0:
            raise serializers.ValidationError(
                "Unit price must be non-negative."
            )

        return attrs

    def _default_display_name(self, variant):
        return f"{variant.concession.name} [{variant.name}]"

    def _q2(self, value: Decimal | None) -> Decimal:
        return (value or Decimal("0")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

    def create(self, validated_data):
        order: ConcessionOrder = self.context["order"]
        variant: ConcessionVariant = validated_data["variant"]
        quantity: int = validated_data["quantity"]

        unit_price: Decimal = validated_data.get("unit_price")
        if unit_price is None:
            pricing = (self.context.get("pricing") or "").lower()
            unit_price = (
                variant.in_combo_price
                if pricing == "combo"
                else variant.base_price
            )
        unit_price = self._q2(Decimal(unit_price))

        display_name: str = validated_data.get("display_name")
        if display_name is None:
            display_name = self._default_display_name(variant)
        line_total = self._q2(unit_price * quantity)

        item = ConcessionItem.objects.create(
            order=order,
            variant=variant,
            display_name=display_name,
            quantity=quantity,
            unit_price=unit_price,
            line_total=line_total,
            notes=validated_data.get("notes", ""),
        )
        return item

    def update(self, instance, validated_data):
        instance.variant = validated_data.get("variant", instance.variant)
        instance.display_name = (
            validated_data.get("display_name")
            or instance.display_name
            or self._default_display_name(instance.variant)
        )
        instance.quantity = validated_data.get("quantity", instance.quantity)

        if "unit_price" in validated_data:
            instance.unit_price = self._q2(
                Decimal(validated_data["unit_price"])
            )

        instance.line_total = self._q2(
            instance.unit_price * (instance.quantity or 0)
        )
        instance.notes = validated_data.get("notes", instance.notes)
        instance.save()
        return instance


class OrderListSerializer(serializers.ModelSerializer):
    items_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = ConcessionOrder
        fields = [
            "id",
            "order_code",
            "sales_channel",
            "booking",
            "order_total",
            "items_count",
        ]


class OrderDetailSerializer(serializers.ModelSerializer):
    items = OrderItemReadSerializer(many=True, read_only=True)

    class Meta:
        model = ConcessionOrder
        fields = [
            "id",
            "order_code",
            "sales_channel",
            "booking",
            "order_total",
            "items",
        ]


class OrderWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConcessionOrder
        fields = ["id", "order_code", "sales_channel", "booking"]

    def validate(self, attrs):
        return attrs

    def validate_booking(self, value: Booking):
        user = self.context["request"].user
        # IMPORTANT: user_profile_id is actually the UserProfile object,
        #            the naming is a mistake.
        if (
            value
            and value.user_profile_id
            and value.user_profile_id.user != user
        ):
            raise serializers.ValidationError(
                "You do not have permission to attach to this booking."
            )
        return value
