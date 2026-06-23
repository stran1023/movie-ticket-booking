from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

from .models import FlatPricePromotion, MoviePromotion, UserPromotion


@receiver(post_save, sender=UserPromotion)
def set_user_promotion_is_active(sender, instance: UserPromotion, **kwargs):
    """
    Keep UserPromotion.is_active in sync with its date range.
    """
    today = timezone.now().date()
    is_active = instance.start_date <= today <= instance.end_date

    if instance.is_active != is_active:
        sender.objects.filter(pk=instance.pk).update(is_active=is_active)


@receiver(post_save, sender=MoviePromotion)
def set_movie_promotion_is_active(sender, instance: MoviePromotion, **kwargs):
    """
    Keep MoviePromotion.is_active in sync with its date range.
    """
    today = timezone.now().date()
    is_active = instance.start_date <= today <= instance.end_date

    if instance.is_active != is_active:
        sender.objects.filter(pk=instance.pk).update(is_active=is_active)


@receiver(post_save, sender=FlatPricePromotion)
def set_flat_price_promotion_is_active(
    sender, instance: FlatPricePromotion, **kwargs
):
    """
    Automatically toggle FlatPricePromotion.is_active based on its optional
    date range and recurring weekday.
    """
    today = timezone.now().date()
    is_active = True

    if instance.start_date and today < instance.start_date:
        is_active = False
    if instance.end_date and today > instance.end_date:
        is_active = False
    if (
        instance.recurring_weekday is not None
        and today.weekday() != instance.recurring_weekday
    ):
        is_active = False

    if instance.is_active != is_active:
        sender.objects.filter(pk=instance.pk).update(is_active=is_active)

