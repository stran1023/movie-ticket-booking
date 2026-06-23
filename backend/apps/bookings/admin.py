from django.contrib import admin
from django.utils import timezone
from django.utils.html import format_html
from config.admin_site import admin_site
from django.urls import reverse

from .models import Booking, Ticket

# Define status colors
BOOKING_STATUS_COLORS = {
    "pending": "#f59e0b",      # orange/amber
    "confirmed": "#22c55e",    # green
    "cancelled": "#ef4444",    # red
    "completed": "#3b82f6",    # blue
    "refunded": "#6b7280",     # gray
    # Add any other statuses your Booking model uses
}

TICKET_STATUS_COLORS = {
    "available": "#22c55e",     # green
    "booked": "#f59e0b",        # orange
    "sold": "#3b82f6",          # blue
    "cancelled": "#ef4444",     # red
    "refunded": "#6b7280",      # gray
    # Add any other statuses your Ticket model uses
}


class TicketInline(admin.TabularInline):
    model = Ticket
    extra = 0
    
    # Add colored status to inline tickets
    def ticket_status_colored(self, obj):
        color = TICKET_STATUS_COLORS.get(obj.ticket_status_snapshot, "#6b7280")
        return format_html(
            '<span style="background: {}; color: white; padding: 3px 8px; '
            'border-radius: 12px; font-size: 11px; font-weight: 500;">{}</span>',
            color,
            obj.get_ticket_status_snapshot_display() if hasattr(obj, 'get_ticket_status_snapshot_display') else obj.ticket_status_snapshot
        )
    ticket_status_colored.short_description = "Status"
    
    # Override fields to include colored status
    fields = ("seat_label", "price", "ticket_status_snapshot", "ticket_status_colored")
    readonly_fields = ("ticket_status_colored",)


class BookingAdmin(admin.ModelAdmin):
    list_display = (
        "booking_code",
        "user_profile_id",
        "customer_name",
        "final_amount",
        "status_colored",
        "payment_method_colored",
        "created_at",
    )

    search_fields = (
        "booking_code",
        "customer_name",
        "customer_email",
        "user_profile_id__user__username",
    )

    list_filter = ("status", "payment_method", "created_at")

    ordering = ("-created_at",)

    #autocomplete_fields = ("user_profile_id", "promotion")
    autocomplete_fields = ("user_profile_id",)

    inlines = (TicketInline,)
    
    def status_colored(self, obj):
        """Display status with color badge"""
        color = BOOKING_STATUS_COLORS.get(obj.status, "#6b7280")
        return format_html(
            '<span style="background: {}; color: white; padding: 4px 10px; '
            'border-radius: 20px; font-size: 12px; font-weight: 600; '
            'display: inline-block;">{}</span>',
            color,
            obj.get_status_display() if hasattr(obj, 'get_status_display') else obj.status
        )
    status_colored.short_description = "Status"
    status_colored.admin_order_field = "status"  # Allows sorting by status
    
    def payment_method_colored(self, obj):
        colors = {
            "cash": "#10b981",      # emerald
            "card": "#3b82f6",       # blue
            "bank_transfer": "#8b5cf6", # purple
            "momo": "#ec4899",       # pink
            "vnpay": "#06b6d4",    # cyan
        }
        color = colors.get(obj.payment_method, "#6b7280")
        return format_html(
            '<span style="background: {}; color: white; padding: 2px 8px; '
            'border-radius: 4px; font-size: 11px;">{}</span>',
            color,
            obj.get_payment_method_display() if hasattr(obj, 'get_payment_method_display') else obj.payment_method
        )
    payment_method_colored.short_description = "Payment Method"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class TicketAdmin(admin.ModelAdmin):
    list_display = (
        "booking_info",
        "showtime_info",
        "seat_label",
        "price_colored",
        "ticket_status_colored",  # Changed from "ticket_status_snapshot"
    )

    search_fields = (
        "booking__booking_code",
        "seat_label",
    )

    list_filter = (
        "showtime",
        "seat_type_snapshot",
        "ticket_status_snapshot",
    )

    ordering = (
        "showtime",
        "seat_label",
    )
    
    def ticket_status_colored(self, obj):
        """Display ticket status with color badge"""
        color = TICKET_STATUS_COLORS.get(obj.ticket_status_snapshot, "#6b7280")
        status_display = obj.get_ticket_status_snapshot_display() if hasattr(obj, 'get_ticket_status_snapshot_display') else obj.ticket_status_snapshot
        
        return format_html(
            '<span style="background: {}; color: white; padding: 4px 10px; '
            'border-radius: 20px; font-size: 12px; font-weight: 600; '
            'display: inline-block;">{}</span>',
            color,
            status_display
        )
    ticket_status_colored.short_description = "Status"
    ticket_status_colored.admin_order_field = "ticket_status_snapshot"
    
    def booking_info(self, obj):
        """Display booking info without link"""
        if obj.booking:
            return f"{obj.booking.booking_code} ⏐ {obj.booking.customer_name}"
        return "-"
    booking_info.short_description = "Booking"
    
    def showtime_info(self, obj):
        """Format showtime info nicely"""
        if obj.showtime:
            return f"{timezone.localtime(obj.showtime.start_time).strftime('%d/%m %H:%M')} - Room {obj.showtime.cinema_room_id}"
        return "-"
    showtime_info.short_description = "Showtime"
    
    def price_colored(self, obj):
        """Format price with currency"""
        try:
            # Convert to float for number formatting
            price_value = float(obj.price) if obj.price else 0
            return format_html(
                '<span style="font-weight: 600; color: #059669;">{:,.0f}đ</span>',
                price_value
            )
        except (ValueError, TypeError):
            # Fallback if conversion fails
            return format_html(
                '<span style="font-weight: 600; color: #059669;">{}đ</span>',
                obj.price or 0
            )
        
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


admin_site.register(Booking, BookingAdmin)
admin_site.register(Ticket, TicketAdmin)