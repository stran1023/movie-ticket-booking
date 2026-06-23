import json
import logging
import time
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from apps.bookings.services import _get_redis_client

from .models import DiscountType, MoviePromotion

logger = logging.getLogger(__name__)

PROMO_CACHE_TTL_SECONDS: int = 30 * 60  # 30 minutes
PROMO_CACHE_KEY_PATTERN = "cinema:promo:cache:{code}"
PROMO_COMMUNITY_ZSET_KEY = "cinema:promos:active"


class MoviePromotionInvalid:
    REDEEM_CODE_MAX_REACHED = "REDEEM_CODE_MAX_REACHED"
    INAPPLICABLE = "INAPPLICABLE"
    EXPIRED = "EXPIRED"


@dataclass
class PromotionValidationResult:
    valid: bool
    reason: str | None
    promotion: MoviePromotion | None
    discount_amount: Decimal | None
    final_amount: Decimal | None


def calculate_discount_amount(
    promotion: MoviePromotion, total_amount: Decimal
) -> Decimal:
    if promotion.discount_type == DiscountType.PERCENTAGE:
        # discount_value = 0.20 for 20%
        discount = total_amount * promotion.discount_value
    else:
        discount = promotion.discount_value
    return discount.quantize(Decimal("0.01"))


def validate_movie_promotion(
    code: str, movie_id: int, total_amount: Decimal
) -> PromotionValidationResult:
    """
    Stateless validation: **does not** consume stock.
    """
    try:
        promotion = MoviePromotion.objects.select_related("movie").get(code=code)
    except MoviePromotion.DoesNotExist:
        return PromotionValidationResult(
            valid=False,
            reason=MoviePromotionInvalid.INAPPLICABLE,
            promotion=None,
            discount_amount=None,
            final_amount=None,
        )

    # Active flag (managed by signals + Celery task)
    if not promotion.is_active:
        return PromotionValidationResult(
            valid=False,
            reason=MoviePromotionInvalid.EXPIRED,
            promotion=promotion,
            discount_amount=None,
            final_amount=None,
        )

    # Movie applicability (if promotion is bound to a specific movie)
    if promotion.movie_id and promotion.movie_id != movie_id:
        return PromotionValidationResult(
            valid=False,
            reason=MoviePromotionInvalid.INAPPLICABLE,
            promotion=promotion,
            discount_amount=None,
            final_amount=None,
        )

    # Usage limit
    if promotion.used_count >= promotion.usage_limit:
        return PromotionValidationResult(
            valid=False,
            reason=MoviePromotionInvalid.REDEEM_CODE_MAX_REACHED,
            promotion=promotion,
            discount_amount=None,
            final_amount=None,
        )

    # Compute discount if everything is valid
    discount_amount = calculate_discount_amount(promotion, total_amount)
    final_amount = total_amount - discount_amount

    return PromotionValidationResult(
        valid=True,
        reason=None,
        promotion=promotion,
        discount_amount=discount_amount,
        final_amount=final_amount,
    )


def _promo_cache_key(code: str) -> str:
    # Normalize codes to uppercase to avoid duplicates
    return PROMO_CACHE_KEY_PATTERN.format(code=code.upper())


def cache_promo_validation(code: str, data: dict[str, Any]) -> None:
    """
    Cache the full validation response for a promo code.

    The payload is JSON-encoded and stored with a short TTL so that
    expired promotions will naturally disappear from the cache.
    """
    try:
        client = _get_redis_client()
        key = _promo_cache_key(code)
        client.setex(key, PROMO_CACHE_TTL_SECONDS, json.dumps(data, default=str))
    except Exception:  # pragma: no cover - cache failures should be non-fatal
        logger.exception("Failed to cache promo validation for code %s", code)


def get_cached_promo(code: str) -> dict[str, Any] | None:
    """
    Return cached validation payload for this code, if any.

    Returns None when the key is absent or Redis is unavailable.
    """
    try:
        client = _get_redis_client()
        raw = client.get(_promo_cache_key(code))
    except Exception:  # pragma: no cover
        logger.exception("Failed to fetch cached promo for code %s", code)
        return None

    if raw is None:
        return None

    try:
        return json.loads(raw)
    except (TypeError, json.JSONDecodeError):
        # Corrupt payload → drop it
        logger.warning("Invalid JSON payload in promo cache for code %s", code)
        return None


def add_to_community_tickets(code: str) -> None:
    """
    Add a validated promo code to the shared discovery list.

    Uses a sorted set keyed by last-used timestamp so that the most
    recently validated codes appear first.

    Keeps only the 10 most recent codes to avoid unbounded growth.
    """
    try:
        client = _get_redis_client()
        now = time.time()
        pipe = client.pipeline(transaction=True)
        pipe.zadd(PROMO_COMMUNITY_ZSET_KEY, {code.upper(): now})
        # Trim to keep only the 10 most recent entries
        pipe.zremrangebyrank(PROMO_COMMUNITY_ZSET_KEY, 0, -11)
        pipe.execute()
    except Exception:  # pragma: no cover
        logger.exception("Failed to update community promo tickets for %s", code)


def get_community_tickets(limit: int = 5) -> list[str]:
    """
    Return up to `limit` most recently validated promo codes.

    The most recent codes are returned first.
    """
    try:
        client = _get_redis_client()
        if limit <= 0:
            return []
        # ZREVRANGE → highest score (most recent) first
        codes = client.zrevrange(PROMO_COMMUNITY_ZSET_KEY, 0, limit - 1)
        return [str(c) for c in codes]
    except Exception:  # pragma: no cover
        logger.exception("Failed to read community promo tickets")
        return []
