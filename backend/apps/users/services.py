"""
Point earning & redemption business logic.

Convention:
  - 1 point is earned per 1,000 VND paid  (floor)
  - points_earned = floor((seat_base + concession_base) * ratio_earned)
  - NO points are earned if any discount is applied (promo code, flat price promotion)
    or if points are redeemed (points_used > 0).

"""

from __future__ import annotations

import math
from decimal import ROUND_FLOOR, Decimal

from django.db import transaction

from .models import PointHistory, PointRedemptionConfig, PointTransaction, UserPoint

# ── Constants ────────────────────────────────────────────────────────────

BASE_SEAT_PRICES_VND: dict[str, Decimal] = {
    "normal": Decimal("75000"),
    "vip": Decimal("120000"),
    "couple": Decimal("180000"),
}


def _get_config() -> PointRedemptionConfig | None:
    return PointRedemptionConfig.objects.first()


def _get_or_create_user_point(user) -> UserPoint:
    user_point, _ = UserPoint.objects.get_or_create(user=user)
    return user_point


# ── Award Points ─────────────────────────────────────────────────────────


def award_points_for_booking(booking) -> int | None:
    """
    Award points to the booking owner after successful payment.

    Idempotent: if an EARN transaction for this booking already exists,
    no duplicate award is created.

    Returns the number of points awarded, or None if already awarded.
    """
    user = booking.user_profile_id.user  # FK name is user_profile_id

    already_awarded = PointTransaction.objects.filter(
        user=user,
        booking=booking,
        transaction_type=PointTransaction.TransactionType.EARN,
    ).exists()
    if already_awarded:
        return None

    # Business rule: do not earn if ANY discount was used or points were redeemed.
    # - discount_amount includes promo code + flat price discount + points discount
    # - points_used captures point redemption explicitly
    if int(getattr(booking, "points_used", 0) or 0) > 0:
        return 0
    if Decimal(str(getattr(booking, "discount_amount", 0) or 0)) > 0:
        return 0

    config = _get_config()
    ratio_earned = (
        Decimal(str(config.ratio_earned))
        if config and getattr(config, "ratio_earned", None) is not None
        else Decimal("0.1")
    )
    if ratio_earned <= 0:
        return 0

    tickets = list(booking.tickets.all())
    discounted_seat_amount = sum((Decimal(str(t.price)) for t in tickets), Decimal("0"))
    seat_base_amount = sum(
        (
            BASE_SEAT_PRICES_VND.get(
                str(getattr(t, "seat_type_snapshot", "normal")).lower(),
                BASE_SEAT_PRICES_VND["normal"],
            )
            for t in tickets
        ),
        Decimal("0"),
    )
    concession_base_amount = Decimal(str(booking.total_amount)) - discounted_seat_amount
    if concession_base_amount < 0:
        concession_base_amount = Decimal("0")
    base_amount = seat_base_amount + concession_base_amount

    points_per_vnd = (
        Decimal(str(config.points_per_vnd))
        if config and getattr(config, "points_per_vnd", None) is not None
        else Decimal("1000")
    )

    points_earned = int(
        ((base_amount / points_per_vnd) * ratio_earned).to_integral_value(
            rounding=ROUND_FLOOR
        )
    )

    if points_earned <= 0:
        return 0

    with transaction.atomic():
        user_point = _get_or_create_user_point(user)
        user_point.balance += points_earned
        user_point.total_earned += points_earned
        user_point.save(update_fields=["balance", "total_earned", "updated_at"])

        PointTransaction.objects.create(
            user=user,
            transaction_type=PointTransaction.TransactionType.EARN,
            points=points_earned,
            balance_after=user_point.balance,
            booking=booking,
            note=f"Earned from booking #{booking.booking_code}",
        )

        # Keep legacy UserProfile.total_points in sync
        profile = user.profile
        profile.total_points = user_point.balance
        profile.save(update_fields=["total_points"])

        # Update booking.points_earned for display purposes
        booking.points_earned = points_earned
        booking.save(update_fields=["points_earned", "updated_at"])

        # Legacy PointHistory for backward compatibility
        PointHistory.objects.create(
            user_profile=profile,
            booking=booking,
            point_type=PointHistory.Type.ACCUMULATE,
            points_amount=points_earned,
            description=f"Earned from booking #{booking.booking_code}",
        )

    return points_earned


# ── Calculate Redeemable Points ──────────────────────────────────────────


def calculate_redeemable_points(
    user, subtotal: int | float, amount_already_discounted: int | float = 0
) -> dict:
    """
    Pure calculation — no side effects.

    Returns a dict with:
      redeemable_points, max_discount_vnd, user_balance,
      min_points, max_redeem_percentage, is_redemption_available
    """
    config = _get_config()

    defaults = {
        "redeemable_points": 0,
        "max_discount_vnd": 0,
        "user_balance": 0,
        "min_points": 4,
        "max_redeem_percentage": 50,
        "is_redemption_available": False,
    }

    if config is None or not config.is_active:
        defaults["config_active"] = False
        return defaults

    user_point = _get_or_create_user_point(user)
    defaults["user_balance"] = user_point.balance
    defaults["min_points"] = config.min_points_to_redeem
    defaults["max_redeem_percentage"] = config.max_redeem_percentage
    defaults["config_active"] = True

    subtotal = float(subtotal)
    amount_already_discounted = float(amount_already_discounted)

    # Step 1: base for cap calculation
    discountable_base = subtotal - amount_already_discounted

    if discountable_base <= 0:
        return defaults

    # Step 2: maximum VND redeemable by policy — ceil to be generous
    max_vnd_by_policy = math.ceil(
        discountable_base * config.max_redeem_percentage / 100
    )

    # Step 3: convert policy cap to points — ceil again
    max_points_by_policy = math.ceil(max_vnd_by_policy / config.points_per_vnd)

    # Step 4: cap against user's actual balance
    redeemable_points = min(max_points_by_policy, user_point.balance)

    # Step 5: enforce minimum threshold
    if redeemable_points < config.min_points_to_redeem:
        defaults["redeemable_points"] = 0
        defaults["max_discount_vnd"] = 0
        defaults["is_redemption_available"] = False
        return defaults

    # Step 6: convert back to VND discount
    max_discount_vnd = redeemable_points * config.points_per_vnd

    return {
        "redeemable_points": redeemable_points,
        "max_discount_vnd": max_discount_vnd,
        "user_balance": user_point.balance,
        "min_points": config.min_points_to_redeem,
        "max_redeem_percentage": config.max_redeem_percentage,
        "is_redemption_available": True,
        "config_active": True,
    }


# ── Redeem Points ────────────────────────────────────────────────────────


def redeem_points(
    user,
    booking,
    points_to_redeem: int,
    subtotal: int,
    amount_already_discounted: int = 0,
    skip_booking_update: bool = False,
) -> dict:
    """
    Deduct points from the user's balance and create a REDEEM transaction.

    Validates:
      - points_to_redeem <= redeemable_points (re-runs full calculation)
      - user has sufficient balance

    When ``skip_booking_update`` is True the caller is responsible for
    setting booking.discount_amount / final_amount (used by ConfirmBookingAPIView
    which already creates the booking with the correct totals).

    Returns updated balance and discount applied.
    Raises ValueError on validation failure.
    """
    calc = calculate_redeemable_points(user, subtotal, amount_already_discounted)

    if not calc["is_redemption_available"]:
        raise ValueError("Point redemption is not available.")

    if points_to_redeem > calc["redeemable_points"]:
        raise ValueError(
            f"Cannot redeem {points_to_redeem} pts. "
            f"Maximum redeemable is {calc['redeemable_points']} pts."
        )

    if points_to_redeem <= 0:
        raise ValueError("points_to_redeem must be positive.")

    config = _get_config()
    discount_vnd = points_to_redeem * config.points_per_vnd

    with transaction.atomic():
        user_point = UserPoint.objects.select_for_update().get(user=user)

        if user_point.balance < points_to_redeem:
            raise ValueError("Insufficient point balance.")

        user_point.balance -= points_to_redeem
        user_point.total_redeemed += points_to_redeem
        user_point.save(update_fields=["balance", "total_redeemed", "updated_at"])

        PointTransaction.objects.create(
            user=user,
            transaction_type=PointTransaction.TransactionType.REDEEM,
            points=-points_to_redeem,
            balance_after=user_point.balance,
            booking=booking,
            note=f"Redeemed for booking #{booking.booking_code}",
        )

        # Keep legacy UserProfile.total_points in sync
        profile = user.profile
        profile.total_points = user_point.balance
        profile.save(update_fields=["total_points"])

        if not skip_booking_update:
            booking.points_used = points_to_redeem
            booking.discount_amount = Decimal(str(booking.discount_amount)) + Decimal(
                str(discount_vnd)
            )
            booking.final_amount = Decimal(str(booking.total_amount)) - Decimal(
                str(booking.discount_amount)
            )
            if booking.final_amount < 0:
                booking.final_amount = Decimal("0")
            booking.save(
                update_fields=[
                    "points_used",
                    "discount_amount",
                    "final_amount",
                    "updated_at",
                ]
            )

        # Legacy PointHistory for backward compatibility
        profile = getattr(user, "profile", None)
        if profile:
            PointHistory.objects.create(
                user_profile=profile,
                booking=booking,
                point_type=PointHistory.Type.REDEEM,
                points_amount=-points_to_redeem,
                description=f"Redeemed for booking #{booking.booking_code}",
            )

    return {
        "balance": user_point.balance,
        "points_redeemed": points_to_redeem,
        "discount_applied": discount_vnd,
    }
