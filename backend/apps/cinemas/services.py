from __future__ import annotations

from datetime import datetime, timedelta

from django.utils import timezone

from .models import CinemaRoom, Showtime


def find_conflicts(
    room: CinemaRoom,
    start_time: datetime,
    duration_minutes: int,
    gap_minutes: int = 10,
    exclude_pk: int | None = None,
) -> list[str]:
    new_end = start_time + timedelta(minutes=duration_minutes)
    gap = timedelta(minutes=gap_minutes)
    conflicts: list[str] = []

    qs = Showtime.objects.filter(
        cinema_room=room,
        is_deleted=False,
    ).exclude(status__in=["cancelled", "draft"])

    if exclude_pk:
        qs = qs.exclude(pk=exclude_pk)

    for other in qs:
        other_end = other.end_time
        if start_time < other_end and new_end > other.start_time:
            conflicts.append(
                f"Overlaps with Showtime #{other.pk} "
                f"({other.start_time:%H:%M}–{other_end:%H:%M})"
            )
        elif other_end <= start_time < other_end + gap:
            conflicts.append(
                f"Must start >= {gap_minutes}min after "
                f"Showtime #{other.pk} ends at {other_end:%H:%M}"
            )
        elif new_end <= other.start_time and new_end + gap > other.start_time:
            conflicts.append(
                f"Must end >= {gap_minutes}min before "
                f"Showtime #{other.pk} starts at {other.start_time:%H:%M}"
            )

    return conflicts
