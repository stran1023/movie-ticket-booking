from django.contrib import admin
from config.admin_site import admin_site

from .models import ContactMessage


class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ["name", "email", "phone", "message", "created_at"]
    search_fields = ["name", "email", "phone"]
    readonly_fields = ["name", "email", "phone", "message", "created_at"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


admin_site.register(ContactMessage, ContactMessageAdmin)