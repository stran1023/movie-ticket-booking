from debug_toolbar.toolbar import debug_toolbar_urls
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from django.views.generic import RedirectView
from drf_yasg import openapi
from drf_yasg.views import get_schema_view
from rest_framework import permissions
from .admin_site import admin_site

schema_view = get_schema_view(
    openapi.Info(
        title="Ticket booking API",
        default_version="v1",
        description="API documentation for Cinema ticket booking app",
        contact=openapi.Contact(email="contact@notes.local"),
        license=openapi.License(name="BSD License"),
    ),
    public=True,
    permission_classes=(permissions.AllowAny,),
)

urlpatterns = [
    path("", RedirectView.as_view(url="/admin/dashboard/", permanent=False)),
    path("admin/", admin_site.urls),
    path("api/", include("apps.movies.urls")),
    path("api/", include("apps.bookings.urls")),
    path("api/", include("apps.cinemas.urls")),
    path("api/concessions/", include("apps.concessions.urls")),
    path("api/", include("apps.users.urls")),
    path("api/", include("apps.contacts.urls")),
    path("api/", include("apps.promotions.urls")),
    path(
        "swagger/",
        schema_view.with_ui("swagger", cache_timeout=0),
        name="schema-swagger-ui",
    ),
] + debug_toolbar_urls()

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
