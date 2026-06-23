from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.utils.html import format_html
from django.urls import reverse
from django.db.models import Sum, Count
from config.admin_site import admin_site
from .models import (
    PointHistory, PointRedemptionConfig, PointTransaction,
    User, UserPoint, UserProfile,
)
from django.contrib.auth.models import Group
from django.contrib.auth.admin import GroupAdmin

admin_site.register(Group, GroupAdmin)


class PointHistoryInline(admin.TabularInline):
    model = PointHistory
    extra = 0
    fields = ("booking", "point_type", "points_amount", "description", "created_at")
    readonly_fields = ("created_at",)
    can_delete = False
    
    def has_add_permission(self, request, obj):
        return False


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    fieldsets = (
        ("Personal Information", {
            "fields": ("full_name", "date_of_birth", "gender", "avatar_preview")
        }),
        ("Contact Information", {
            "fields": ("phone_number", "email_display")
        }),
        ("Identity", {
            "fields": ("identity_card",)
        }),
        ("Address", {
            "fields": ("street_address", "ward", "province")
        }),
        ("Loyalty Program", {
            "fields": ("total_points",)
        }),
    )
    readonly_fields = ("total_points", "avatar_preview", "email_display")
    
    def avatar_preview(self, obj):
        if obj.avatar:
            return format_html(
                '<img src="{}" style="width: 100px; height: 100px; object-fit: cover; '
                'border-radius: 50%; border: 2px solid #e2e8f0;" />',
                obj.avatar.url
            )
        elif obj.avatar_url:
            return format_html(
                '<img src="{}" style="width: 100px; height: 100px; object-fit: cover; '
                'border-radius: 50%; border: 2px solid #e2e8f0;" />',
                obj.avatar_url
            )
        return "No avatar"
    avatar_preview.short_description = "Avatar Preview"
    
    def email_display(self, obj):
        return obj.user.email
    email_display.short_description = "Email"


class CustomUserAdmin(DjangoUserAdmin):
    list_display = ("username", "email", "is_active", "is_staff", "date_joined")
    list_filter = ("is_active", "is_staff", "date_joined")
    search_fields = ("username", "email", "profile__full_name", "profile__phone_number")
    ordering = ("-date_joined",)
    
    fieldsets = (
        (None, {"fields": ("username", "password")}),
        ("Personal Info", {"fields": ("email",)}),
        ("Permissions", {
            "fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions"),
        }),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )
    
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("username", "email", "password1", "password2"),
            },
        ),
    )
    
    inlines = (UserProfileInline,)
    
    actions = ["activate_users", "deactivate_users"]
    
    def activate_users(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f"{updated} users activated.")
    activate_users.short_description = "Activate selected users"
    
    def deactivate_users(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f"{updated} users deactivated.")
    deactivate_users.short_description = "Deactivate selected users"


class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("full_name", "identity_card", "phone_number", "total_points", "booking_count")
    list_select_related = ("user",)
    search_fields = ("full_name", "phone_number", "identity_card",)
    list_filter = ("gender", "date_of_birth")
    ordering = ("-created_at",)
    readonly_fields = ("total_points", "avatar_preview", "point_history_summary")
    
    fieldsets = (
        ("Personal Information", {
            "fields": ("full_name", "date_of_birth", "gender", "avatar_preview")
        }),
        ("Contact Details", {
            "fields": ("phone_number",)
        }),
        ("Identity", {
            "fields": ("identity_card",)
        }),
        ("Address", {
            "fields": ("street_address", "ward", "province")
        }),
        ("Loyalty Program", {
            "fields": ("total_points", "point_history_summary")
        }),
    )
    
    inlines = (PointHistoryInline,)
    
    def avatar_preview(self, obj):
        if obj.avatar:
            return format_html(
                '<img src="{}" style="width: 150px; height: 150px; object-fit: cover; '
                'border-radius: 50%; border: 3px solid #e2e8f0;" />',
                obj.avatar.url
            )
        elif obj.avatar_url:
            return format_html(
                '<img src="{}" style="width: 150px; height: 150px; object-fit: cover; '
                'border-radius: 50%; border: 3px solid #e2e8f0;" />',
                obj.avatar_url
            )
        return "No avatar uploaded"
    avatar_preview.short_description = "Avatar Preview"
    
    def booking_count(self, obj):
        count = obj.point_histories.values('booking').distinct().count()
        return format_html('<span style="font-weight: 600;">{}</span>', count)
    booking_count.short_description = "Bookings"
    booking_count.admin_order_field = "booking_count"
    
    def point_history_summary(self, obj):
        # Get point summary
        accumulated = obj.point_histories.filter(
            point_type=PointHistory.Type.ACCUMULATE
        ).aggregate(total=Sum('points_amount'))['total'] or 0
        
        redeemed = obj.point_histories.filter(
            point_type=PointHistory.Type.REDEEM
        ).aggregate(total=Sum('points_amount'))['total'] or 0
        
        return format_html(
            '<div style="background: #f8fafc; padding: 12px; border-radius: 6px;">'
            '<p><strong>Total Accumulated:</strong> <span style="color: #059669;">+{}</span> pts</p>'
            '<p><strong>Total Redeemed:</strong> <span style="color: #dc2626;">{}</span> pts</p>'
            '<p><strong>Current Balance:</strong> <span style="font-weight: 600;">{}</span> pts</p>'
            '<p><strong>Total Transactions:</strong> {}</p>'
            '</div>',
            accumulated,
            redeemed,
            obj.total_points,
            obj.point_histories.count()
        )
    point_history_summary.short_description = "Point Summary"
    
    actions = ["add_points", "export_profiles"]
    
    def add_points(self, request, queryset):
        # This would need a custom form/intermediate page
        for profile in queryset:
            # Example: Add 100 points to selected profiles
            profile.total_points += 100
            profile.save()
        self.message_user(request, f"Added 100 points to {queryset.count()} profiles.")
    add_points.short_description = "Add 100 points to selected profiles"
    
    def export_profiles(self, request, queryset):
        # This would export to CSV
        self.message_user(request, "Export functionality would go here.")
    export_profiles.short_description = "Export selected profiles"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class PointHistoryAdmin(admin.ModelAdmin):
    list_display = ("id", "booking_link", "point_type_colored", "points_amount_colored", "description_short", "created_at")
    list_filter = ("point_type", "created_at")
    search_fields = ("user_profile__full_name", "user_profile__user__email", "booking__booking_code")
    readonly_fields = ("created_at", "updated_at")
    list_per_page = 50
    date_hierarchy = "created_at"
    
    fieldsets = (
        ("Transaction Details", {
            "fields": ("booking_link_detail",)
        }),
        ("Point Information", {
            "fields": ("point_type", "points_amount")
        }),
        ("Description", {
            "fields": ("description",)
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at")
        }),
    )
    
    def booking_link(self, obj):
        url = reverse('admin:bookings_booking_change', args=[obj.booking.id])
        return format_html('<a href="{}">Booking #{}</a>', url, obj.booking.id)
    booking_link.short_description = "Booking"
    
    def booking_link_detail(self, obj):
        url = reverse('admin:bookings_booking_change', args=[obj.booking.id])
        return format_html(
            '<a href="{}">Booking #{} - {}</a>',
            url, obj.booking.id, obj.booking.booking_code if hasattr(obj.booking, 'booking_code') else ''
        )
    booking_link_detail.short_description = "Booking"
    
    def point_type_colored(self, obj):
        colors = {
            "ACCUMULATE": "#22c55e",  # green
            "REDEEM": "#ef4444",      # red
        }
        color = colors.get(obj.point_type, "#6b7280")
        return format_html(
            '<span style="background: {}; color: white; padding: 4px 8px; '
            'border-radius: 12px; font-size: 11px; font-weight: 500;">{}</span>',
            color,
            obj.get_point_type_display()
        )
    point_type_colored.short_description = "Type"
    
    def points_amount_colored(self, obj):
        if obj.points_amount > 0:
            color = "#059669"  # green
            sign = "+"
        elif obj.points_amount < 0:
            color = "#dc2626"  # red
            sign = "-"
        else:
            color = "#6b7280"  # gray
            sign = ""
        
        return format_html(
            '<span style="font-weight: 600; color: {};">{}{:,} pts</span>',
            color, sign, abs(obj.points_amount)
        )
    points_amount_colored.short_description = "Points"
    
    def description_short(self, obj):
        if len(obj.description) > 50:
            return obj.description[:50] + "..."
        return obj.description or "—"
    description_short.short_description = "Description"
    
    def has_add_permission(self, request):
        # Point history should only be created programmatically
        return False
    
    def has_change_permission(self, request, obj=None):
        # Point history shouldn't be editable
        return False
    
    def has_delete_permission(self, request, obj=None):
        return False


# ── UserPoint Admin ───────────────────────────────────────────────────


class UserPointAdmin(admin.ModelAdmin):
    list_display = ("user", "balance", "total_earned", "total_redeemed", "updated_at")
    search_fields = ("user__username", "user__email")
    readonly_fields = ("total_earned", "total_redeemed", "updated_at")
    ordering = ("-balance",)

    actions = ["reset_balance_to_zero"]

    def save_model(self, request, obj, form, change):
        if change and "balance" in form.changed_data:
            old_balance = UserPoint.objects.get(pk=obj.pk).balance
            diff = obj.balance - old_balance
            super().save_model(request, obj, form, change)
            PointTransaction.objects.create(
                user=obj.user,
                transaction_type=PointTransaction.TransactionType.ADJUST,
                points=diff,
                balance_after=obj.balance,
                note=f"Admin adjustment by {request.user.username}",
            )
            # Keep legacy total_points in sync
            profile = getattr(obj.user, "profile", None)
            if profile:
                profile.total_points = obj.balance
                profile.save(update_fields=["total_points"])
        else:
            super().save_model(request, obj, form, change)

    def reset_balance_to_zero(self, request, queryset):
        for user_point in queryset:
            if user_point.balance == 0:
                continue
            old_balance = user_point.balance
            user_point.balance = 0
            user_point.save(update_fields=["balance", "updated_at"])
            PointTransaction.objects.create(
                user=user_point.user,
                transaction_type=PointTransaction.TransactionType.ADJUST,
                points=-old_balance,
                balance_after=0,
                note=f"Balance reset to zero by {request.user.username}",
            )
            profile = getattr(user_point.user, "profile", None)
            if profile:
                profile.total_points = 0
                profile.save(update_fields=["total_points"])
        self.message_user(request, f"Reset balance to zero for {queryset.count()} user(s).")
    reset_balance_to_zero.short_description = "Reset balance to zero"


# ── PointTransaction Admin ───────────────────────────────────────────


class PointTransactionAdmin(admin.ModelAdmin):
    list_display = (
        "user", "transaction_type", "points", "balance_after",
        "booking", "note", "created_at",
    )
    list_filter = ("transaction_type", "created_at")
    search_fields = ("user__username", "note")
    readonly_fields = (
        "user", "transaction_type", "points", "balance_after",
        "booking", "note", "created_at",
    )
    ordering = ("-created_at",)
    date_hierarchy = "created_at"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


# ── PointRedemptionConfig Admin ──────────────────────────────────────


class PointRedemptionConfigAdmin(admin.ModelAdmin):
    list_display = (
        "max_redeem_percentage", "min_points_to_redeem",
        "points_per_vnd", "is_active", "updated_at", "updated_by",
    )
    readonly_fields = ("updated_at", "updated_by")

    def has_add_permission(self, request):
        return not PointRedemptionConfig.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False

    def save_model(self, request, obj, form, change):
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)


# Register all models
admin_site.register(User, CustomUserAdmin)
admin_site.register(UserProfile, UserProfileAdmin)
admin_site.register(PointHistory, PointHistoryAdmin)
admin_site.register(UserPoint, UserPointAdmin)
admin_site.register(PointTransaction, PointTransactionAdmin)
admin_site.register(PointRedemptionConfig, PointRedemptionConfigAdmin)