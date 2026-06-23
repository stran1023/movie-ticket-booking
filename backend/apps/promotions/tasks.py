from celery import shared_task
from django.db import models
from django.utils import timezone

from .models import FlatPricePromotion, MoviePromotion, UserPromotion


@shared_task
def refresh_promotions_is_active():
    """
    Daily sweep to keep all promotion.is_active flags in sync with their
    scheduling rules.
    """
    today = timezone.now().date()

    # User promotions: simple inclusive date range
    UserPromotion.objects.filter(
        start_date__lte=today,
        end_date__gte=today,
    ).update(is_active=True)
    UserPromotion.objects.exclude(
        start_date__lte=today,
        end_date__gte=today,
    ).update(is_active=False)

    # Movie promotions: same inclusive date range logic
    MoviePromotion.objects.filter(
        start_date__lte=today,
        end_date__gte=today,
    ).update(is_active=True)
    MoviePromotion.objects.exclude(
        start_date__lte=today,
        end_date__gte=today,
    ).update(is_active=False)

    # Flat price promotions: support optional date range + recurring weekday.
    qs = FlatPricePromotion.objects.all().only(
        "id",
        "start_date",
        "end_date",
        "recurring_weekday",
        "is_active",
    )

    updates: list[int] = []
    deactivations: list[int] = []

    weekday = today.weekday()

    for promo in qs:
        is_active = True

        if promo.start_date and today < promo.start_date:
            is_active = False
        if promo.end_date and today > promo.end_date:
            is_active = False
        if promo.recurring_weekday is not None and weekday != promo.recurring_weekday:
            is_active = False

        if is_active and not promo.is_active:
            updates.append(promo.id)
        elif not is_active and promo.is_active:
            deactivations.append(promo.id)

    if updates:
        FlatPricePromotion.objects.filter(id__in=updates).update(is_active=True)
    if deactivations:
        FlatPricePromotion.objects.filter(id__in=deactivations).update(is_active=False)

    return {
        "user_promotions_active": UserPromotion.objects.filter(is_active=True).count(),
        "movie_promotions_active": MoviePromotion.objects.filter(
            is_active=True
        ).count(),
        "flat_price_promotions_active": FlatPricePromotion.objects.filter(
            is_active=True
        ).count(),
    }

