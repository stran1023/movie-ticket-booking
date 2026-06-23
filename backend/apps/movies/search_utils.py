"""
TF-IDF based movie search utility.

Builds a combined text corpus from each movie's title, description, genres,
directors, and casts fields, then uses cosine similarity to rank results by
relevance to the search query.
"""

import unicodedata
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def _strip_accents(text: str) -> str:
    """Remove Vietnamese/Unicode accents and normalize text."""
    clean = text.replace("Đ", "D").replace("đ", "d")
    normalized = unicodedata.normalize("NFD", clean)
    stripped = "".join(c for c in normalized if unicodedata.category(c) != "Mn")
    return stripped.lower()


def _build_document(movie) -> str:
    """
    Combine all searchable fields of a movie into a single text document.
    Each field is included twice if it's high-priority (title) to boost its weight.
    """
    parts = []

    # Title gets extra weight by being repeated
    title = movie.title or ""
    parts.append(title)
    parts.append(title)

    # Description is the main body
    if movie.description:
        parts.append(movie.description)

    # Genres, directors, casts
    if movie.genres:
        parts.append(movie.genres)
    if movie.directors:
        parts.append(movie.directors)
    if movie.casts:
        parts.append(movie.casts)

    combined = " ".join(parts)
    # Also create an accent-stripped version for Vietnamese support
    return combined + " " + _strip_accents(combined)


def tfidf_search(query: str, movies, min_score: float = 0.01):
    """
    Perform TF-IDF search across movies.

    Args:
        query: The search query string.
        movies: A list/queryset of Movie objects.
        min_score: Minimum cosine similarity score to include in results.

    Returns:
        List of movie IDs ordered by descending relevance score.
    """
    if not query or not movies:
        return []

    movie_list = list(movies)
    if not movie_list:
        return []

    # Build document corpus
    documents = [_build_document(m) for m in movie_list]
    movie_ids = [m.id for m in movie_list]

    # Normalize the query (strip accents for Vietnamese support)
    normalized_query = query + " " + _strip_accents(query)

    # Build TF-IDF matrix
    vectorizer = TfidfVectorizer(
        stop_words="english",
        ngram_range=(1, 2),  # Unigrams and bigrams for better matching
        max_features=10000,
        sublinear_tf=True,  # Apply log normalization to term frequencies
    )

    try:
        tfidf_matrix = vectorizer.fit_transform(documents)
        query_vector = vectorizer.transform([normalized_query])
    except ValueError:
        # If vocabulary is empty (e.g., all documents are empty)
        return []

    # Compute cosine similarity
    similarities = cosine_similarity(query_vector, tfidf_matrix).flatten()

    # Build scored results, filtering by minimum score
    scored = [
        (movie_ids[i], similarities[i])
        for i in range(len(movie_ids))
        if similarities[i] >= min_score
    ]

    # Sort by descending score
    scored.sort(key=lambda x: x[1], reverse=True)

    return [movie_id for movie_id, _score in scored]
