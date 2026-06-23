from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.utils import timezone
from datetime import timedelta
from .models import Movie

DUMMY_CACHES = {"default": {"BACKEND": "django.core.cache.backends.dummy.DummyCache"}}


@override_settings(CACHES=DUMMY_CACHES)
class MovieListAPITests(APITestCase):
    def setUp(self):
        self.url = reverse("movie-list")
        today = timezone.now().date()
        yesterday = today - timedelta(days=1)
        tomorrow = today + timedelta(days=1)
        last_week = today - timedelta(days=7)
        # 1. NOW_SHOWING
        Movie.objects.create(
            title="Bố Già", duration=120, directors="Trấn Thành", release_date=yesterday
        )
        Movie.objects.create(
            title="Lật Mặt", duration=110, directors="Lý Hải", release_date=yesterday
        )
        # 2. COMING_SOON
        Movie.objects.create(
            title="Avatar 2",
            duration=190,
            directors="James Cameron",
            release_date=tomorrow,
        )
        Movie.objects.create(
            title="Spider-Man",
            duration=148,
            directors="Jon Watts",
            release_date=tomorrow,
        )
        # 3. ENDED
        Movie.objects.create(
            title="Old Movie",
            duration=90,
            directors="Unknown",
            release_date=last_week,
            end_date=yesterday,
        )

    def test_browse_default_load(self):
        """Test Case 1: Default load should return 4 movies, excluding ENDED."""
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # 5 total in DB, but 1 is ENDED, so 4 should return
        self.assertEqual(
            (
                len(response.data["results"])
                if "results" in response.data
                else len(response.data)
            ),
            4,
        )

    def test_filter_now_showing(self):
        """Test Case 2: Filter by 'NOW_SHOWING'."""
        response = self.client.get(self.url, {"filter": "NOW_SHOWING"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data["results"] if "results" in response.data else response.data
        self.assertEqual(len(data), 2)
        for movie in data:
            self.assertEqual(movie["_type"], "NOW_SHOWING")

    def test_filter_coming_soon(self):
        """Test Case 3: Filter by 'COMING_SOON'."""
        response = self.client.get(self.url, {"filter": "COMING_SOON"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data["results"] if "results" in response.data else response.data
        self.assertEqual(len(data), 2)
        for movie in data:
            self.assertEqual(movie["_type"], "COMING_SOON")

    def test_search_exact_title(self):
        """Test Case 4: Exact title search."""
        response = self.client.get(self.url, {"search": "Spider-Man"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data["results"] if "results" in response.data else response.data
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["title"], "Spider-Man")

    def test_search_vietnamese_unaccented(self):
        """Test Case 5: Vietnamese unaccented search."""
        response_1 = self.client.get(self.url, {"search": "bo gia"})
        self.assertEqual(response_1.status_code, status.HTTP_200_OK)
        data_1 = (
            response_1.data["results"]
            if "results" in response_1.data
            else response_1.data
        )
        self.assertEqual(len(data_1), 1)
        self.assertEqual(data_1[0]["title"], "Bố Già")
        response_2 = self.client.get(self.url, {"search": "lat mat"})
        self.assertEqual(response_2.status_code, status.HTTP_200_OK)
        data_2 = (
            response_2.data["results"]
            if "results" in response_2.data
            else response_2.data
        )
        self.assertEqual(len(data_2), 1)
        self.assertEqual(data_2[0]["title"], "Lật Mặt")

    def test_search_no_results(self):
        """Test Case 6: Zero results."""
        response = self.client.get(self.url, {"search": "NonExistentMovie123"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data["results"] if "results" in response.data else response.data
        self.assertEqual(len(data), 0)


@override_settings(CACHES=DUMMY_CACHES)
class TfidfMovieSearchTests(APITestCase):
    """Tests for TF-IDF based search across title, description, genres, casts."""

    def setUp(self):
        self.url = reverse("movie-list")
        today = timezone.now().date()
        yesterday = today - timedelta(days=1)

        Movie.objects.create(
            title="Haunted House",
            description="A group of friends explore an abandoned mansion and encounter terrifying ghosts.",
            genres="Horror, Thriller",
            directors="John Doe",
            casts="Alice Smith, Bob Jones",
            duration=95,
            release_date=yesterday,
        )
        Movie.objects.create(
            title="Space Journey",
            description="Astronauts embark on an interstellar mission to save humanity from extinction.",
            genres="Sci-Fi, Adventure",
            directors="Jane Doe",
            casts="Charlie Brown, Diana Prince",
            duration=140,
            release_date=yesterday,
        )
        Movie.objects.create(
            title="Love in Paris",
            description="A romantic comedy about two strangers who meet at a cafe in Paris.",
            genres="Romance, Comedy",
            directors="Pierre Dupont",
            casts="Emma Watson, Ryan Gosling",
            duration=110,
            release_date=yesterday,
        )

    def test_search_by_description_keyword(self):
        """Searching 'ghosts' should return 'Haunted House' (the word is in its description)."""
        response = self.client.get(self.url, {"search": "ghosts"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data["results"] if "results" in response.data else response.data
        titles = [m["title"] for m in data]
        self.assertIn("Haunted House", titles)

    def test_search_by_genre(self):
        """Searching 'horror' should return the horror movie."""
        response = self.client.get(self.url, {"search": "horror"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data["results"] if "results" in response.data else response.data
        titles = [m["title"] for m in data]
        self.assertIn("Haunted House", titles)

    def test_search_by_cast(self):
        """Searching for an actor name should return their movie."""
        response = self.client.get(self.url, {"search": "Emma Watson"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data["results"] if "results" in response.data else response.data
        titles = [m["title"] for m in data]
        self.assertIn("Love in Paris", titles)

    def test_relevance_ordering(self):
        """A movie matching in both title and description should rank higher."""
        # "Space" appears in the title "Space Journey" AND its description
        response = self.client.get(self.url, {"search": "space astronauts"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data["results"] if "results" in response.data else response.data
        self.assertGreater(len(data), 0)
        # Space Journey should be the top result
        self.assertEqual(data[0]["title"], "Space Journey")
