from locust import HttpUser, task, between
import random


class MovieBrowserUser(HttpUser):
    # This makes the virtual user wait between 1 and 3 seconds after every task,
    # simulating a real human reading the page before clicking again.
    wait_time = between(1, 3)

    @task(3)
    def view_default_movie_list(self):
        """Simulates loading the main /movies page (All movies)"""
        self.client.get("/api/movies/")

    @task(2)
    def view_now_showing(self):
        """Simulates clicking the 'Now Showing' tab"""
        self.client.get("/api/movies/?filter=NOW_SHOWING")

    @task(1)
    def search_movies(self):
        """Simulates searching for a specific movie"""
        # Pick a random search term to prevent the database from perfectly caching one query
        search_terms = ["doraemon", "moana 2026", "thanh guom diet quy", "spider"]
        term = random.choice(search_terms)

        # We use the 'name' parameter so Locust groups all these random searches
        # together under one clean label in the analytics dashboard.
        self.client.get(
            "/api/movies/", params={"search": term}, name="/api/movies/?search=[term]"
        )

    @task(2)
    def view_movie_detail(self):
        """Simulates clicking on a specific movie card (IDs 1 through 10)"""
        movie_id = random.randint(1, 10)
        self.client.get(f"/api/movies/{movie_id}/", name="/api/movies/[id]/")
