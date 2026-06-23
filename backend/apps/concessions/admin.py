from decimal import Decimal

from config.admin_site import admin_site
from django.contrib import admin, messages
from django.db.models import Count, Max, Min, Q

from .models import (
    ComboComponent,
    Concession,
    ConcessionCategory,
    ConcessionItem,
    ConcessionOrder,
    ConcessionVariant,
)


class HideSoftDeleteMixin:
    def get_exclude(self, request, obj=None):
        base = (
            super().get_exclude(request, obj)
            if hasattr(super(), "get_exclude")
            else None
        )
        out = list(base or [])
        if "is_deleted" not in out:
            out.append("is_deleted")
        return tuple(out)


class ConcessionVariantInline(admin.TabularInline):
    model = ConcessionVariant
    extra = 1
    fields = ("name", "sku", "base_price", "in_combo_price", "is_active")
    show_change_link = True
    autocomplete_fields = ()
    ordering = ("name",)
    verbose_name = "Variant"
    verbose_name_plural = "Variants"

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related("concession")


class ComboComponentInline(admin.TabularInline):
    """
    Only shown for Concession objects where is_combo=True.
    Lets you compose a combo by selecting variants and quantities.
    """

    model = ComboComponent
    extra = 1
    fields = ("variant", "quantity", "variant_in_combo_price", "line_subtotal")
    readonly_fields = ("variant_in_combo_price", "line_subtotal")
    autocomplete_fields = ("variant",)
    verbose_name = "Combo component"
    verbose_name_plural = "Combo components"

    def variant_in_combo_price(self, obj):
        try:
            return obj.variant.in_combo_price
        except Exception:
            return "-"

    variant_in_combo_price.short_description = "In-combo unit price"

    def line_subtotal(self, obj):
        try:
            q = obj.quantity or 0
            p = obj.variant.in_combo_price or Decimal("0")
            return (p * q).quantize(Decimal("0"))
        except Exception:
            return "-"

    line_subtotal.short_description = "Subtotal (qty × in-combo)"

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "variant":
            qs = ConcessionVariant.objects.select_related(
                "concession", "concession__category"
            ).filter(
                is_active=True,
                concession__is_active=True,
                concession__category__is_active=True,
            )
            kwargs["queryset"] = qs
        return super().formfield_for_foreignkey(db_field, request, **kwargs)


class ConcessionItemInline(admin.TabularInline):
    """
    Items inside an Order. Computes line_total automatically on save.
    """

    model = ConcessionItem
    extra = 0
    fields = (
        "variant",
        "display_name",
        "quantity",
        "unit_price",
        "line_total",
        "notes",
    )
    readonly_fields = ("line_total",)
    autocomplete_fields = ("variant",)
    ordering = ("id",)

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related("variant", "order")


class EffectiveActiveFilter(admin.SimpleListFilter):
    """
    For Concession: consider CATEGORY + CONCESSION active flags.
    """

    title = "effective active"
    parameter_name = "effective"

    def lookups(self, request, model_admin):
        return (("1", "Active"), ("0", "Inactive"))

    def queryset(self, request, queryset):
        val = self.value()
        if val == "1":
            return queryset.filter(is_active=True, category__is_active=True)
        if val == "0":
            return queryset.exclude(is_active=True, category__is_active=True)
        return queryset


class ConcessionCategoryAdmin(HideSoftDeleteMixin, admin.ModelAdmin):
    list_display = (
        "name",
        "is_active",
        "total_concessions",
        "active_concessions",
    )
    search_fields = ("name",)
    list_filter = ("is_active",)
    ordering = ("name",)
    actions = ("mark_active", "mark_inactive")

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.annotate(
            total_cnt=Count("concessions", distinct=True),
            active_cnt=Count(
                "concessions",
                filter=Q(concessions__is_active=True),
                distinct=True,
            ),
        )

    @admin.display(ordering="total_cnt", description="Concessions")
    def total_concessions(self, obj):
        return obj.total_cnt

    @admin.display(ordering="active_cnt", description="Active concessions")
    def active_concessions(self, obj):
        return obj.active_cnt

    @admin.action(description="Mark selected categories as ACTIVE")
    def mark_active(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(
            request, f"{updated} categories set to ACTIVE.", messages.SUCCESS
        )

    @admin.action(description="Mark selected categories as INACTIVE")
    def mark_inactive(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(
            request, f"{updated} categories set to INACTIVE.", messages.WARNING
        )


class ConcessionAdmin(HideSoftDeleteMixin, admin.ModelAdmin):
    """
    Concession page:
    - Inline Variants always
    - Inline Combo Components only if is_combo=True
    """

    fieldsets = (
        (
            "Basic info",
            {
                "fields": ("name", "description", "image_url"),
            },
        ),
        (
            "Classification",
            {
                "fields": ("category", "is_combo"),
                "description": "Category is hidden when this concession is a"
                + " Combo.",
            },
        ),
        (
            "Status & Ordering",
            {
                "fields": ("is_active", "priority"),
            },
        ),
    )
    list_display = (
        "name",
        "category",
        "is_combo",
        "is_active",
        "effective_active",
        "variants_count",
        "price_range",
        "combo_price_range",
    )
    list_select_related = ("category",)
    search_fields = ("name", "category__name")
    list_filter = ("category", "is_active", "is_combo", EffectiveActiveFilter)
    ordering = ("category__name", "name")
    autocomplete_fields = ("category",)
    actions = ("mark_active", "mark_inactive")
    inlines = (ConcessionVariantInline, ComboComponentInline)

    class Media:
        js = "admin/concession_toggle_category.js"

    def get_inline_instances(self, request, obj=None):
        """
        Show ComboComponentInline only when editing an existing combo
        concession.
        """
        instances = super().get_inline_instances(request, obj)
        if obj and not obj.is_combo:
            instances = [
                i for i in instances if not isinstance(i, ComboComponentInline)
            ]
        return instances

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related("category").annotate(
            variants_cnt=Count("variants", distinct=True),
            pmin=Min("variants__base_price"),
            pmax=Max("variants__base_price"),
            icpmin=Min("variants__in_combo_price"),
            icpmax=Max("variants__in_combo_price"),
        )

    @admin.display(ordering="variants_cnt", description="Variants")
    def variants_count(self, obj):
        return obj.variants_cnt

    @admin.display(description="Effective active")
    def effective_active(self, obj):
        return bool(obj.is_active and obj.category and obj.category.is_active)

    effective_active.boolean = True

    @admin.display(description="Price range")
    def price_range(self, obj):
        if obj.pmin is None:
            return "-"
        if obj.pmin == obj.pmax:
            return f"{obj.pmin}"
        return f"{obj.pmin} - {obj.pmax}"

    @admin.display(description="Combo price range")
    def combo_price_range(self, obj):
        if obj.icpmin is None:
            return "-"
        if obj.icpmin == obj.icpmax:
            return f"{obj.icpmin}"
        return f"{obj.icpmin} - {obj.icpmax}"

    @admin.action(description="Mark selected concessions as ACTIVE")
    def mark_active(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(
            request, f"{updated} concessions set to ACTIVE.", messages.SUCCESS
        )

    @admin.action(description="Mark selected concessions as INACTIVE")
    def mark_inactive(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(
            request,
            f"{updated} concessions set to INACTIVE.",
            messages.WARNING,
        )


class ConcessionVariantAdmin(HideSoftDeleteMixin, admin.ModelAdmin):
    list_display = (
        "sku",
        "name",
        "concession",
        "category_name",
        "base_price",
        "in_combo_price",
        "is_active",
    )
    list_editable = ("base_price", "in_combo_price", "is_active")
    list_select_related = ("concession", "concession__category")
    search_fields = (
        "sku",
        "name",
        "concession__name",
        "concession__category__name",
    )
    list_filter = ("is_active", "concession__category")
    ordering = ("concession__category__name", "concession__name", "name")
    autocomplete_fields = ("concession",)

    @admin.display(
        ordering="concession__category__name", description="Category"
    )
    def category_name(self, obj):
        return (
            obj.concession.category.name
            if obj.concession and obj.concession.category
            else "-"
        )


class ComboComponentAdmin(HideSoftDeleteMixin, admin.ModelAdmin):
    list_display = ("combo_concession", "variant", "quantity")
    search_fields = ("combo_concession__name", "variant__name", "variant__sku")
    list_filter = ("combo_concession__category",)
    autocomplete_fields = ("combo_concession", "variant")
    ordering = (
        "combo_concession__name",
        "variant__concession__name",
        "variant__name",
    )

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related(
            "combo_concession",
            "combo_concession__category",
            "variant",
            "variant__concession",
            "variant__concession__category",
        )


class ConcessionOrderAdmin(HideSoftDeleteMixin, admin.ModelAdmin):
    """
    Order page:
    - Inline items with auto-computed line totals
    - Recalculate totals on save + action
    """

    list_display = (
        "order_code",
        "sales_channel",
        "booking",
        "items_count",
        "order_total",
    )
    search_fields = ("order_code", "booking__id")
    list_filter = ("sales_channel",)
    ordering = ("-id",)
    inlines = (ConcessionItemInline,)
    raw_id_fields = ("booking",)
    date_hierarchy = "created_at"

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related("booking").annotate(
            items_cnt=Count("items", distinct=True),
        )

    @admin.display(ordering="items_cnt", description="Items")
    def items_count(self, obj):
        return obj.items_cnt

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        self._recalc_order_total(obj)

    def save_formset(self, request, form, formset, change):
        """
        Ensure item line_total is computed, then recompute order_total.
        """
        instances = formset.save(commit=False)
        for inst in instances:
            if isinstance(inst, ConcessionItem):
                inst.line_total = (inst.unit_price or Decimal("0")) * (
                    inst.quantity or 0
                )
            inst.save()
        for obj in formset.deleted_objects:
            obj.delete()
        formset.save_m2m()
        self._recalc_order_total(form.instance)

    @admin.action(description="Recalculate total for selected orders")
    def recalc_totals(self, request, queryset):
        updated = 0
        for order in queryset:
            if self._recalc_order_total(order, silent=True):
                updated += 1
        self.message_user(
            request,
            f"Recalculated totals for {updated} order(s).",
            messages.SUCCESS,
        )

    actions = ("recalc_totals",)

    def _recalc_order_total(self, order, silent=False):
        """
        Sum item.line_total; re-save order.order_total.
        Returns True if changed.
        """
        items = order.items.all()
        total = sum((i.line_total or Decimal("0")) for i in items)
        total = total.quantize(Decimal("0.01"))
        if order.order_total != total:
            order.order_total = total
            order.save(update_fields=["order_total"])
            # if not silent:
            #     self.message_user(
            #         None,
            #         f"Order {order.order_code}: order_total updated to"
            #         + f" {order.order_total}",
            #         level=messages.INFO,
            #     )
            return True
        return False


class ConcessionItemAdmin(HideSoftDeleteMixin, admin.ModelAdmin):
    list_display = (
        "order",
        "display_name",
        "variant",
        "quantity",
        "unit_price",
        "line_total",
        "notes",
    )
    search_fields = (
        "display_name",
        "variant__name",
        "variant__sku",
        "order__order_code",
    )
    list_filter = ("variant__concession__category",)
    ordering = ("-id",)
    autocomplete_fields = ("order", "variant")

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related(
            "order",
            "variant",
            "variant__concession",
            "variant__concession__category",
        )


admin_site.register(ConcessionCategory, ConcessionCategoryAdmin)
admin_site.register(Concession, ConcessionAdmin)
admin_site.register(ConcessionVariant, ConcessionVariantAdmin)
admin_site.register(ComboComponent, ComboComponentAdmin)
admin_site.register(ConcessionOrder, ConcessionOrderAdmin)
admin_site.register(ConcessionItem, ConcessionItemAdmin)
