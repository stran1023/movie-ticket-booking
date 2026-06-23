# promotions/api_views.py

from django.db import models, transaction
from django.db.models import F
from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import FlatPricePromotion, MoviePromotion, PromoRedemption, UserPromotion
from .serializers import (
    CalculatedDiscountSerializer,
    FlatPricePromotionSerializer,
    MoviePromotionDisplaySerializer,
    MoviePromotionSerializer,
    MovieValidateRequestSerializer,
    PromotionRedeemRequestSerializer,
    UserPromotionDisplaySerializer,
)
from .services import (
    MoviePromotionInvalid,
    add_to_community_tickets,
    cache_promo_validation,
    get_cached_promo,
    get_community_tickets,
    validate_movie_promotion,
)


class PromotionValidateAPIView(APIView):
    """
    GET /promotions/validate
    Query params:
      - code: promo code string
      - movie_id: movie id of the current booking
      - total_amount: current subtotal (seats + concessions)
    """

    def get(self, request, *args, **kwargs):
        serializer = MovieValidateRequestSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)

        code = serializer.validated_data["code"]
        movie_id = serializer.validated_data["movie_id"]
        total_amount = serializer.validated_data["total_amount"]

        # First try Redis cache — keyed only by code, but we include
        # movie_id and total_amount in the cached payload so that we
        # can safely reuse only when the booking context matches.
        cached = get_cached_promo(code)
        if cached is not None:
            if cached.get("movie_id") == movie_id and str(
                cached.get("total_amount")
            ) == str(total_amount):
                return Response(cached, status=status.HTTP_200_OK)

        result = validate_movie_promotion(
            code=code,
            movie_id=movie_id,
            total_amount=total_amount,
        )

        # If invalid -> return minimal response
        if not result.valid:
            error_payload = {
                "valid": False,
                "reason": result.reason,
            }

            # Provide a human-friendly error message when the promo
            # does not apply to the selected movie.
            if (
                result.promotion is not None
                and result.promotion.movie_id
                and result.promotion.movie_id != movie_id
            ):
                error_payload["error"] = (
                    "This promo code is not valid for the selected movie."
                )

            # Cache negative validations as well to avoid repeated DB hits.
            error_payload["movie_id"] = movie_id
            error_payload["total_amount"] = str(total_amount)
            cache_promo_validation(code, error_payload)

            return Response(error_payload, status=status.HTTP_200_OK)

        # If valid -> include promotion and calculated_discount
        promotion_data = MoviePromotionSerializer(result.promotion).data
        discount_data = CalculatedDiscountSerializer(
            {
                "original_amount": total_amount,
                "discount_amount": result.discount_amount,
                "final_amount": result.final_amount,
            }
        ).data

        response_data = {
            "valid": True,
            "reason": None,
            "promotion": promotion_data,
            "calculated_discount": discount_data,
            # Extra metadata for cache reuse safety
            "movie_id": movie_id,
            "total_amount": str(total_amount),
        }
        # Cache successful validation and push to community discovery list.
        cache_promo_validation(code, response_data)
        add_to_community_tickets(code)
        return Response(response_data, status=status.HTTP_200_OK)


class PromotionRedeemAPIView(APIView):
    """
    POST /promotions/redeem
    Body:
    {
      "code": "MOVIE50"
    }

    This endpoint consumes stock atomically.
    """

    # authentication_classes = [JWTAuthentication]
    # permission_classes = [IsAuthenticated]

    @transaction.atomic
    @swagger_auto_schema(
        request_body=PromotionRedeemRequestSerializer,
        responses={
            200: openapi.Response(
                description="Redemption result",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        "success": openapi.Schema(type=openapi.TYPE_BOOLEAN),
                        "reason": openapi.Schema(
                            type=openapi.TYPE_STRING, nullable=True
                        ),
                    },
                    required=["success"],
                ),
                examples={
                    "application/json": {"success": True},
                },
            ),
            401: openapi.Response(
                description="Authentication required",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        "success": openapi.Schema(type=openapi.TYPE_BOOLEAN),
                        "reason": openapi.Schema(type=openapi.TYPE_STRING),
                    },
                    required=["success", "reason"],
                ),
                examples={
                    "application/json": {"success": False, "reason": "AUTH_REQUIRED"}
                },
            ),
        },
        operation_summary="Redeem a promotion code",
        operation_description="Redeems a promo code for the authenticated user and consumes stock atomically.",
    )
    def post(self, request, *args, **kwargs):
        serializer = PromotionRedeemRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        code = serializer.validated_data["code"]

        try:
            # Lock row for update to avoid race conditions
            promotion = MoviePromotion.objects.select_for_update().get(code=code)
        except MoviePromotion.DoesNotExist:
            return Response(
                {
                    "success": False,
                    "reason": MoviePromotionInvalid.INAPPLICABLE,
                },
                status=status.HTTP_200_OK,
            )

        # Active flag (managed by signals + Celery task)
        if not promotion.is_active:
            return Response(
                {
                    "success": False,
                    "reason": MoviePromotionInvalid.EXPIRED,
                },
                status=status.HTTP_200_OK,
            )

        # Per-user redemption uniqueness
        already_redeemed = PromoRedemption.objects.filter(
            user=request.user,
            promo_code=promotion,
        ).exists()
        if already_redeemed:
            return Response(
                {
                    "success": False,
                    "reason": "ALREADY_REDEEMED",
                },
                status=status.HTTP_200_OK,
            )

        # Usage limit check (global)
        if promotion.used_count >= promotion.usage_limit:
            return Response(
                {
                    "success": False,
                    "reason": MoviePromotionInvalid.REDEEM_CODE_MAX_REACHED,
                },
                status=status.HTTP_200_OK,
            )

        # Atomic increment with F expression
        promotion.used_count = F("used_count") + 1
        promotion.save(update_fields=["used_count"])

        PromoRedemption.objects.create(
            user=request.user,
            promo_code=promotion,
        )

        return Response({"success": True}, status=status.HTTP_200_OK)


class AllPromotionsListAPIView(APIView):
    """
    GET /promotions/all
    Returns all active user and movie promotions
    """

    def get(self, request, *args, **kwargs):
        # Get active user promotions
        user_promos = UserPromotion.objects.filter(is_active=True).values()

        # Get active movie promotions
        movie_promos = (
            MoviePromotion.objects.filter(is_active=True)
            .select_related("movie")
            .values()
        )

        # Get active flat price promotions (no date filter; relies on is_active flag)
        flat_price_promos = FlatPricePromotion.objects.filter(is_active=True).values()

        # Format user promotions
        user_promo_list = []
        for promo in user_promos:
            promo["promotionType"] = "USER"
            user_promo_list.append(self._format_promotion(promo, "USER"))

        # Format movie promotions
        movie_promo_list = []
        for promo in movie_promos:
            promo["promotionType"] = "MOVIE"
            movie_promo_list.append(self._format_promotion(promo, "MOVIE"))

        # Format flat price promotions
        flat_price_promo_list = []
        for promo in flat_price_promos:
            flat_price_promo_list.append(self._format_flat_price_promotion(promo))

        all_promos = user_promo_list + movie_promo_list + flat_price_promo_list

        return Response(all_promos, status=status.HTTP_200_OK)

    def _format_promotion(self, promo, promo_type):
        value = promo["discount_value"]
        # Strip trailing .00 but keep other decimals (e.g. 15.5)
        display_value = (
            int(value) if value == value.to_integral_value() else value.normalize()
        )

        description = promo["description"] or ""
        words = description.split()
        short_description = " ".join(words[:100])
        if len(words) > 100:
            short_description += "..."

        if promo["discount_type"] == "PERCENTAGE":
            percentage_val = int(display_value * 100)
            discount_text = f"{percentage_val}% off"
        else:
            discount_text = f"${display_value} off"
        return {
            "id": promo["id"],
            "title": promo["title"],
            "description": short_description,
            "startDate": str(promo["start_date"]),
            "endDate": str(promo["end_date"]),
            "bannerUrl": promo.get("banner_url"),
            "bannerColor": "bg-gradient-to-r from-primary/10 to-accent/20",
            "discount": discount_text,
            "promotionType": promo_type,
        }

    def _format_flat_price_promotion(self, promo):
        """
        Normalize FlatPricePromotion instances into the same shape as other promotions
        for the /promotions/all endpoint.
        """
        description = promo.get("description") or ""

        flat_price_value = promo.get("flat_price")
        discount_text = (
            f"Flat {flat_price_value:,} VND" if flat_price_value is not None else ""
        )

        start_date = promo.get("start_date")
        end_date = promo.get("end_date")

        return {
            "id": promo["id"],
            "title": promo["title"],
            "description": description,
            "startDate": str(start_date) if start_date else "",
            "endDate": str(end_date) if end_date else "",
            "bannerUrl": promo["banner_url"],
            "bannerColor": "bg-gradient-to-r from-primary/10 to-accent/20",
            "discount": discount_text,
            "promotionType": "FLAT_PRICE",
        }


class UserPromotionsListAPIView(APIView):
    """
    GET /promotions/users
    Returns all active user promotions
    """

    def get(self, request, *args, **kwargs):
        promos = UserPromotion.objects.filter(is_active=True).values()

        promo_list = []
        for promo in promos:
            promo_list.append(self._format_promotion(promo))

        return Response(promo_list, status=status.HTTP_200_OK)

    def _format_promotion(self, promo):
        value = promo["discount_value"]
        # Strip trailing .00 but keep other decimals (e.g. 15.5)
        display_value = (
            int(value) if value == value.to_integral_value() else value.normalize()
        )

        if promo["discount_type"] == "PERCENTAGE":
            percentage_val = int(display_value * 100)
            discount_text = f"{percentage_val}% off"
        else:
            discount_text = f"${display_value} off"
        return {
            "id": promo["id"],
            "title": promo["title"],
            "description": promo["description"],
            "startDate": str(promo["start_date"]),
            "endDate": str(promo["end_date"]),
            "bannerUrl": promo.get("banner_url"),
            "bannerColor": "bg-gradient-to-r from-primary/10 to-accent/20",
            "discount": discount_text,
            "promotionType": "USER",
        }


class MoviePromotionsListAPIView(APIView):
    """
    GET /promotions/movies
    Returns all active movie promotions
    """

    def get(self, request, *args, **kwargs):
        promos = (
            MoviePromotion.objects.filter(is_active=True)
            .select_related("movie")
            .values()
        )

        promo_list = []
        for promo in promos:
            promo_list.append(self._format_promotion(promo))

        return Response(promo_list, status=status.HTTP_200_OK)

    def _format_promotion(self, promo):
        value = promo["discount_value"]
        # Strip trailing .00 but keep other decimals (e.g. 15.5)
        display_value = (
            int(value) if value == value.to_integral_value() else value.normalize()
        )

        if promo["discount_type"] == "PERCENTAGE":
            percentage_val = int(display_value * 100)
            discount_text = f"{percentage_val}% off"
        else:
            discount_text = f"${display_value} off"
        return {
            "id": promo["id"],
            "title": promo["title"],
            "description": promo["description"],
            "startDate": str(promo["start_date"]),
            "endDate": str(promo["end_date"]),
            "bannerUrl": promo.get("banner_url"),
            "bannerColor": "bg-gradient-to-r from-primary/10 to-accent/20",
            "discount": discount_text,
            "code": promo.get("code"),
            "promotionType": "MOVIE",
        }


class PromotionDetailAPIView(APIView):
    def get(self, request, pk, *args, **kwargs):
        # Get type from query params (e.g., ?type=USER)
        promo_type = request.query_params.get("type", "MOVIE").upper()

        try:
            if promo_type == "USER":
                promo = UserPromotion.objects.get(pk=pk)
                serializer = UserPromotionDisplaySerializer(promo)
                return Response(serializer.data)

            if promo_type == "FLAT_PRICE":
                promo = FlatPricePromotion.objects.get(pk=pk)

                # Shape matches Promotion interface used on the frontend
                payload = {
                    "id": promo.id,
                    "title": promo.title,
                    "description": promo.description,
                    "startDate": str(promo.start_date) if promo.start_date else "",
                    "endDate": str(promo.end_date) if promo.end_date else "",
                    "bannerUrl": promo.banner_url,
                    "bannerColor": "bg-gradient-to-r from-primary/10 to-accent/20",
                    "discount": f"Flat {promo.flat_price:,} VND",
                    "promotionType": "FLAT_PRICE",
                    "flat_price": promo.flat_price,
                }
                return Response(payload)

            else:
                promo = MoviePromotion.objects.get(pk=pk)
                serializer = MoviePromotionDisplaySerializer(promo)
                return Response(serializer.data)
        except (
            UserPromotion.DoesNotExist,
            MoviePromotion.DoesNotExist,
            FlatPricePromotion.DoesNotExist,
        ):
            return Response(
                {"detail": "Promotion not found"}, status=status.HTTP_404_NOT_FOUND
            )


# ── Flat Price Promotions ──────────────────────────────────────────────────────


class FlatPricePromotionListAPIView(APIView):
    """
    GET /api/flat-price-promotions/?showtime_id=<id>

    Returns all is_active=True flat price promotions. If showtime_id is provided,
    additionally filters to include only promotions whose cinema_version matches
    the showtime's version (or promotions with no cinema_version restriction).
    """

    def get(self, request, *args, **kwargs):
        from apps.cinemas.models import Showtime

        qs = FlatPricePromotion.objects.filter(is_active=True).select_related(
            "cinema_version"
        )

        showtime_id = request.query_params.get("showtime_id")
        if showtime_id:
            try:
                showtime = Showtime.objects.get(pk=int(showtime_id), is_deleted=False)
                # Keep promotions that have no version restriction OR match the showtime version
                qs = qs.filter(
                    models.Q(cinema_version__isnull=True)
                    | models.Q(cinema_version_id=showtime.version_id_id)
                )
            except (Showtime.DoesNotExist, ValueError):
                pass  # bad id → return all active promotions without version filtering

        serializer = FlatPricePromotionSerializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class FlatPricePromotionValidateAPIView(APIView):
    """
    GET /api/flat-price-promotions/validate/
    Query params:
      - promotion_id  : int
      - showtime_id   : int
      - seat_types    : comma-separated, e.g. "normal,vip"
      - seats         : breakdown, e.g. "normal:2,vip:1"

    Validates the promotion against the current booking context and returns
    the new_subtotal computed from the flat price × applicable seat counts.
    """

    def get(self, request, *args, **kwargs):
        from apps.cinemas.models import Showtime

        # --- Parse params ---
        promotion_id = request.query_params.get("promotion_id")
        showtime_id = request.query_params.get("showtime_id")
        seat_types_raw = request.query_params.get("seat_types", "")
        seats_raw = request.query_params.get("seats", "")

        if not promotion_id or not showtime_id:
            return Response(
                {"valid": False, "error": "promotion_id and showtime_id are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --- Fetch promotion ---
        try:
            promo = FlatPricePromotion.objects.select_related("cinema_version").get(
                pk=int(promotion_id)
            )
        except (FlatPricePromotion.DoesNotExist, ValueError):
            return Response(
                {"valid": False, "error": "Promotion not found."},
                status=status.HTTP_200_OK,
            )

        # --- Check is_active ---
        if not promo.is_active:
            return Response(
                {"valid": False, "error": "This promotion is no longer active."},
                status=status.HTTP_200_OK,
            )

        # --- Fetch showtime ---
        try:
            showtime = Showtime.objects.get(pk=int(showtime_id), is_deleted=False)
        except (Showtime.DoesNotExist, ValueError):
            return Response(
                {"valid": False, "error": "Showtime not found."},
                status=status.HTTP_200_OK,
            )

        # NOTE: Per user request, we keep validation simple here:
        # we do not enforce recurring_weekday/start_date/end_date checks. These fields
        # exist for admin reference and potential future automation.

        # --- Seat scope check ---
        seat_types = [s.strip() for s in seat_types_raw.split(",") if s.strip()]
        if promo.seat_scope == FlatPricePromotion.SeatScope.ALL:
            applies_to = ["normal", "vip", "couple"]
        else:
            applies_to = [promo.seat_scope]

        if seat_types and not any(t in applies_to for t in seat_types):
            return Response(
                {
                    "valid": False,
                    "error": (
                        f"This promotion applies to {promo.get_seat_scope_display()} seats only, "
                        f"but your booking contains none of those seat types."
                    ),
                },
                status=status.HTTP_200_OK,
            )

        # --- Cinema version check ---
        if promo.cinema_version_id is not None:
            if showtime.version_id_id != promo.cinema_version_id:
                return Response(
                    {
                        "valid": False,
                        "error": (
                            f"This promotion is only valid for "
                            f"{promo.cinema_version.name} showtimes."
                        ),
                    },
                    status=status.HTTP_200_OK,
                )

        # --- Compute new_subtotal from seat breakdown ---
        # seats_raw format: "normal:2,vip:1,couple:1"
        seat_counts: dict[str, int] = {}
        for part in seats_raw.split(","):
            part = part.strip()
            if ":" in part:
                stype, _, scount = part.partition(":")
                try:
                    seat_counts[stype.strip()] = int(scount.strip())
                except ValueError:
                    pass

        applicable_count = sum(
            count for stype, count in seat_counts.items() if stype in applies_to
        )
        new_subtotal = promo.flat_price * applicable_count

        return Response(
            {
                "valid": True,
                "flat_price": promo.flat_price,
                "applies_to": applies_to,
                "new_subtotal": new_subtotal,
            },
            status=status.HTTP_200_OK,
        )


class CommunityPromoTicketsAPIView(APIView):
    """
    GET /promotions/community

    Returns the most recently validated promo codes from Redis, to power
    the "Community Discovery" feature on the booking step.
    """

    def get(self, request, *args, **kwargs):
        limit_param = request.query_params.get("limit")
        try:
            limit = int(limit_param) if limit_param is not None else 5
        except (TypeError, ValueError):
            limit = 5

        codes = get_community_tickets(limit=limit)
        return Response({"codes": codes}, status=status.HTTP_200_OK)
