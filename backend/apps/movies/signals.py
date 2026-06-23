from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Movie
from .tasks import send_release_day_emails  # Import your celery task


@receiver(post_save, sender=Movie)
def trigger_release_emails_on_manual_save(sender, instance, created, **kwargs):
    if instance.status == "NOW_SHOWING":
        if instance.reminders.exists():
            send_release_day_emails.delay(instance.id)
