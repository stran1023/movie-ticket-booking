import logging
import unicodedata

from django.db.models import Case, When
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from rest_framework import generics
from .models import Movie
from .serializers import MovieSerializer
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.shortcuts import get_object_or_404
from .models import Movie, MovieReminder
from .search_utils import tfidf_search

logger = logging.getLogger(__name__)


class MovieListAPIView(generics.ListAPIView):
    serializer_class = MovieSerializer

    @method_decorator(cache_page(60 * 15))
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)

    def get_queryset(self):
        queryset = Movie.objects.prefetch_related("versions").exclude(status="ENDED")
        filter_status = self.request.query_params.get("filter", "all")
        search_query = self.request.query_params.get("search", "").strip()
        if filter_status in ["NOW_SHOWING", "COMING_SOON"]:
            queryset = queryset.filter(status=filter_status)
        if search_query:
            try:
                # Use TF-IDF search across title, description, genres, etc.
                ranked_ids = tfidf_search(search_query, queryset, min_score=0.01)

                if ranked_ids:
                    # Preserve the TF-IDF relevance ordering
                    ordering = Case(
                        *[When(id=pk, then=pos) for pos, pk in enumerate(ranked_ids)]
                    )
                    queryset = queryset.filter(id__in=ranked_ids).order_by(ordering)
                else:
                    # TF-IDF found no matches — return empty
                    queryset = queryset.none()
            except Exception:
                logger.warning(
                    "TF-IDF search failed, falling back to title search",
                    exc_info=True,
                )
                # Fallback to original title-based search
                clean_query = search_query.replace("Đ", "D").replace("đ", "d")
                normalized_query = unicodedata.normalize("NFD", clean_query)
                stripped_query = "".join(
                    [c for c in normalized_query if unicodedata.category(c) != "Mn"]
                ).lower()
                queryset = queryset.filter(
                    search_title__icontains=stripped_query
                ).order_by("id")

        return queryset


class MovieDetailAPIView(generics.RetrieveAPIView):
    queryset = Movie.objects.prefetch_related("versions").all()
    serializer_class = MovieSerializer
    lookup_field = "id"


class MovieReminderAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, id):
        """Checks if the logged-in user is already subscribed."""
        movie = get_object_or_404(Movie, id=id)
        user_email = request.user.email
        is_subscribed = MovieReminder.objects.filter(
            movie=movie, email=user_email
        ).exists()
        return Response({"is_subscribed": is_subscribed}, status=status.HTTP_200_OK)

    def post(self, request, id):
        """Subscribes the user to the movie."""
        movie = get_object_or_404(Movie, id=id)
        if movie.status != "COMING_SOON":
            return Response(
                {"detail": "You can only subscribe to movies that are coming soon."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user_email = request.user.email
        if not user_email:
            return Response(
                {"detail": "Your account does not have an email address attached."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        reminder, created = MovieReminder.objects.get_or_create(
            movie=movie, email=user_email
        )
        if created:
            return Response(
                {"detail": "Successfully subscribed!"}, status=status.HTTP_201_CREATED
            )
        else:
            return Response(
                {"detail": "You are already subscribed."}, status=status.HTTP_200_OK
            )

    def delete(self, request, id):
        """Unsubscribes the user from the movie."""
        movie = get_object_or_404(Movie, id=id)
        user_email = request.user.email
        deleted_count, _ = MovieReminder.objects.filter(
            movie=movie, email=user_email
        ).delete()
        if deleted_count > 0:
            return Response(
                {"detail": "Reminder cancelled successfully."},
                status=status.HTTP_200_OK,
            )
        else:
            return Response(
                {"detail": "You were not subscribed to this movie."},
                status=status.HTTP_400_BAD_REQUEST,
            )
