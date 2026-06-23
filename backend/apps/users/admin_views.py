# users/admin_views.py
from django.template.response import TemplateResponse
from django.urls import path
from config.admin_site import admin_site


def user_management_view(request):
    context = dict(
        admin_site.each_context(request),
        title="User Management",
    )
    return TemplateResponse(request, "admin/user_management.html", context)


# extend admin urls
def get_admin_urls(urls):
    def get_urls():
        custom_urls = [
            path(
                "user-management/",
                admin_site.admin_view(user_management_view),
                name="user-management",
            ),
        ]
        return custom_urls + urls
    return get_urls


admin_site.get_urls = get_admin_urls(admin_site.get_urls())