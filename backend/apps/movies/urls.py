from django.urls import path

from .views import MovieDetailAPIView, MovieListAPIView, MovieReminderAPIView

urlpatterns = [
    path("movies/", MovieListAPIView.as_view(), name="movie-list"),
    path("movies/<int:id>/", MovieDetailAPIView.as_view(), name="movie-detail"),
    path(
        "movies/<int:id>/remind/", MovieReminderAPIView.as_view(), name="movie-remind"
    ),
]
