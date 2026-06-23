from __future__ import annotations

import bisect
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.utils import timezone as django_tz

from apps.movies.models import Movie, Version

from .models import CinemaRoom, Showtime

ROOM_ALLOWED_VERSIONS: dict[str, list[str]] = {
    "2D": ["2D"],
    "3D": ["2D", "3D"],
    "IMAX": ["2D", "IMAX"],
}

VERSION_PREFERENCE: dict[str, list[str]] = {
    "2D": ["2D"],
    "3D": ["3D", "2D"],
    "IMAX": ["IMAX", "2D"],
}

SLOT_BOUNDS: dict[str, tuple[time, time]] = {
    "morning": (time(9, 0), time(15, 0)),
    "afternoon": (time(15, 0), time(21, 0)),
    "night": (time(21, 0), time(3, 0)),
}

SLOT_ORDER: list[str] = ["morning", "afternoon", "night"]


@dataclass
class MovieScheduleConfig:
    movie_id: int
    priority: int  # 1-10, higher = more showtimes
    time_slots: list[str]
    base_price: Decimal
    enabled: bool = True

@dataclass
class GeneratorConfig:
    start_date: date
    num_days: int  # 1-7
    traffic_gap_minutes: int  # 15-40
    cleanup_minutes: int  # 15-20
    movie_configs: list[MovieScheduleConfig]
    room_ids: list[int] | None = None


def build_config(data: dict) -> GeneratorConfig:
    movie_configs = [
        MovieScheduleConfig(
            movie_id=mc["movie_id"],
            priority=mc["priority"],
            time_slots=mc["time_slots"],
            base_price=mc["base_price"],
            enabled=mc.get("enabled", True),
        )
        for mc in data["movie_configs"]
        if mc.get("enabled", True)
    ]
    return GeneratorConfig(
        start_date=data["start_date"],
        num_days=data["num_days"],
        traffic_gap_minutes=data["traffic_gap_minutes"],
        cleanup_minutes=data["cleanup_minutes"],
        movie_configs=movie_configs,
        room_ids=data.get("room_ids"),
    )


class ShowtimeGenerator:
    """
    Generates draft showtimes across cinema rooms respecting all scheduling
    constraints: traffic staggering, room cleanup gaps, priority weights,
    format matching, time-slot assignments, and minimum showtime quotas.

    Calling generate() multiple times (fill-gap mode) is safe — existing
    showtimes (draft + confirmed) are loaded first and new ones only fill gaps.
    """

    def __init__(self, config: GeneratorConfig):
        self.config = config
        self.traffic_gap = timedelta(minutes=config.traffic_gap_minutes)
        self.cleanup = timedelta(minutes=config.cleanup_minutes)

        movie_ids = [mc.movie_id for mc in config.movie_configs]
        self._movies: dict[int, Movie] = {
            m.id: m
            for m in Movie.objects.filter(
                pk__in=movie_ids, is_deleted=False
            ).prefetch_related("versions")
        }
        self._versions: dict[str, Version] = {
            v.name: v for v in Version.objects.filter(is_deleted=False)
        }
        self._movie_config_map: dict[int, MovieScheduleConfig] = {
            mc.movie_id: mc for mc in config.movie_configs
        }

        qs = CinemaRoom.objects.filter(is_deleted=False).prefetch_related(
            "assigned_movies"
        )
        if config.room_ids:
            qs = qs.filter(pk__in=config.room_ids)
        self._rooms: list[CinemaRoom] = list(qs)

        self._room_assigned: dict[int, set[int]] = {}
        for room in self._rooms:
            self._room_assigned[room.id] = set(
                room.assigned_movies.values_list("id", flat=True)
            )

    # ── Public API ─────────────────────────────────────────────────────

    def generate(self) -> list[Showtime]:
        all_drafts: list[Showtime] = []
        for day_offset in range(self.config.num_days):
            target_date = self.config.start_date + timedelta(days=day_offset)
            day_drafts = self._generate_for_day(target_date, all_drafts)
            all_drafts.extend(day_drafts)
        return all_drafts

    # ── Day-level scheduling ───────────────────────────────────────────

    def _generate_for_day(
        self, target_date: date, prior_drafts: list[Showtime]
    ) -> list[Showtime]:
        tz = django_tz.get_current_timezone()

        window_start = django_tz.make_aware(
            datetime.combine(target_date, time.min), tz
        )
        window_end = django_tz.make_aware(
            datetime.combine(target_date + timedelta(days=1), time(4, 0)), tz
        )

        existing = list(
            Showtime.objects.filter(
                is_deleted=False,
                start_time__gte=window_start,
                start_time__lt=window_end,
            )
            .exclude(status="cancelled")
            .select_related("cinema_room")
        )

        room_timelines: dict[int, list[tuple[datetime, datetime]]] = {
            r.id: [] for r in self._rooms
        }
        global_starts: list[datetime] = []
        movie_day_counts: dict[int, int] = {
            mc.movie_id: 0 for mc in self.config.movie_configs
        }

        def _track(room_id: int, start_dt: datetime, end_dt: datetime, mid: int):
            if room_id in room_timelines:
                room_timelines[room_id].append((start_dt, end_dt))
            global_starts.append(start_dt)
            if mid in movie_day_counts:
                movie_day_counts[mid] += 1

        for st in existing:
            movie = self._movies.get(st.movie_id)
            dur = movie.duration if movie else st.duration_minutes
            _track(
                st.cinema_room_id,
                st.start_time,
                st.start_time + timedelta(minutes=dur),
                st.movie_id,
            )

        for st in prior_drafts:
            if window_start <= st.start_time < window_end:
                movie = self._movies.get(st.movie_id)
                if movie:
                    end_dt = st.start_time + timedelta(minutes=movie.duration)
                    _track(st.cinema_room_id, st.start_time, end_dt, st.movie_id)

        for rid in room_timelines:
            room_timelines[rid].sort()
        global_starts.sort()

        cutoff_3am = django_tz.make_aware(
            datetime.combine(target_date + timedelta(days=1), time(3, 0)), tz
        )

        new_showtimes: list[Showtime] = []

        for slot_name in SLOT_ORDER:
            slot_start, slot_end = self._slot_datetimes(target_date, slot_name, tz)

            # Per-room: eligible movies and their weights
            room_eligible: dict[int, list[MovieScheduleConfig]] = {}
            for room in self._rooms:
                eligible = self._eligible_movies(room, slot_name)
                if eligible:
                    room_eligible[room.id] = eligible

            active_rooms = [r for r in self._rooms if r.id in room_eligible]
            # Per-room counts for weighted fair scheduling
            room_counts: dict[int, dict[int, int]] = {
                r.id: {mc.movie_id: 0 for mc in room_eligible[r.id]}
                for r in active_rooms
            }
            room_weights: dict[int, dict[int, int]] = {
                r.id: {mc.movie_id: mc.priority for mc in room_eligible[r.id]}
                for r in active_rooms
            }
            room_exhausted: dict[int, set[int]] = {
                r.id: set() for r in active_rooms
            }
            done: set[int] = set()

            while len(done) < len(active_rooms):
                progress = False

                for room in active_rooms:
                    if room.id in done:
                        continue

                    candidates = [
                        mc for mc in room_eligible[room.id]
                        if mc.movie_id not in room_exhausted[room.id]
                    ]
                    if not candidates:
                        done.add(room.id)
                        continue

                    # Pick movie most "behind" its target ratio.
                    # Tiebreaker: higher weight (priority) goes first.
                    weights = room_weights[room.id]
                    counts = room_counts[room.id]
                    mc = min(
                        candidates,
                        key=lambda m: (
                            counts[m.movie_id] / weights[m.movie_id],
                            -weights[m.movie_id],
                        ),
                    )

                    movie = self._movies.get(mc.movie_id)
                    if not movie:
                        room_exhausted[room.id].add(mc.movie_id)
                        continue

                    duration = timedelta(minutes=movie.duration)
                    start = self._find_valid_start(
                        slot_start,
                        duration,
                        room_timelines[room.id],
                        global_starts,
                        slot_end,
                    )

                    if start is None or start >= cutoff_3am:
                        room_exhausted[room.id].add(mc.movie_id)
                        continue

                    version = self._pick_version(movie, room)
                    if not version:
                        room_exhausted[room.id].add(mc.movie_id)
                        continue

                    end_dt = start + duration
                    showtime = Showtime(
                        movie_id=movie.id,
                        cinema_room=room,
                        start_time=start,
                        version_id=version,
                        base_price=mc.base_price,
                        status="draft",
                    )
                    new_showtimes.append(showtime)

                    room_timelines[room.id].append((start, end_dt))
                    room_timelines[room.id].sort()
                    bisect.insort(global_starts, start)
                    movie_day_counts[movie.id] = (
                        movie_day_counts.get(movie.id, 0) + 1
                    )
                    counts[mc.movie_id] += 1
                    progress = True

                if not progress:
                    break

        extra = self._fill_minimum_showtimes(
            target_date,
            cutoff_3am,
            movie_day_counts,
            room_timelines,
            global_starts,
        )
        new_showtimes.extend(extra)

        return new_showtimes

    # ── Helpers ────────────────────────────────────────────────────────

    def _slot_datetimes(
        self, target_date: date, slot_name: str, tz
    ) -> tuple[datetime, datetime]:
        s, e = SLOT_BOUNDS[slot_name]
        start = django_tz.make_aware(datetime.combine(target_date, s), tz)
        if slot_name == "night":
            end = django_tz.make_aware(
                datetime.combine(target_date + timedelta(days=1), e), tz
            )
        else:
            end = django_tz.make_aware(datetime.combine(target_date, e), tz)
        return start, end

    def _eligible_movies(
        self, room: CinemaRoom, slot_name: str
    ) -> list[MovieScheduleConfig]:
        assigned = self._room_assigned.get(room.id, set())
        allowed = set(ROOM_ALLOWED_VERSIONS.get(room.room_type, ["2D"]))

        result: list[MovieScheduleConfig] = []
        for mc in self.config.movie_configs:
            if mc.movie_id not in assigned:
                continue
            if slot_name not in mc.time_slots:
                continue
            movie = self._movies.get(mc.movie_id)
            if not movie:
                continue
            movie_versions = {v.name for v in movie.versions.all()}
            if not movie_versions & allowed:
                continue
            result.append(mc)
        return result

    @staticmethod
    def _build_priority_queue(
        configs: list[MovieScheduleConfig],
    ) -> list[MovieScheduleConfig]:
        """Interleaved weighted round-robin. Higher priority number = more showtimes."""
        weighted = [(mc, mc.priority) for mc in configs]
        max_weight = max(w for _, w in weighted)

        queue: list[MovieScheduleConfig] = []
        for round_num in range(max_weight):
            for mc, weight in weighted:
                if round_num < weight:
                    queue.append(mc)
        return queue

    @staticmethod
    def _round_nearest_5(dt: datetime) -> datetime:
        """Round a datetime to the nearest 5-minute mark.

        Last digit of minute:
          0,1,2,3  → round down to 0  (e.g. 10:03 → 10:00)
          4,5      → round up   to 5  (e.g. 10:04 → 10:05)
          6,7      → round down to 5  (e.g. 10:07 → 10:05)
          8,9      → round up   to 10 (e.g. 10:08 → 10:10)
        """
        base = dt.replace(second=0, microsecond=0)
        remainder = base.minute % 5
        if remainder == 0:
            return base
        if remainder <= 3:
            return base - timedelta(minutes=remainder)
        else:
            return base + timedelta(minutes=5 - remainder)

    def _find_valid_start(
        self,
        earliest: datetime,
        duration: timedelta,
        room_timeline: list[tuple[datetime, datetime]],
        global_starts: list[datetime],
        slot_end: datetime,
    ) -> datetime | None:
        """
        Find the next start time >= earliest respecting:
        1. Room cleanup gap (no overlap with existing showtimes + cleanup buffer)
        2. Traffic staggering (min distance from all other global start times)
        3. Slot boundary (start must be before slot_end)
        4. Start time is rounded to the nearest 5-minute mark
        """
        candidate = self._round_nearest_5(earliest)
        cleanup_td = self.cleanup
        traffic_secs = self.traffic_gap.total_seconds()

        for _ in range(500):
            if candidate >= slot_end:
                return None

            room_ok = True
            for st_start, st_end in room_timeline:
                # Use the relaxed rounded boundary to prevent strict checks
                # from bumping a valid "rounded down" time forward by 5 minutes.
                min_valid_start = self._round_nearest_5(st_end + cleanup_td)
                
                if (
                    candidate < min_valid_start
                    and candidate + duration + cleanup_td > st_start
                ):
                    candidate = min_valid_start
                    room_ok = False
                    break
            if not room_ok:
                continue

            traffic_ok = True
            for gs in global_starts:
                if abs((candidate - gs).total_seconds()) < traffic_secs:
                    min_valid_traffic = self._round_nearest_5(gs + self.traffic_gap)
                    candidate = min_valid_traffic if min_valid_traffic > candidate else candidate + timedelta(minutes=5)
                    traffic_ok = False
                    break
            if not traffic_ok:
                continue

            return candidate

        return None

    def _pick_version(self, movie: Movie, room: CinemaRoom) -> Version | None:
        """Select the best version: prefer room's native format, fallback to 2D."""
        movie_version_names = {v.name for v in movie.versions.all()}
        for name in VERSION_PREFERENCE.get(room.room_type, ["2D"]):
            if name in movie_version_names and name in self._versions:
                return self._versions[name]
        return None

    def _fill_minimum_showtimes(
        self,
        target_date: date,
        cutoff_3am: datetime,
        movie_day_counts: dict[int, int],
        room_timelines: dict[int, list[tuple[datetime, datetime]]],
        global_starts: list[datetime],
    ) -> list[Showtime]:
        """Post-pass: bring each movie up to at least 2 showtimes for the day."""
        tz = django_tz.get_current_timezone()
        extra: list[Showtime] = []

        for mc in self.config.movie_configs:
            needed = max(0, 2 - movie_day_counts.get(mc.movie_id, 0))
            if needed == 0:
                continue

            movie = self._movies.get(mc.movie_id)
            if not movie:
                continue

            duration = timedelta(minutes=movie.duration)

            for _ in range(needed):
                placed = False

                for slot_name in mc.time_slots:
                    if placed:
                        break
                    slot_start, slot_end = self._slot_datetimes(
                        target_date, slot_name, tz
                    )

                    for room in self._rooms:
                        if placed:
                            break
                        if mc.movie_id not in self._room_assigned.get(
                            room.id, set()
                        ):
                            continue

                        version = self._pick_version(movie, room)
                        if not version:
                            continue

                        start = self._find_valid_start(
                            slot_start,
                            duration,
                            room_timelines[room.id],
                            global_starts,
                            slot_end,
                        )
                        if start is None or start >= cutoff_3am:
                            continue

                        end_dt = start + duration
                        showtime = Showtime(
                            movie_id=movie.id,
                            cinema_room=room,
                            start_time=start,
                            version_id=version,
                            base_price=mc.base_price,
                            status="draft",
                        )
                        extra.append(showtime)

                        room_timelines[room.id].append((start, end_dt))
                        room_timelines[room.id].sort()
                        bisect.insort(global_starts, start)
                        movie_day_counts[mc.movie_id] = (
                            movie_day_counts.get(mc.movie_id, 0) + 1
                        )
                        placed = True

        return extra
