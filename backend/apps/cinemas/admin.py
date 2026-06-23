import unicodedata, json
from datetime import date, timedelta

from apps.movies.models import Movie, Version
from config.admin_site import admin_site
from django import forms
from django.contrib import admin, messages
from django.core.exceptions import ValidationError
from django.db import models
from django.template.response import TemplateResponse
from django.urls import path
from django.utils import timezone
from django.utils.html import format_html, mark_safe

from .models import LOCKOUT_MINUTES, CinemaRoom, Showtime

SEAT_COLORS = {
    "normal": "#4ade80",
    "vip": "#facc15",
    "couple": "#f472b6",
}
STATUS_COLORS = {
    "available": "",
    "broken": "#ef4444",
    "maintenance": "#fb923c",
}


class CinemaRoomAdminForm(forms.ModelForm):
    change_form_template = "admin/cinemas/cinemaroom/change_form.html"

    class Meta:
        model = CinemaRoom
        fields = "__all__"
        widgets = {
            "seat_map": forms.HiddenInput(),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.fields["name"].widget.attrs.update({"class": "vTextField"})
        self.fields["room_type"].widget.attrs.update({"class": "vTextField"})

        self.fields["seat_map"].help_text = (
            "Use the visual editor below to design your cinema layout. "
            "Click on empty cells to add normal, VIP, or couple seats. "
            "Couple seats combine two adjacent seats into one. "
            "Rows cannot mix couple seats with normal or VIP seats. "
            "Add Row/Column creates empty cells. Total seats cannot exceed 200."
        )

        # Filter assigned movies based on room type
        room_type = None
        if self.instance and self.instance.pk:
            room_type = self.instance.room_type

        allowed_versions = []
        if room_type == "2D":
            allowed_versions = ["2D"]
        elif room_type == "3D":
            allowed_versions = ["2D", "3D"]
        elif room_type == "IMAX":
            allowed_versions = ["2D", "IMAX"]

        if allowed_versions:
            self.fields["assigned_movies"].queryset = Movie.objects.filter(
                versions__name__in=allowed_versions, is_deleted=False
            ).distinct()


class CinemaRoomAdmin(admin.ModelAdmin):
    form = CinemaRoomAdminForm
    list_display = (
        "name",
        "room_type",
        "total_seats",
        "assigned_movie_list",
        "is_deleted",
    )
    ordering = (
        "name",
        "room_type",
        "total_seats",
    )
    filter_horizontal = ("assigned_movies",)
    readonly_fields = ("total_seats", "seat_map_preview")
    formfield_overrides = {models.JSONField: {"widget": forms.HiddenInput}}
    fieldsets = (
        (
            None,
            {
                "fields": ("name", "room_type", "total_seats", "is_deleted"),
                "description": "Basic room information",
            },
        ),
        (
            "Movie Assignment",
            {
                "fields": ("assigned_movies",),
                "description": "Select movies that can be shown in this room",
            },
        ),
        (
            "Seat Map",
            {
                "fields": ("seat_map", "seat_map_preview"),
                "description": "Design your seat layout using the visual editor below",
            },
        ),
    )

    def assigned_movie_list(self, obj):
        titles = obj.assigned_movies.filter(is_deleted=False).values_list(
            "title", flat=True
        )
        return ", ".join(titles) or "—"

    assigned_movie_list.short_description = "Assigned Movies"

    def seat_map_preview(self, obj):
        seat_map = obj.seat_map or []
        if not seat_map:
            return "No seats configured."

        # Define colors for seat types
        seat_colors = {
            "normal": "#007bff",
            "vip": "#ffc107",
            "couple": "#e83e8c",
        }

        # Check if this is flat format or map format
        is_flat_format = len(seat_map) > 0 and "x" not in seat_map[0]

        if is_flat_format:
            # Convert flat format to map format for preview
            preview_map = self._convert_flat_to_preview_map(seat_map)
        else:
            preview_map = seat_map

        # Get dimensions
        max_x = max([t.get("x", 0) for t in preview_map] + [0])
        max_y = max([t.get("y", 0) for t in preview_map] + [0])

        # Build HTML preview that matches the designer
        html_parts = [
            '<div style="font-family: monospace; margin: 10px 0;">',
            '<div style="margin-bottom: 10px;"><strong>Legend:</strong> '
            '<span style="display:inline-block; width:20px; height:20px; background:#007bff; border-radius:4px; margin:0 5px;"></span> Normal '
            '<span style="display:inline-block; width:20px; height:20px; background:#ffc107; border-radius:4px; margin:0 5px;"></span> VIP '
            '<span style="display:inline-block; width:40px; height:20px; background:#e83e8c; border-radius:4px; margin:0 5px;"></span> Couple '
            "</div>",
            '<div style="display: flex; flex-direction: column; gap: 4px; background: #f8f9fa; padding: 15px; border-radius: 8px;">',
            '<div style="background: #2c3e50; color: white; text-align: center; padding: 8px; border-radius: 4px; margin-bottom: 10px; font-weight: bold;">SCREEN</div>',
        ]

        # Group by row for display
        rows_dict = {}
        for y in range(1, max_y + 1):
            rows_dict[y] = []
            for x in range(1, max_x + 1):
                # Check if this position is part of a couple seat
                left_tile = next(
                    (
                        t
                        for t in preview_map
                        if t.get("x") == x - 1
                        and t.get("y") == y
                        and t.get("kind") == "seat"
                        and t.get("type") == "couple"
                    ),
                    None,
                )
                if left_tile:
                    continue  # Skip right half

                tile = next(
                    (t for t in preview_map if t.get("x") == x and t.get("y") == y),
                    None,
                )
                rows_dict[y].append(tile)

        # Display rows
        for y in sorted(rows_dict.keys()):
            # Convert y to row letter (1 -> A, 2 -> B, etc.)
            if 1 <= y <= 26:
                row_label = chr(
                    64 + y
                )  # 65 is 'A' in ASCII, so 64 + y gives correct letter
            else:
                row_label = f"Row{y}"

            row_html = [
                '<div style="display: flex; align-items: center; gap: 4px; margin: 2px 0;">'
            ]
            row_html.append(
                f'<span style="font-weight: bold; width: 30px;">{row_label}</span>'
            )

            for tile in rows_dict[y]:
                if tile and tile.get("kind") == "seat":
                    seat_type = tile.get("type", "normal")
                    bg_color = seat_colors.get(seat_type, "#ccc")

                    if seat_type == "couple":
                        # Couple seat spans 2 columns
                        seat_number = tile.get("number", "")
                        seat_end = tile.get("endNumber", "")
                        if seat_number and seat_end:
                            display_text = (
                                f"{row_label}{seat_number}-{row_label}{seat_end}"
                            )
                        else:
                            display_text = "♥♥"
                        row_html.append(
                            f'<span style="display:inline-flex; align-items:center; justify-content:center; '
                            f"width:50px; height:24px; background:{bg_color}; border-radius:4px; "
                            f"margin:2px; color:white; font-size:10px; font-weight:bold; "
                            f'box-shadow:0 2px 4px rgba(0,0,0,0.1);" '
                            f'title="Couple Seat {row_label}{seat_number}-{row_label}{seat_end}">'
                            f"{display_text}</span>"
                        )
                    else:
                        # Normal or VIP seat
                        seat_number = tile.get("number", "")
                        row_html.append(
                            f'<span style="display:inline-flex; align-items:center; justify-content:center; '
                            f"width:24px; height:24px; background:{bg_color}; border-radius:4px; "
                            f"margin:2px; color:white; font-size:11px; font-weight:bold; "
                            f'box-shadow:0 2px 4px rgba(0,0,0,0.1);" '
                            f'title="Seat {row_label}{seat_number}">{seat_number}</span>'
                        )

            row_html.append("</div>")
            html_parts.extend(row_html)

        html_parts.append("</div></div>")
        return mark_safe("".join(html_parts))

    def _convert_flat_to_preview_map(self, flat_list):
        """Convert flat format to preview map format"""
        preview_map = []
        rows = {}

        # Group by row
        for seat in flat_list:
            if seat["row"] not in rows:
                rows[seat["row"]] = []
            rows[seat["row"]].append(seat)

        # Sort rows alphabetically
        sorted_rows = sorted(rows.keys())

        for row_idx, row_letter in enumerate(sorted_rows):
            y = row_idx + 1
            seats = sorted(rows[row_letter], key=lambda s: s["number"])
            x = 1

            i = 0
            while i < len(seats):
                seat = seats[i]
                if seat["type"] == "couple":
                    # Check if this is the first of a pair
                    if seat["number"] % 2 == 1:
                        preview_map.append(
                            {
                                "x": x,
                                "y": y,
                                "kind": "seat",
                                "type": "couple",
                                "row": row_letter,
                                "number": seat["number"],
                                "endNumber": seat["number"] + 1,
                            }
                        )
                        x += 2
                        i += 2  # Skip the next seat as it's the second of the couple
                    else:
                        i += 1
                else:
                    preview_map.append(
                        {
                            "x": x,
                            "y": y,
                            "kind": "seat",
                            "type": seat["type"],
                            "row": row_letter,
                            "number": seat["number"],
                        }
                    )
                    x += 1
                    i += 1
        return preview_map
    seat_map_preview.short_description = "Seat Map Preview"


    def save_model(self, request, obj, form, change):
        # Check for mixed rows before saving
        seat_map = obj.seat_map or []
        rows_with_issues = []

        # Group by row with proper tracking
        rows = {}
        for tile in seat_map:
            if tile.get("kind") != "seat":
                continue
            y = tile.get("y")
            seat_type = tile.get("type")
            if y not in rows:
                rows[y] = {"has_couple": False, "has_normal": False, "has_vip": False}

            if seat_type == "couple":
                rows[y]["has_couple"] = True
            elif seat_type == "normal":
                rows[y]["has_normal"] = True
            elif seat_type == "vip":
                rows[y]["has_vip"] = True

        for y, types in rows.items():
            # Check if row has couple AND (normal OR vip)
            if types["has_couple"] and (types["has_normal"] or types["has_vip"]):
                if 1 <= y <= 26:
                    row_label = chr(64 + y)
                else:
                    row_label = f"Row {y}"
                rows_with_issues.append(row_label)

        if rows_with_issues:
            # Add error message
            messages.error(
                request,
                f"Cannot save: Row(s) {', '.join(rows_with_issues)} mix couple seats with normal/VIP seats",
            )
            # THIS IS CRITICAL - raise an exception to真正 prevent save
            raise ValidationError(
                f"Cannot save: Row(s) {', '.join(rows_with_issues)} mix couple seats with normal/VIP seats"
            )

        obj.full_clean()
        super().save_model(request, obj, form, change)


# Register the admin
admin_site.register(CinemaRoom, CinemaRoomAdmin)

# ── Showtime ──────────────────────────────────────────────────────────

STATUS_BADGE = {
    "draft": "#6b7280",
    "confirmed": "#22c55e",
    "cancelled": "#ef4444",
}


class MovieFilter(admin.SimpleListFilter):
    title = "Movie"
    parameter_name = "movie_id"

    def lookups(self, request, model_admin):
        ids = (
            Showtime.objects.filter(is_deleted=False)
            .values_list("movie_id", flat=True)
            .distinct()
        )
        return [
            (m.id, m.title) for m in Movie.objects.filter(pk__in=ids).order_by("title")
        ]

    def queryset(self, request, queryset):
        if self.value():
            return queryset.filter(movie_id=self.value())
        return queryset


def _build_add_showtime_context():
    rooms = list(
        CinemaRoom.objects.filter(is_deleted=False)
        .prefetch_related("assigned_movies")
        .order_by("name")
    )
    movie_room_map: dict[int, list[int]] = {}
    room_lookup: dict[int, dict] = {}
    assigned_movie_ids: set[int] = set()
    for room in rooms:
        room_lookup[room.id] = {
            "id": room.id,
            "name": room.name,
            "room_type": room.room_type,
        }
        for m in room.assigned_movies.filter(is_deleted=False):
            assigned_movie_ids.add(m.id)
            movie_room_map.setdefault(m.id, []).append(room.id)
    movies_qs = (
        Movie.objects.filter(pk__in=assigned_movie_ids, is_deleted=False)
        .prefetch_related("versions")
        .order_by("title")
    )
    add_movies = []
    for m in movies_qs:
        add_movies.append({
            "id": m.id,
            "title": m.title,
            "duration": m.duration,
            "version_csv": ", ".join(v.name for v in m.versions.all()),
        })
    versions = list(Version.objects.filter(is_deleted=False).values("id", "name"))
    return {
        "add_rooms": rooms,
        "add_movies": add_movies,
        "versions_json": json.dumps(versions, ensure_ascii=False),
        "movie_room_map_json": json.dumps(movie_room_map, ensure_ascii=False),
        "room_lookup_json": json.dumps(room_lookup, ensure_ascii=False),
    }


class ShowtimeAdmin(admin.ModelAdmin):
    change_list_template = "admin/cinemas/showtime/change_list.html"
    list_display = (
        "movie_title",
        "cinema_room",
        "start_time",
        "end_time_display",
        "version_id",
        "base_price",
        "status_badge",
        "has_overlap",
    )
    list_filter = ("status", "cinema_room", MovieFilter, "start_time")
    list_per_page = 50
    ordering = ("cinema_room", "start_time")
    actions = [
        "confirm_selected",
        "cancel_selected",
        "delete_all_drafts",
    ]

    def get_urls(self):
        custom_urls = [
            path(
                "generate/",
                self.admin_site.admin_view(self.generate_showtimes_view),
                name="cinemas_showtime_generate",
            ),
        ]
        return custom_urls + super().get_urls()

    def generate_showtimes_view(self, request):
        rooms = CinemaRoom.objects.filter(is_deleted=False).prefetch_related(
            "assigned_movies", "assigned_movies__versions"
        )

        assigned_movie_ids: set[int] = set()
        room_map: dict[int, list[str]] = {}
        for room in rooms:
            for m in room.assigned_movies.filter(is_deleted=False):
                assigned_movie_ids.add(m.id)
                room_map.setdefault(m.id, []).append(f"{room.name} ({room.room_type})")

        movies_qs = (
            Movie.objects.filter(pk__in=assigned_movie_ids, is_deleted=False)
            .prefetch_related("versions")
            .order_by("title")
        )
        movies = []
        for m in movies_qs:
            movies.append(
                {
                    "id": m.id,
                    "title": m.title,
                    "duration": m.duration,
                    "version_names": ", ".join(v.name for v in m.versions.all()),
                    "room_names": room_map.get(m.id, []),
                }
            )
        versions = list(
            Version.objects.filter(is_deleted=False).values("id", "name")
        )
        versions_json = json.dumps(versions, ensure_ascii=False)
        context = dict(
            self.admin_site.each_context(request),
            title="Generate Showtimes",
            rooms=rooms,
            movies=movies,
            versions_json=versions_json,
            today=date.today().isoformat(),
        )   
        return TemplateResponse(
            request, "admin/cinemas/showtime/generate.html", context
        )

    def movie_title(self, obj):
        m = obj.movie
        return m.title if m else f"(Movie #{obj.movie_id})"

    movie_title.short_description = "Movie"

    def end_time_display(self, obj):
        return timezone.localtime(obj.end_time).strftime("%Y-%m-%d %H:%M")

    end_time_display.short_description = "End Time"

    def status_badge(self, obj):
        color = STATUS_BADGE.get(obj.status, "#888")
        return format_html(
            '<span style="background:{};color:#fff;padding:2px 8px;'
            'border-radius:4px;font-size:11px">{}</span>',
            color,
            obj.get_status_display(),
        )

    status_badge.short_description = "Status"

    def has_overlap(self, obj):
        if obj.status == "cancelled":
            return ""
        end = obj.end_time
        overlaps = Showtime.objects.filter(
            cinema_room=obj.cinema_room,
            is_deleted=False,
            status="confirmed",
        ).exclude(pk=obj.pk)
        for other in overlaps:
            if obj.start_time < other.end_time and end > other.start_time:
                return format_html(
                    '<span style="color:#ef4444" title="Overlaps #{} ({})">⚠ overlap</span>',
                    other.pk,
                    other.movie.title if other.movie else other.movie_id,
                )
        return mark_safe('<span style="color:#22c55e">✓</span>')

    has_overlap.short_description = "Conflicts"

    def changelist_view(self, request, extra_context=None):
        import json
        from collections import defaultdict
        from datetime import datetime as dt

        if request.method == "POST":
            action = request.POST.get("action")
            if action in ("delete_all_drafts",):
                post = request.POST.copy()
                post.setlist(
                    admin.helpers.ACTION_CHECKBOX_NAME,
                    ["0"],
                )
                request.POST = post

        # ── Date pagination: default to today ──
        date_str = request.GET.get("date")
        if date_str:
            try:
                current_date = dt.strptime(date_str, "%Y-%m-%d").date()
            except ValueError:
                current_date = date.today()
        else:
            current_date = date.today()

        prev_date = (current_date - timedelta(days=1)).isoformat()
        next_date = (current_date + timedelta(days=1)).isoformat()

        # ── Query showtimes for this date (09:00 → next day 05:00) ──
        tz = timezone.get_current_timezone()
        from datetime import time as dtime

        window_start = timezone.make_aware(dt.combine(current_date, dtime(9, 0)), tz)
        window_end = timezone.make_aware(
            dt.combine(current_date + timedelta(days=1), dtime(6, 0)), tz
        )

        qs = (
            Showtime.objects.filter(
                is_deleted=False,
                start_time__gte=window_start,
                start_time__lt=window_end,
            )
            .select_related("cinema_room", "version_id")
            .order_by("cinema_room__name", "start_time")
        )

        # Apply filters
        filter_status = request.GET.get("status")
        if filter_status:
            qs = qs.filter(status=filter_status)

        # ── All rooms (even those with no showtimes today) ──
        all_rooms = list(CinemaRoom.objects.filter(is_deleted=False).order_by("name"))

        # ── Build timeline data: {room_name: [showtime_dicts]} ──
        # Timeline spans 09:00–05:00 = 20 hours; each hour = 1 column
        # Offset in minutes from 09:00
        TIMELINE_START_HOUR = 9  # 09:00
        TIMELINE_HOURS = 21      # 09:00 → 05:00 next day

        room_showtimes = defaultdict(list)
        for st in qs:
            movie = st.movie
            local_start = timezone.localtime(st.start_time)
            # Minutes from 09:00
            hour = local_start.hour
            minute = local_start.minute
            if hour < TIMELINE_START_HOUR:
                # After midnight (e.g. 01:04) → offset from 09:00 is (24 - 9 + hour)*60 + min
                offset_min = (24 - TIMELINE_START_HOUR + hour) * 60 + minute
            else:
                offset_min = (hour - TIMELINE_START_HOUR) * 60 + minute

            duration = movie.duration if movie else 120
            local_end = local_start + timedelta(minutes=duration)
            room_showtimes[str(st.cinema_room)].append({
                "id": st.pk,
                "time": local_start.strftime("%H:%M"),
                "end_time": local_end.strftime("%H:%M"),
                "movie": unicodedata.normalize("NFC", movie.title) if movie else f"#{st.movie_id}",
                "status": st.status,
                "offset_min": offset_min,
                "duration": duration,
            })

        # Ensure all rooms appear (even with empty list)
        room_timeline = []
        for room in all_rooms:
            room_name = str(room)
            room_timeline.append(
                {
                    "name": room_name,
                    "showtimes": room_showtimes.get(room_name, []),
                }
            )

        # Build hour labels: 09, 10, 11, ... 23, 00, 01, 02
        hour_labels = []
        for i in range(TIMELINE_HOURS):
            h = (TIMELINE_START_HOUR + i) % 24
            hour_labels.append(f"{h:02d}:00")

        action_choices = self.get_action_choices(request)
        modal_ctx =_build_add_showtime_context()
        extra_context = extra_context or {}
        extra_context.update(modal_ctx)
        extra_context["room_timeline"] = room_timeline
        extra_context["room_timeline_json"] = json.dumps(room_timeline, ensure_ascii=False)
        extra_context["hour_labels"] = hour_labels
        extra_context["timeline_hours"] = TIMELINE_HOURS
        extra_context["current_date"] = current_date.isoformat()
        extra_context["current_date_display"] = current_date.strftime("%A, %d %B %Y")
        extra_context["prev_date"] = prev_date
        extra_context["next_date"] = next_date
        extra_context["action_choices"] = action_choices
        extra_context["filter_status"] = filter_status or ""
        
        clean_GET = request.GET.copy()
        for key in ("date", "status"):
            clean_GET.pop(key, None)
        request.GET = clean_GET
        return super().changelist_view(request, extra_context)

    def save_model(self, request, obj, form, change):
        scheduling_fields = {"start_time", "cinema_room", "movie_id", "version_id"}
        if not change or scheduling_fields & set(form.changed_data):
            obj.full_clean()
        super().save_model(request, obj, form, change)

    # ── Actions ────────────────────────────────────────────────────────

    @admin.action(description="Confirm selected showtimes")
    def confirm_selected(self, request, queryset):
        to_confirm = queryset.filter(status="draft")

        # Lockout: block confirming showtimes starting within LOCKOUT_MINUTES
        cutoff = timezone.now() + timedelta(minutes=LOCKOUT_MINUTES)
        too_soon = to_confirm.filter(start_time__lt=cutoff)
        if too_soon.exists():
            self.message_user(
                request,
                f"Some showtimes start within {LOCKOUT_MINUTES} minutes — cannot confirm.",
                messages.ERROR,
            )
            return

        conflicts = []
        for st in to_confirm.select_related("cinema_room"):
            end = st.end_time
            overlap = Showtime.objects.filter(
                cinema_room=st.cinema_room,
                is_deleted=False,
                status="confirmed",
            ).exclude(pk=st.pk)
            for other in overlap:
                if st.start_time < other.end_time and end > other.start_time:
                    conflicts.append(
                        f"#{st.pk} ({st.start_time:%H:%M}) overlaps "
                        f"confirmed #{other.pk} ({other.start_time:%H:%M})"
                    )
                    break

        if conflicts:
            self.message_user(
                request,
                "Blocked — overlaps with confirmed showtimes: "
                + "; ".join(conflicts[:5])
                + (f" … and {len(conflicts) - 5} more" if len(conflicts) > 5 else ""),
                messages.ERROR,
            )
            return

        updated = to_confirm.update(status="confirmed")
        self.message_user(
            request, f"{updated} showtime(s) confirmed.", messages.SUCCESS
        )

    @admin.action(description="Cancel selected showtimes")
    def cancel_selected(self, request, queryset):
        cutoff = timezone.now() + timedelta(minutes=LOCKOUT_MINUTES)
        too_late = queryset.filter(start_time__lt=cutoff, status="confirmed")
        if too_late.exists():
            self.message_user(
                request,
                "Some confirmed showtimes start within 1 hour — skipped.",
                messages.WARNING,
            )
        updated = queryset.exclude(start_time__lt=cutoff, status="confirmed").update(
            status="cancelled"
        )
        self.message_user(
            request, f"{updated} showtime(s) cancelled.", messages.SUCCESS
        )

    @admin.action(description="Delete ALL drafts")
    def delete_all_drafts(self, request, queryset):
        deleted, _ = Showtime.objects.filter(status="draft").delete()
        self.message_user(
            request, f"{deleted} draft showtime(s) deleted.", messages.SUCCESS
        )


admin_site.register(Showtime, ShowtimeAdmin)
