from rest_framework import serializers

from .models import DiscountType, FlatPricePromotion, MoviePromotion


class MovieValidateRequestSerializer(serializers.Serializer):
    code = serializers.CharField()
    movie_id = serializers.IntegerField()
    total_amount = serializers.DecimalField(max_digits=12, decimal_places=2)


class PromotionRedeemRequestSerializer(serializers.Serializer):
    code = serializers.CharField()


class MoviePromotionSerializer(serializers.ModelSerializer):
    # flatten movie into movie_id
    movie_id = serializers.IntegerField(source="movie.id", read_only=True)

    class Meta:
        model = MoviePromotion
        fields = [
            "id",
            "code",
            "discount_type",
            "discount_value",
            "max_discount_cap",
            "stacking_rule",
            "start_date",
            "end_date",
            "movie_id",
        ]


class CalculatedDiscountSerializer(serializers.Serializer):
    original_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    discount_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    final_amount = serializers.DecimalField(max_digits=12, decimal_places=2)


class PromotionDisplaySerializer(serializers.Serializer):
    """Base display serializer for promotions"""

    id = serializers.IntegerField()
    title = serializers.CharField()
    description = serializers.CharField()
    startDate = serializers.SerializerMethodField()
    endDate = serializers.SerializerMethodField()
    bannerUrl = serializers.SerializerMethodField()
    bannerColor = serializers.SerializerMethodField()
    discount = serializers.SerializerMethodField()
    # 1. Change this to a MethodField
    promotionType = serializers.SerializerMethodField()

    def get_startDate(self, obj):
        return str(obj.start_date)

    def get_endDate(self, obj):
        return str(obj.end_date)

    def get_bannerUrl(self, obj):
        return obj.banner_url

    def get_bannerColor(self, obj):
        # Default gradient color for fallback
        return "bg-gradient-to-r from-primary/10 to-accent/20"

    def get_discount(self, obj):
        value = obj.discount_value

        if obj.discount_type == DiscountType.PERCENTAGE:
            # Calculate percentage first, then cast to int to remove any .0
            # This turns 0.15 -> 15 or 15.0 -> 1500 depending on your DB storage
            percentage_val = int(value * 100)
            return f"{percentage_val}% off"

        else:
            # For Fixed amounts, use your normalization logic
            display_value = (
                int(value) if value == value.to_integral_value() else value.normalize()
            )
            return f"${display_value} off"

    # 2. Add the base method (optional, can be overridden)
    def get_promotionType(self, obj):
        return "UNKNOWN"


class UserPromotionDisplaySerializer(PromotionDisplaySerializer):
    # 3. Override to return 'USER'
    def get_promotionType(self, obj):
        return "USER"


class FlatPricePromotionSerializer(serializers.ModelSerializer):
    """Read-only serializer for FlatPricePromotion — used by list and validate endpoints."""

    cinema_version = serializers.SerializerMethodField()

    class Meta:
        model = FlatPricePromotion
        fields = [
            "id",
            "title",
            "description",
            "small_description",
            "flat_price",
            "seat_scope",
            "cinema_version",
            "recurring_weekday",
            "start_date",
            "end_date",
        ]

    def get_cinema_version(self, obj):
        if obj.cinema_version_id is None:
            return None
        return {"id": obj.cinema_version_id, "name": obj.cinema_version.name}


class MoviePromotionDisplaySerializer(PromotionDisplaySerializer):
    code = serializers.CharField()

    # 4. Override to return 'MOVIE'
    def get_promotionType(self, obj):
        return "MOVIE"
