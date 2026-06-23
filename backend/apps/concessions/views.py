from decimal import Decimal, InvalidOperation

from apps.core.permissions import ReadOnly
from django.db import transaction
from django.db.models import Count, Max, Min, Q, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone
from drf_spectacular.utils import (
    OpenApiParameter,
    extend_schema,
    extend_schema_view,
)
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .filters import ConcessionFilter, OrderFilter, VariantFilter
from .models import (
    ComboComponent,
    Concession,
    ConcessionCategory,
    ConcessionItem,
    ConcessionOrder,
    ConcessionVariant,
)
from .serializers import (
    CategorySerializer,
    ComboComponentSerializer,
    ConcessionSerializer,
    OrderDetailSerializer,
    OrderItemReadSerializer,
    OrderItemWriteSerializer,
    OrderListSerializer,
    OrderWriteSerializer,
    VariantSerializer,
)


@extend_schema_view(
    list=extend_schema(tags=["Concessions: Categories"]),
    retrieve=extend_schema(tags=["Concessions: Categories"]),
)
class CategoryViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    queryset = ConcessionCategory.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [ReadOnly]
    filterset_fields = ["is_active"]
    search_fields = ["name"]
    ordering = ["name"]

    def get_queryset(self):
        qs = super().get_queryset()
        qs = qs.annotate(
            concessions_total=Count("concessions", distinct=True),
            concessions_active=Count(
                "concessions",
                filter=Q(concessions__is_active=True),
                distinct=True,
            ),
        )
        request = self.request
        if request and "is_active" not in request.query_params:
            qs = qs.filter(is_active=True)
        return qs


@extend_schema_view(
    list=extend_schema(
        tags=["Concessions: Concessions"],
        parameters=[
            OpenApiParameter(
                name="include",
                description="Comma list. e.g., include=variants",
                required=False,
                type=str,
            ),
        ],
    ),
    retrieve=extend_schema(tags=["Concessions: Concessions"]),
)
class ConcessionViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    serializer_class = ConcessionSerializer
    permission_classes = [ReadOnly]
    filterset_class = ConcessionFilter
    search_fields = ["name", "description", "category__name"]
    ordering_fields = ["priority", "name", "category__name"]
    ordering = ["category__name", "-priority", "name"]

    def get_queryset(self):
        active_variants_filter = Q(
            variants__is_active=True,
            variants__is_deleted=False,
        )
        qs = Concession.objects.select_related("category").annotate(
            pmin=Min(
                "variants__base_price",
                filter=active_variants_filter,
            ),
            pmax=Max(
                "variants__base_price",
                filter=active_variants_filter,
            ),
            icpmin=Min(
                "variants__in_combo_price",
                filter=active_variants_filter,
            ),
            icpmax=Max(
                "variants__in_combo_price",
                filter=active_variants_filter,
            ),
        )
        include = self.request.query_params.get("include") or ""
        if "variants" in include.split(","):
            qs = qs.prefetch_related("variants")
        params = self.request.query_params
        if "effective_active" not in params and "is_active" not in params:
            qs = qs.filter(is_active=True, category__is_active=True)
        return qs

    @extend_schema(tags=["Concessions: Combos"])
    @action(detail=False, methods=["get"], url_path="combos")
    def combos(self, request):
        qs = self.get_queryset().filter(is_combo=True)
        page = self.paginate_queryset(qs)
        ser = self.get_serializer(
            page or qs, many=True, context={"request": request}
        )
        return (
            self.get_paginated_response(ser.data)
            if page is not None
            else Response(ser.data)
        )

    @extend_schema(tags=["Concessions: Combos"])
    @action(detail=True, methods=["get"], url_path="components")
    def components(self, request, pk=None):
        concession = self.get_object()
        if not concession.is_combo:
            return Response([], status=status.HTTP_200_OK)
        components = ComboComponent.objects.filter(
            combo_concession=concession
        ).select_related(
            "variant", "variant__concession", "variant__concession__category"
        )

        page = self.paginate_queryset(components)
        if page is not None:
            serializer = ComboComponentSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = ComboComponentSerializer(components, many=True)
        return Response(serializer.data)


@extend_schema_view(
    list=extend_schema(tags=["Concessions: Variants"]),
    retrieve=extend_schema(tags=["Concessions: Variants"]),
)
class VariantViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    queryset = ConcessionVariant.objects.select_related(
        "concession", "concession__category"
    )
    serializer_class = VariantSerializer
    permission_classes = [ReadOnly]
    filterset_class = VariantFilter
    search_fields = [
        "name",
        "sku",
        "concession__name",
        "concession__category__name",
    ]
    ordering_fields = ["name", "sku", "base_price", "in_combo_price"]
    ordering = ["concession__category__name", "concession__name", "name"]

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        if "is_active" not in params:
            qs = qs.filter(
                is_active=True,
                concession__is_active=True,
                concession__category__is_active=True,
            )
        return qs


@extend_schema_view(
    create=extend_schema(
        tags=["Concessions: Pricing"],
        request={
            "application/json": {
                "type": "object",
                "properties": {
                    "lines": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "variant_id": {"type": "integer"},
                                "quantity": {"type": "integer"},
                                "unit_price": {
                                    "type": "string",
                                    "nullable": True,
                                },
                            },
                            "required": ["variant_id", "quantity"],
                        },
                    },
                    "channel": {"type": "string", "nullable": True},
                    "pricing": {
                        "type": "string",
                        "enum": ["base", "combo"],
                        "nullable": True,
                        "description": (
                            "Default price source when unit_price is omitted."
                            + " 'base' (default) uses base_price;"
                            + " 'combo' uses in_combo_price."
                        ),
                    },
                },
                "required": ["lines"],
            },
        },
    ),
)
class PricePreviewViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        payload = request.data or {}
        lines = payload.get("lines") or []
        if not isinstance(lines, list) or not lines:
            return Response(
                {"detail": "lines is required and must be a non-empty list."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ids: list[int] = []
        in_combo: list[bool] = []
        for line in lines:
            vid = line.get("variant_id")
            variant_pricing = (line.get("pricing") or "").lower()
            try:
                ids.append(int(vid))
            except (ValueError, TypeError):
                return Response(
                    {"detail": f"variant_id '{vid}' must be a valid integer."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            in_combo.append(variant_pricing == "combo")

        variants = {
            v.id: v
            for v in ConcessionVariant.objects.filter(
                id__in=ids
            ).select_related("concession", "concession__category")
        }

        out_lines = []
        total = Decimal("0")
        for vid, variant_in_combo, line in zip(ids, in_combo, lines):
            try:
                qty = int(line.get("quantity", 0) or 0)
            except (ValueError, TypeError):
                return Response(
                    {
                        "detail": f"quantity for variant {vid} must be a valid"
                        + " integer."
                    }
                )
            unit_price = line.get("unit_price", None)
            var = variants.get(vid)
            if not var:
                return Response(
                    {"detail": f"variant_id {vid} not found."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if qty <= 0:
                return Response(
                    {"detail": "quantity must be positive."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
                # TODO: (ThapHN1) Add display_name to these
            if not (
                var.is_active
                and var.concession.is_active
                and var.concession.category.is_active
            ):
                return Response(
                    {"detail": f"variant_id {vid} is inactive."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if unit_price is None:
                unit_price = (
                    var.in_combo_price
                    if variant_in_combo
                    else var.base_price
                )
            try:
                unit_price = Decimal(str(unit_price))
            except InvalidOperation:
                return Response(
                    {"detail": f"unit_price for variant {vid} is invalid."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if unit_price < 0:
                return Response(
                    {"detail": "unit_price must be non-negative."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            line_total = unit_price * qty
            total += line_total
            out_lines.append(
                {
                    "variant_id": vid,
                    "quantity": qty,
                    "unit_price": str(unit_price.quantize(Decimal("0.01"))),
                    "line_total": str(line_total.quantize(Decimal("0.01"))),
                }
            )

        return Response(
            {
                "lines": out_lines,
                "subtotal": str(total.quantize(Decimal("0.01"))),
                "discounts": [],
                "total": str(total.quantize(Decimal("0.01"))),
            }
        )


@extend_schema_view(
    list=extend_schema(tags=["Concessions: Orders"]),
    retrieve=extend_schema(tags=["Concessions: Orders"]),
    create=extend_schema(tags=["Concessions: Orders"]),
    partial_update=extend_schema(tags=["Concessions: Orders"]),
)
class OrderViewSet(viewsets.ModelViewSet):
    queryset = ConcessionOrder.objects.all()
    permission_classes = [IsAuthenticated]
    filterset_class = OrderFilter
    search_fields = ["order_code"]
    ordering_fields = ["id", "order_total"]
    ordering = ["-id"]

    def get_queryset(self):
        qs = (
            super()
            .get_queryset()
            .annotate(items_count=Count("items"))
            .select_related("booking")
        )
        if self.action == "retrieve":
            qs = qs.prefetch_related(
                "items",
                "items__variant",
                "items__variant__concession",
            )
        user = self.request.user
        if user.is_authenticated and not user.is_staff:
            qs = qs.filter(user=user)
        return qs

    def get_serializer_class(self):
        if self.action in ["list"]:
            return OrderListSerializer
        if self.action in ["retrieve"]:
            return OrderDetailSerializer
        return OrderWriteSerializer

    @transaction.atomic
    def perform_create(self, serializer):
        obj = serializer.save(user=self.request.user)
        self._recalc(obj)

    @transaction.atomic
    def perform_update(self, serializer):
        obj = serializer.save()
        self._recalc(obj)

    @transaction.atomic
    def perform_destroy(self, instance):
        instance.soft_delete()
        instance.items.update(is_deleted=True, updated_at=timezone.now())

    def _recalc(self, order):
        order = ConcessionOrder.objects.select_for_update().get(pk=order.pk)
        agg = order.items.filter(is_deleted=False).aggregate(
            total=Coalesce(Sum("line_total"), Decimal("0"))
        )
        total = agg["total"].quantize(Decimal("0.01"))

        if order.order_total != total:
            order.order_total = total
            order.save(update_fields=["order_total"])

    @extend_schema(
        tags=["Concessions: Orders"],
        responses={status.HTTP_200_OK: OrderDetailSerializer},
    )
    @action(detail=True, methods=["post"], url_path="recalc")
    @transaction.atomic
    def recalc(self, request, pk=None):
        order = self.get_object()
        self._recalc(order)
        return Response(OrderDetailSerializer(order).data)


@extend_schema_view(
    list=extend_schema(tags=["Concessions: Order Items"]),
    retrieve=extend_schema(tags=["Concessions: Order Items"]),
    create=extend_schema(tags=["Concessions: Order Items"]),
    partial_update=extend_schema(tags=["Concessions: Order Items"]),
    destroy=extend_schema(tags=["Concessions: Order Items"]),
)
class OrderItemViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filterset_fields = ["order"]
    search_fields = ["display_name", "variant__sku", "variant__name"]

    def get_serializer_class(self):
        if self.action in ["list", "retrieve"]:
            return OrderItemReadSerializer
        return OrderItemWriteSerializer

    def get_queryset(self):
        qs = ConcessionItem.objects.select_related(
            "order",
            "variant",
            "variant__concession",
        )
        user = self.request.user
        if user.is_authenticated and not user.is_staff:
            qs = qs.filter(order__user=user)

        order_id = self.kwargs.get(
            "order_pk"
        ) or self.request.query_params.get("order")
        if order_id:
            qs = qs.filter(order_id=order_id)
        return qs.order_by("id")

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        pricing = (self.request.query_params.get("pricing") or "").lower()
        if pricing in ("base", "combo"):
            ctx["pricing"] = pricing
        return ctx

    @transaction.atomic
    def perform_create(self, serializer):
        order = serializer.context.get("order")
        if not order:
            order_id = self.request.query_params.get("order")
            if not order_id:
                raise serializers.ValidationError(
                    "Missing order context. Provide ?order=<order_id>."
                )
            try:
                order_id = int(order_id)
            except (ValueError, TypeError) as err:
                raise serializers.ValidationError(
                    "order_id must be a valid integer."
                ) from err
            try:
                order_qs = ConcessionOrder.objects.filter(pk=order_id)
                if not self.request.user.is_staff:
                    order_qs = order_qs.filter(user=self.request.user)
                order = order_qs.get()
            except ConcessionOrder.DoesNotExist as err:
                raise NotFound(
                    "Order not found or you lack access permission."
                ) from err

            serializer.context["order"] = order

        _ = serializer.save()
        self._safe_recalc_total(order.id)

    @transaction.atomic
    def perform_update(self, serializer):
        item = serializer.save()
        self._safe_recalc_total(item.order_id)

    @transaction.atomic
    def perform_destroy(self, instance):
        order_id = instance.order_id
        instance.soft_delete()
        self._safe_recalc_total(order_id)

    def _safe_recalc_total(self, order_id):
        """
        Locks the order row to prevent race conditions during recalculation.
        """
        order = ConcessionOrder.objects.select_for_update().get(pk=order_id)
        agg = order.items.filter(is_deleted=False).aggregate(
            total=Coalesce(Sum("line_total"), Decimal("0"))
        )
        total = agg["total"].quantize(Decimal("0.01"))

        if order.order_total != total:
            order.order_total = total
            order.save(update_fields=["order_total"])
