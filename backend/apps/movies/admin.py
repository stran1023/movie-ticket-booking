from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.conf import settings
from import_export import resources
from import_export.admin import ImportExportModelAdmin
import os
from config.admin_site import admin_site

from .models import Movie, Version, MovieReminder


# 1. Define the Resource for Import/Export
class MovieResource(resources.ModelResource):
    class Meta:
        model = Movie
        import_id_fields = ("id",)
        fields = (
            "id",
            "title",
            "description",
            "poster_file",
            "trailer_url",
            "duration",
            "release_date",
            "end_date",
            "status",
            "label",
            "directors",
            "casts",
            "genres",
            "languages_subtitles",
            "is_deleted",
        )
        exclude = ("search_title",)


# 2. Change admin.ModelAdmin to ImportExportModelAdmin
class MovieAdmin(ImportExportModelAdmin):
    resource_class = MovieResource

    class Media:
        css = {"all": ("css/import_fix.css",)}
        js = ("js/import_fix.js",)

    # Customize list display with poster preview
    list_display = (
        "poster_preview",
        "title",
        "duration",
        "release_date",
        "status",
        "is_deleted",
    )
    list_display_links = ("poster_preview", "title")

    # Add pagination
    list_per_page = 25
    list_max_show_all = 200

    # Search fields
    search_fields = ("title", "directors", "casts", "description")

    # Filters
    list_filter = ("release_date", "status", "label", "is_deleted", "versions")

    # Many-to-many widget
    filter_horizontal = ("versions",)

    # Date hierarchy
    date_hierarchy = "release_date"

    # Default ordering
    ordering = ("-release_date", "title")

    # Fieldsets for better organization
    fieldsets = (
        (
            "Basic Information",
            {
                "fields": (
                    "title",
                    "description",
                    "poster_file",
                    "trailer_url",
                    "duration",
                    "status",
                    "label",
                )
            },
        ),
        ("Cast & Crew", {"fields": ("directors", "casts", "genres")}),
        (
            "Release Information",
            {"fields": ("release_date", "end_date", "languages_subtitles")},
        ),
        ("Relationships", {"fields": ("versions",)}),
    )

    # Read-only fields
    readonly_fields = ("search_title",)

    # List editable fields
    list_editable = ("status", "is_deleted")

    # Actions
    actions = ["mark_as_now_showing", "mark_as_coming_soon", "mark_as_ended"]

    def get_poster_url(self, filename):
        """Generate the correct URL for poster images"""
        if not filename:
            return None
        return f"{settings.STATIC_URL}posters/{filename}"

    def poster_preview(self, obj):
        """Show a thumbnail preview of the poster in the list view"""
        if obj.poster_file:
            static_dir = os.path.join(settings.BASE_DIR, "static", "posters")
            possible_extensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"]

            for ext in possible_extensions:
                file_path = os.path.join(static_dir, f"{obj.poster_file}{ext}")
                if os.path.exists(file_path):
                    poster_url = f"{settings.STATIC_URL}posters/{obj.poster_file}{ext}"
                    return format_html(
                        '<img src="{}" style="width: 50px; height: 70px; object-fit: cover; border-radius: 4px;" '
                        "onerror=\"this.style.display='none'\" />",
                        poster_url,
                    )
            return format_html(
                '<span style="color: #999;" title="File not found: {}.jpg/png"> No image</span>',
                obj.poster_file,
            )
        return format_html('<span style="color: #999;">No poster</span>')

    poster_preview.short_description = "Poster"

    def mark_as_now_showing(self, request, queryset):
        updated = queryset.update(status="NOW_SHOWING")
        self.message_user(request, f"{updated} movies marked as Now Showing")

    mark_as_now_showing.short_description = "Mark selected movies as Now Showing"

    def mark_as_coming_soon(self, request, queryset):
        updated = queryset.update(status="COMING_SOON")
        self.message_user(request, f"{updated} movies marked as Coming Soon")

    mark_as_coming_soon.short_description = "Mark selected movies as Coming Soon"

    def mark_as_ended(self, request, queryset):
        updated = queryset.update(status="ENDED")
        self.message_user(request, f"{updated} movies marked as Ended")

    mark_as_ended.short_description = "Mark selected movies as Ended"

    def get_queryset(self, request):
        return (
            super().get_queryset(request).select_related().prefetch_related("versions")
        )

    def changelist_view(self, request, extra_context=None):
        extra_context = extra_context or {}
        extra_context["total_movies"] = Movie.objects.count()
        extra_context["now_showing"] = Movie.objects.filter(
            status="NOW_SHOWING"
        ).count()
        extra_context["coming_soon"] = Movie.objects.filter(
            status="COMING_SOON"
        ).count()
        extra_context["ended"] = Movie.objects.filter(status="ENDED").count()
        return super().changelist_view(request, extra_context=extra_context)


class VersionAdmin(admin.ModelAdmin):
    list_display = ("name", "movie_count", "created_at", "updated_at")
    search_fields = ("name",)
    list_per_page = 50

    def movie_count(self, obj):
        count = obj.movies.count()
        color = "green" if count > 0 else "#999"
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span> {}',
            color,
            count,
            "movie" + ("s" if count != 1 else ""),
        )

    movie_count.short_description = "Movies"


# Register with custom admin site
admin_site.register(Movie, MovieAdmin)
admin_site.register(Version, VersionAdmin)
