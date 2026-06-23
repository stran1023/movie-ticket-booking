from apps.movies.models import Movie
from django.utils import timezone
from datetime import timedelta

# Get today's date (March 16, 2026)
today = timezone.now().date()

# Fetch all 45 movies
movies = list(Movie.objects.all())

# 1. Create 2 "Overdue" Movies (Target: ENDED)
for movie in movies[0:2]:
    movie.status = "NOW_SHOWING"
    movie.release_date = today - timedelta(days=30)
    movie.end_date = today - timedelta(days=2)  # Ended 2 days ago!
    movie.save()

# 2. Create 3 "Just Released" Movies (Target: NOW_SHOWING)
for movie in movies[2:5]:
    movie.status = "COMING_SOON"
    movie.release_date = today - timedelta(days=1)  # Released yesterday!
    movie.end_date = today + timedelta(days=30)
    movie.save()

# 3. Create 10 "Future" Movies (Target: COMING_SOON)
for movie in movies[5:15]:
    movie.status = "COMING_SOON"
    movie.release_date = today + timedelta(days=14)  # Releases in 2 weeks
    movie.end_date = today + timedelta(days=45)
    movie.save()

# 4. Create the rest as Normal Movies (Target: NOW_SHOWING)
for movie in movies[15:]:
    movie.status = "NOW_SHOWING"
    movie.release_date = today - timedelta(days=10)  # Released 10 days ago
    movie.end_date = today + timedelta(days=20)  # Ends in 20 days
    movie.save()

print("All 45 movies successfully populated with test dates!")
