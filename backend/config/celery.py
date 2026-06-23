import os
from celery import Celery
from celery.schedules import crontab

# Chỉ rõ settings của Django để Celery load đúng cấu hình
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("config")

# Read Celery config from Django settings
app.config_from_object("django.conf:settings", namespace="CELERY")

# Find tasks.py in every apps
app.autodiscover_tasks()
app.conf.beat_schedule = {
    "update-movie-statuses-every-midnight": {
        "task": "movies.tasks.update_movie_statuses",  # The exact path to your task
        "schedule": crontab(minute=0, hour=0),  # Run at 00:00 (Midnight) every day
    },
}


# Debug task
@app.task(bind=True)
def debug_task(self):
    print(f"Request: {self.request!r}")
