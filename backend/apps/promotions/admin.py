from config.admin_site import admin_site
from django import forms
from django.contrib import admin
from django.utils import timezone

# Register your models here.
from .models import (
    FlatPricePromotion,
    GlobalPromoSettings,
    MoviePromotion,
    PromoRedemption,
    PromotionType,
    UserPromotion,
)


class PromotionOrderWidget(forms.MultiWidget):
    """
    Renders N <select> elements, one per position.
    """

    def __init__(self, choices, num_positions=None, attrs=None):
        self.choices = list(choices)
        # if not specified, default to number of available types
        num_positions = num_positions or len(self.choices)

        widgets = [
            forms.Select(choices=[("", "— Select —")] + self.choices)
            for _ in range(num_positions)
        ]
        super().__init__(widgets, attrs)

    def decompress(self, value):
        """
        Incoming value is a list like ["USER", "MOVIE", ...]
        Return a fixed-length list matching the number of widgets.
        """
        if not value:
            value = []
        # Ensure the list matches widget count, pad with empty strings
        decompressed = list(value)[: len(self.widgets)]
        while len(decompressed) < len(self.widgets):
            decompressed.append("")
        return decompressed


class PromotionOrderField(forms.MultiValueField):
    """
    Validates that there are no duplicates and returns a compact list
    (without blanks) as the compressed value.
    """

    def __init__(self, choices, num_positions=None, *args, **kwargs):
        # Each subfield is a ChoiceField sharing the same choices
        fields = [
            forms.ChoiceField(
                choices=[("", "— Select —")] + list(choices), required=False
            )
            for _ in range(num_positions or len(list(choices)))
        ]
        super().__init__(fields, *args, **kwargs)
        self.choices = [c[0] for c in choices]

    def compress(self, data_list):
        """
        Convert the list of selects to a compact ordered list without blanks.
        """
        if not data_list:
            return []

        # filter out blanks while preserving order
        ordered = [v for v in data_list if v]
        # validate duplicates
        seen = set()
        dups = [v for v in ordered if (v in seen or seen.add(v))]
        if dups:
            raise forms.ValidationError(
                "Duplicate types are not allowed: %s" % ", ".join(sorted(set(dups)))
            )

        # validate allowed values
        unknown = [v for v in ordered if v not in self.choices]
        if unknown:
            raise forms.ValidationError("Unknown type(s): %s" % ", ".join(unknown))

        return ordered


# admin.py


class GlobalPromoSettingsAdminForm(forms.ModelForm):
    # Replace the raw JSON with a multi-select (one dropdown per position)
    stacking_order = PromotionOrderField(
        choices=PromotionType.choices,  # [('USER', 'User'), ('MOVIE','Movie'), ...]
        num_positions=None,  # or set an int (e.g., 3) to cap the number of dropdowns
        required=False,
    )

    class Meta:
        model = GlobalPromoSettings
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # Attach the widget with same config as the field
        self.fields["stacking_order"].widget = PromotionOrderWidget(
            choices=PromotionType.choices,
            num_positions=None,  # or an int to cap length
        )

        # Pre-fill the initial value from the instance
        if self.instance and self.instance.stacking_order:
            self.fields["stacking_order"].initial = self.instance.stacking_order

    def save(self, commit=True):
        obj = super().save(commit=False)
        # The MultiValueField already returns a clean list in .cleaned_data
        obj.stacking_order = self.cleaned_data["stacking_order"] or []
        if commit:
            obj.save()
        return obj


class GlobalPromoSettingsAdmin(admin.ModelAdmin):
    form = GlobalPromoSettingsAdminForm

@admin.register(MoviePromotion, site=admin_site)
class PromotionAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "title",
        "discount_type",
        "discount_value",
        "applicable_movies_count",
        "start_date",
        "end_date",
        "is_active",
        "total_redeemed",
        "banner_url",
    )
    list_filter = (
        "discount_type",
        "start_date",
        "end_date",
    )
    search_fields = ("code", "title")
    readonly_fields = ("total_redeemed", "created_at", "updated_at")
    ordering = ("-created_at",)

    fieldsets = (
        (
            "Promotion Info",
            {
                "fields": (
                    "title",
                    "code",
                    "description",
                )
            },
        ),
        (
            "Media",
            {"fields": ("banner_url",)},
        ),
        (
            "Discount",
            {
                "fields": (
                    "discount_type",
                    "discount_value",
                    "max_discount_cap",
                )
            },
        ),
        (
            "Movie Scope",
            {
                "fields": (
                    "movie",
                )
            },
        ),
        (
            "Validity",
            {
                "fields": (
                    "start_date",
                    "end_date",
                )
            },
        ),
        (
            "Stats",
            {
                "fields": (
                    "usage_limit",
                    "used_count",
                    "total_redeemed",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )

    def applicable_movies_count(self, obj: MoviePromotion) -> str:
        # For current schema: a single FK behaves like
        # 0 => global, 1 => scoped to a movie.
        return "All" if obj.movie_id is None else "1"

    applicable_movies_count.short_description = "Applicable movies"

    def is_active(self, obj: MoviePromotion) -> bool:
        today = timezone.now().date()
        return obj.start_date <= today <= obj.end_date

    is_active.boolean = True

    def total_redeemed(self, obj: MoviePromotion) -> int:
        return obj.redemptions.count()

    total_redeemed.short_description = "Total redeemed"

    actions = ["deactivate_selected_promotions"]

    def deactivate_selected_promotions(self, request, queryset):
        queryset.update(end_date=timezone.now().date())

    deactivate_selected_promotions.short_description = (
        "Deactivate selected promotions"
    )


@admin.register(UserPromotion, site=admin_site)
class UserPromotionAdmin(admin.ModelAdmin):
    list_display = ("title", "discount_type", "discount_value", "start_date", "end_date")
    list_filter = ("discount_type", "start_date", "end_date")
    search_fields = ("title",)


@admin.register(GlobalPromoSettings, site=admin_site)
class GlobalPromoSettingsRegisteredAdmin(GlobalPromoSettingsAdmin):
    pass


@admin.register(FlatPricePromotion, site=admin_site)
class FlatPricePromotionAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "flat_price",
        "seat_scope",
        "cinema_version",
        "recurring_weekday_display",
        "start_date",
        "end_date",
        "is_active",
        "created_at",
    )
    list_filter = ("is_active", "seat_scope", "cinema_version", "recurring_weekday")
    search_fields = ("title", "description")
    readonly_fields = ("created_at", "updated_at")
    ordering = ("-created_at",)
    actions = ["activate_selected", "deactivate_selected"]

    fieldsets = (
        (
            "Promotion Info",
            {"fields": ("title", "description", "small_description")},
        ),
        (
            "Media",
            {"fields": ("banner_url",)},
        ),
        (
            "Pricing",
            {"fields": ("flat_price",)},
        ),
        (
            "Scope",
            {"fields": ("seat_scope", "cinema_version")},
        ),
        (
            "Schedule",
            {
                "fields": ("recurring_weekday", "start_date", "end_date"),
                "description": (
                    "Set weekday for weekly recurrence (e.g. Wednesday). "
                    "Set date range for holiday periods. Both can be combined. "
                    "Leave all blank for an always-on promotion (controlled only by Is Active)."
                ),
            },
        ),
        (
            "Status",
            {"fields": ("is_active",)},
        ),
        (
            "Timestamps",
            {"fields": ("created_at", "updated_at"), "classes": ("collapse",)},
        ),
    )

    @admin.display(description="Recurring weekday", ordering="recurring_weekday")
    def recurring_weekday_display(self, obj: FlatPricePromotion) -> str:
        if obj.recurring_weekday is None:
            return "—"
        return obj.get_recurring_weekday_display()

    @admin.action(description="Deactivate selected promotions")
    def deactivate_selected(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f"{updated} promotion(s) deactivated.")

    @admin.action(description="Activate selected promotions")
    def activate_selected(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f"{updated} promotion(s) activated.")


@admin.register(PromoRedemption, site=admin_site)
class PromoRedemptionAdmin(admin.ModelAdmin):
    list_display = ("user", "promo_code", "booking", "created_at")
    list_filter = ("promo_code", "created_at")
    search_fields = ("user__username", "user__email", "promo_code__code")
    readonly_fields = ("user", "promo_code", "booking", "created_at", "updated_at")
    ordering = ("-created_at",)
    date_hierarchy = "created_at"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
