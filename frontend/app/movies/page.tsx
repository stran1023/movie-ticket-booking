"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import useSWR from "swr";
import { getMovies } from "@/lib/api/movies";
import { MovieCard } from "@/components/movie-card";
import { UpcomingMovieCard } from "@/components/upcoming-movie-card";
import { SearchField } from "@/components/search-field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FilterType = "all" | "NOW_SHOWING" | "COMING_SOON";

const filters: { label: string; value: FilterType }[] = [
  { label: "All", value: "all" },
  { label: "Now Showing", value: "NOW_SHOWING" },
  { label: "Coming Soon", value: "COMING_SOON" },
];

export default function MoviesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // 2. READ INITIAL STATE FROM THE URL
  const initialFilter = (searchParams.get("filter") as FilterType) || "all";
  const initialSearch = searchParams.get("search") || "";
  const initialPage = parseInt(searchParams.get("page") || "1", 10);

  // 3. SET STATE USING URL VALUES
  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [activeFilter, setActiveFilter] = useState<FilterType>(
    filters.some((f) => f.value === initialFilter) ? initialFilter : "all",
  );
  const [currentPage, setCurrentPage] = useState(initialPage);

  useEffect(() => {
    const params = new URLSearchParams();
    if (activeFilter !== "all") params.set("filter", activeFilter);
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (currentPage > 1) params.set("page", currentPage.toString());

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [activeFilter, debouncedSearch, currentPage, pathname, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (debouncedSearch !== search) {
        setDebouncedSearch(search);
        setCurrentPage(1);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [search, debouncedSearch]);

  const { data, error, isLoading } = useSWR(
    ["movies", activeFilter, debouncedSearch, currentPage],
    () =>
      getMovies({
        filter: activeFilter,
        search: debouncedSearch,
        page: currentPage.toString(),
      }),
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000,
    },
  );

  const movies = data?.results ? data.results : data || [];
  const totalPages = data?.count ? Math.ceil(data.count / 10) : 1;

  const subtitle =
    activeFilter === "NOW_SHOWING"
      ? "Browse all currently showing movies"
      : activeFilter === "COMING_SOON"
        ? "Browse movies coming soon to cinemas"
        : "Browse all available and upcoming movies";

  if (error) {
    return (
      <div className="mt-16 text-center">
        <p className="text-lg text-red-500">
          Failed to load movies. Please try again.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-foreground">Movies</h1>
        <p className="text-muted-foreground">{subtitle}</p>
      </div>

      {/* Filter Tabs */}
      <div className="mt-6 flex items-center gap-6 border-b">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => {
              setActiveFilter(f.value);
              setCurrentPage(1);
            }}
            className={cn(
              "relative pb-3 text-sm font-medium transition-colors cursor-pointer",
              activeFilter === f.value
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
            {activeFilter === f.value && (
              <span className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>

      {/* Search Field */}
      <div className="mt-6 max-w-md">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Search by title, description, genre, or cast..."
        />
      </div>

      {/* Loading & Results states */}
      {isLoading && movies.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-lg text-muted-foreground">Loading movies...</p>
        </div>
      ) : movies.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-lg text-muted-foreground">
            No movies found matching &quot;{search}&quot;
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {movies.map((movie: any) =>
            movie._type === "COMING_SOON" ? (
              <UpcomingMovieCard key={movie.id} movie={movie} />
            ) : (
              <MovieCard key={movie.id} movie={movie} />
            ),
          )}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-12 flex items-center justify-center gap-4">
          <Button
            variant="outline"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          >
            Previous
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              Page
            </span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val) && val >= 1 && val <= totalPages) {
                  setCurrentPage(val);
                }
              }}
              className="w-16 rounded-md border border-input bg-background px-3 py-1 text-center text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <span className="text-sm font-medium text-muted-foreground">
              of {totalPages}
            </span>
          </div>
          <Button
            variant="outline"
            disabled={currentPage === totalPages}
            onClick={() =>
              setCurrentPage((prev) => Math.min(totalPages, prev + 1))
            }
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
