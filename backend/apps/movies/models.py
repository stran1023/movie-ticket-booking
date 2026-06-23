import unicodedata
from django.db import models
from django.contrib.postgres.indexes import GinIndex
from django.utils import timezone
from apps.core.models import BaseModel

# Create your models here.

LABEL_CHOICES = [
    ("P", "General"),
    ("T13", "13+"),
    ("K", "Less than 13, parent accompanied"),
    ("T16", "16+"),
    ("T18", "18+"),
    ("C", "Banned"),
]


STATUS_CHOICES = [
    ("COMING_SOON", "Coming Soon"),
    ("NOW_SHOWING", "Now Showing"),
    ("ENDED", "Ended"),
]


class Version(BaseModel):
    name = models.CharField(max_length=5)

    class Meta:
        db_table = "Version"

    def __str__(self):
        return self.name


class Movie(BaseModel):
    title = models.CharField(max_length=255)
    search_title = models.CharField(
        max_length=255, blank=True, null=True, editable=False
    )
    description = models.TextField(null=True, blank=True)
    poster_file = models.CharField(max_length=255, blank=True, null=True)
    trailer_url = models.URLField(max_length=500, blank=True, null=True)
    duration = models.PositiveIntegerField(help_text="Duration in minutes")
    directors = models.CharField(max_length=255)
    casts = models.CharField(max_length=255, null=True, blank=True)
    genres = models.CharField(max_length=255, null=True, blank=True)
    languages_subtitles = models.CharField(max_length=255, null=True, blank=True)

    versions = models.ManyToManyField(
        Version,
        related_name="movies",
    )

    release_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        null=True,
        blank=True,
    )

    label = models.CharField(
        max_length=20,
        choices=LABEL_CHOICES,
        null=True,
        blank=True,
    )

    class Meta:
        db_table = "Movie"
        ordering = ["id"]

        indexes = [
            GinIndex(
                fields=["search_title"],
                name="movie_search_title_gin_idx",
                opclasses=["gin_trgm_ops"],
            )
        ]

    def save(self, *args, **kwargs):
        today = timezone.now().date()

        if self.release_date:
            if self.release_date > today:
                self.status = "COMING_SOON"
            elif self.end_date and today > self.end_date:
                self.status = "ENDED"
            else:
                self.status = "NOW_SHOWING"

        if self.title:
            import unicodedata

            clean_title = self.title.replace("Đ", "D").replace("đ", "d")
            normalized = unicodedata.normalize("NFD", clean_title)
            stripped = "".join(
                [c for c in normalized if unicodedata.category(c) != "Mn"]
            )
            self.search_title = stripped.lower()

        super().save(*args, **kwargs)

    @classmethod
    def update_all_statuses(cls):
        today = timezone.now().date()
        movies_to_show = cls.objects.filter(
            status="COMING_SOON", release_date__lte=today
        )
        released_ids = list(movies_to_show.values_list("id", flat=True))
        movies_to_show.update(status="NOW_SHOWING")
        cls.objects.filter(status="NOW_SHOWING", end_date__lt=today).update(
            status="ENDED"
        )
        return released_ids

    def __str__(self):
        return self.title or f"Movie {self.pk}"


class MovieReminder(BaseModel):
    movie = models.ForeignKey(Movie, on_delete=models.CASCADE, related_name="reminders")
    email = models.EmailField()

    class Meta:
        db_table = "MovieReminder"
        unique_together = ["movie", "email"]

    def __str__(self):
        return f"{self.email} -> {self.movie.title}"
