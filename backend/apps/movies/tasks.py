import unicodedata
from celery import shared_task
from django.core.mail import send_mail
from .models import Movie, MovieReminder


@shared_task
def update_movie_statuses():
    """
    Runs every midnight. Asks the Movie model to update its data,
    then triggers email blasts for any movie that just released.
    """
    released_ids = Movie.update_all_statuses()
    for movie_id in released_ids:
        send_release_day_emails.delay(movie_id)
    return f"Status sweep complete"


@shared_task
def send_release_day_emails(movie_id):
    try:
        movie = Movie.objects.get(id=movie_id)
    except Movie.DoesNotExist:
        return "Movie not found."
    subscribers = movie.reminders.values_list("email", flat=True)
    email_list = list(subscribers)
    if not email_list:
        return f"No one subscribed to {movie.title}."
    clean_title = movie.title.replace("Đ", "D").replace("đ", "d")
    normalized = unicodedata.normalize("NFD", clean_title)
    email_title = "".join([c for c in normalized if unicodedata.category(c) != "Mn"])
    subject = f"It's finally here! {email_title} is Now Showing!"
    message = f"Great news!\n\n{email_title} has officially hit the theaters. Grab your tickets now before they sell out!"
    from_email = "noreply@cinebook.com"

    send_mail(
        subject=subject,
        message=message,
        from_email=from_email,
        recipient_list=email_list,
        fail_silently=False,
    )

    movie.reminders.all().delete()

    return f"Successfully sent {len(email_list)} release emails for {email_title}."
