"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { selectMovie, nextStep } from "@/lib/store/slices/bookingSlice";
import { fetchMovies } from "@/lib/api/cinemas";
import type { Movie } from "@/lib/mock-data";
import { SearchField } from "@/components/search-field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Film,
  Clock,
  Check,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export function StepMovie() {
  const dispatch = useAppDispatch();
  const selectedMovieId = useAppSelector((s) => s.booking.selectedMovieId);

  const [searchInput, setSearchInput] = useState("");

  const [searchTerm, setSearchTerm] = useState("");

  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);

  const itemsPerPage = 10;
  const totalPages = useMemo(
    () => (totalCount > 0 ? Math.ceil(totalCount / itemsPerPage) : 1),
    [totalCount, itemsPerPage],
  );

  useEffect(() => {
    let isCancelled = false;
    setLoading(true);

    fetchMovies("available", currentPage, searchTerm)
      .then((data) => {
        if (isCancelled) return;
        setMovies(data.movies);
        setTotalCount(data.total);
        setHasNextPage(data.hasNextPage);
      })
      .catch((err) => {
        console.error("Failed to fetch movies", err);
        if (!isCancelled) {
          setMovies([]);
          setTotalCount(0);
          setHasNextPage(false);
        }
      })
      .finally(() => {
        if (!isCancelled) setLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [currentPage, searchTerm]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
  }, []);

  const handleSearchSubmit = useCallback(() => {
    setCurrentPage(1);
    setSearchTerm(searchInput.trim());
  }, [searchInput]);

  const handleNextPage = () => {
    if (hasNextPage) setCurrentPage((p) => p + 1);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage((p) => p - 1);
  };

  if (loading && movies.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading movies...</span>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground">Select a Movie</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Choose the movie you want to watch
      </p>

      {/* Search bar + button */}
      <div className="mt-4 flex max-w-md gap-2">
        <SearchField
          value={searchInput}
          onChange={handleSearchChange}
          placeholder="Search movies..."
        />
        <Button onClick={handleSearchSubmit} disabled={loading}>
          Search
        </Button>
      </div>

      {/* Movie grid */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {movies.map((movie) => {
          const isSelected = selectedMovieId === movie.id;
          const hasPoster = !!movie.posterUrl;

          return (
            <button
              key={movie.id}
              onClick={() => dispatch(selectMovie(movie.id))}
              className={cn(
                "flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all",
                isSelected
                  ? "border-primary bg-primary/5 shadow-md"
                  : "border-border bg-card hover:border-primary/30 hover:shadow-sm",
              )}
            >
              {hasPoster ? (
                <img
                  src={movie.posterUrl}
                  alt={movie.title}
                  className="h-16 w-12 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-gray-700 to-gray-900">
                  <Film className="h-6 w-6 text-white/30" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-semibold text-foreground">
                    {movie.title}
                  </h3>
                  {isSelected && (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {movie.runtime} min
                </div>
                <div className="mt-1 flex gap-1">
                  {movie.version.map((v) => (
                    <Badge
                      key={v}
                      variant="secondary"
                      className="px-1.5 py-0 text-[10px]"
                    >
                      {v}
                    </Badge>
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {movies.length === 0 && !loading && (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          No movies found{searchTerm ? ` for "${searchTerm}"` : ""}.
        </p>
      )}

      {/* Pagination Controls */}
      <div className="mt-8 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Page {totalPages === 0 ? 0 : currentPage} of {totalPages} (
          {totalCount} total movies)
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handlePrevPage}
            disabled={currentPage === 1 || loading}
            variant="outline"
            size="sm"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            onClick={handleNextPage}
            disabled={!hasNextPage || loading}
            variant="outline"
            size="sm"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Next step */}
      <div className="mt-8 flex justify-end">
        <Button
          onClick={() => dispatch(nextStep())}
          disabled={!selectedMovieId}
          size="lg"
        >
          Next: Select Showtime
        </Button>
      </div>
    </div>
  );
}
