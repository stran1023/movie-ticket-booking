"""
Redis-based seat hold manager.

Key pattern : cinema:hold:showtime:{showtime_id}:seat:{seat_label}
Value       : str(user_id)
TTL         : SEAT_HOLD_TTL seconds (5 minutes)

Designed to sit alongside the existing DB-based SeatHold model.
HoldSeatsView writes to BOTH layers so ConfirmBookingAPIView (which
validates against the DB table) continues to work unchanged.
"""

from __future__ import annotations

import logging
import time

import redis
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings

logger = logging.getLogger(__name__)

# Must match SEAT_HOLD_MINUTES (cinemas/models.py) * 60
SEAT_HOLD_TTL: int = 300

# Hard cap: maximum wall-clock time a user can keep refreshing holds
SESSION_HARD_CAP_TTL: int = 900  # 15 minutes

_KEY_PREFIX = "cinema:hold"
_SESSION_PREFIX = "cinema:session:user"

# Lua script: atomically DELETE a key only when its value matches the expected
# holder.  Prevents the TOCTOU race between GET and DELETE that would wipe a
# different user's freshly acquired lock.
_RELEASE_IF_OWNER_LUA = """
if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
end
return 0
"""

# ── Connection ─────────────────────────────────────────────────────────────────
# Module-level singleton.  redis.from_url() creates a thread-safe connection
# pool internally, so this is safe for multi-threaded Django workers.

_redis_client: redis.Redis | None = None


_release_script = None


def _get_redis_client() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        redis_url: str = (
            settings.CACHES.get("default", {}).get("LOCATION")
            or "redis://localhost:6379/2"
        )
        _redis_client = redis.from_url(redis_url, decode_responses=True)
    return _redis_client


def _get_release_script():
    """Register the Lua release script once, reuse across calls."""
    global _release_script
    if _release_script is None:
        _release_script = _get_redis_client().register_script(_RELEASE_IF_OWNER_LUA)
    return _release_script


# ── Key helpers ────────────────────────────────────────────────────────────────


def _seat_key(showtime_id: int, seat_label: str) -> str:
    return f"{_KEY_PREFIX}:showtime:{showtime_id}:seat:{seat_label}"


def _showtime_pattern(showtime_id: int) -> str:
    return f"{_KEY_PREFIX}:showtime:{showtime_id}:seat:*"


def _label_from_key(key: str, showtime_id: int) -> str:
    prefix = f"{_KEY_PREFIX}:showtime:{showtime_id}:seat:"
    return key[len(prefix) :]


def _session_key(user_id: int, showtime_id: int) -> str:
    return f"{_SESSION_PREFIX}:{user_id}:showtime:{showtime_id}"


# ── Custom exceptions ──────────────────────────────────────────────────────────


class SeatAlreadyHeldException(Exception):
    """
    Raised by hold_seats() when one or more seats are currently held
    by a DIFFERENT user.  Carries the list of conflicting seat labels
    so the caller can surface them to the client.
    """

    def __init__(self, conflicting_seats: list[str]) -> None:
        self.conflicting_seats = conflicting_seats
        super().__init__(f"Seats already held: {', '.join(conflicting_seats)}")


class SessionExpiredException(Exception):
    """
    Raised when the 15-minute hard-cap booking session has expired.
    The user must release their seats and start over.
    """


# ── Core operations ────────────────────────────────────────────────────────────


def clear_session(user_id: int, showtime_id: int) -> bool:
    """
    Delete the 15-minute hard-cap session key for this user+showtime.
    Must be called when the user fully abandons a booking (releases all
    seats) or after a successful booking confirmation, so that re-entering
    the same showtime starts a fresh 15-minute window.

    Returns True if the key existed and was deleted.
    """
    client = _get_redis_client()
    return bool(client.delete(_session_key(user_id, showtime_id)))


def hold_seats(
    showtime_id: int,
    seat_labels: list[str],
    user_id: int,
) -> int:
    """
    Attempt to acquire a Redis lock for every seat in seat_labels.

    Session hard-cap logic:
      - On the FIRST hold for (user, showtime), a session key is created
        with a 15-minute TTL.  This key is never refreshed.
      - On every subsequent call the remaining session time is read and
        seat TTLs are clamped to min(5 min, session_remaining).
      - If the session key has expired, SessionExpiredException is raised.

    Returns:
        The effective TTL (seconds) applied to the seat keys.  The caller
        uses this to compute the precise `expires_at` for the response.

    Raises:
        SessionExpiredException: the 15-minute window has elapsed.
        SeatAlreadyHeldException: one or more seats held by another user.
    """
    client = _get_redis_client()
    sess_key = _session_key(user_id, showtime_id)

    # ── Session gate ──────────────────────────────────────────────────
    # SET NX: only creates the key if this is the user's first hold.
    # Value = epoch timestamp of session start (informational / debugging).
    created_session = client.set(
        sess_key,
        str(time.time()),
        ex=SESSION_HARD_CAP_TTL,
        nx=True,
    )

    if not created_session:
        remaining = client.ttl(sess_key)
        # TTL returns -2 if key does not exist (expired between SET NX and TTL)
        if remaining is None or remaining < 0:
            raise SessionExpiredException
    else:
        remaining = SESSION_HARD_CAP_TTL

    SESSION_MIN_REMAINING: int = 45
    if remaining <= SESSION_MIN_REMAINING:
        raise SessionExpiredException

    effective_ttl = min(SEAT_HOLD_TTL, remaining)

    # ── Acquire per-seat locks ────────────────────────────────────────
    newly_created: list[str] = []
    conflicting: list[str] = []

    for label in seat_labels:
        key = _seat_key(showtime_id, label)
        success = client.set(key, str(user_id), ex=effective_ttl, nx=True)
        if success:
            newly_created.append(label)
        else:
            current_holder = client.get(key)
            if current_holder == str(user_id):
                client.expire(key, effective_ttl)
            else:
                conflicting.append(label)

    if conflicting:
        if newly_created:
            client.delete(*[_seat_key(showtime_id, lbl) for lbl in newly_created])
        raise SeatAlreadyHeldException(conflicting)

    return effective_ttl


def release_seats(
    showtime_id: int,
    seat_labels: list[str],
    user_id: int,
) -> int:
    """
    Atomically delete Redis locks for the given seats, but ONLY when they
    belong to user_id.  Uses a Lua script so the check-and-delete is a
    single atomic operation — no TOCTOU race.

    Returns the number of locks actually released.
    """
    script = _get_release_script()
    released = 0
    for label in seat_labels:
        key = _seat_key(showtime_id, label)
        result = script(keys=[key], args=[str(user_id)])
        released += int(result)
    return released


def release_all_seats_for_user(showtime_id: int, user_id: int) -> int:
    """
    Release ALL Redis locks a user holds for a given showtime.
    Useful when the user cancels the entire selection or navigates away.

    Uses SCAN to find keys, then the Lua compare-and-delete script for
    each one — no TOCTOU race.
    Returns the number of locks released.
    """
    client = _get_redis_client()
    script = _get_release_script()
    pattern = _showtime_pattern(showtime_id)
    released = 0
    cursor = 0

    while True:
        cursor, keys = client.scan(cursor=cursor, match=pattern, count=200)
        for key in keys:
            result = script(keys=[key], args=[str(user_id)])
            released += int(result)
        if cursor == 0:
            break

    return released


# ── Read operations ────────────────────────────────────────────────────────────


def get_held_seats_for_showtime(showtime_id: int) -> dict[str, int]:
    """
    Efficiently fetch ALL active Redis holds for a showtime.

    Uses SCAN (non-blocking, cursor-based) followed by a single MGET to
    retrieve all values in one round-trip — O(held_seats), never O(all_seats).

    Returns:
        {seat_label: holder_user_id}  for every key that exists in Redis.
        Empty dict if Redis is unreachable (caller should catch exceptions).
    """
    client = _get_redis_client()
    pattern = _showtime_pattern(showtime_id)
    holds: dict[str, int] = {}
    cursor = 0

    while True:
        cursor, keys = client.scan(cursor=cursor, match=pattern, count=200)
        if keys:
            values = client.mget(keys)
            for key, val in zip(keys, values):
                if val is not None:
                    label = _label_from_key(key, showtime_id)
                    try:
                        holds[label] = int(val)
                    except (ValueError, TypeError):
                        pass
        if cursor == 0:
            break

    return holds


def broadcast_seat_update(showtime_id, action, seat_labels):
    """
    action: 'hold', 'release', 'book'
    """
    if not seat_labels:
        return
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"showtime_{showtime_id}",
        {
            "type": "seat_update",
            "action": action,
            "seats": list(seat_labels),
        },
    )
