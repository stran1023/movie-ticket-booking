"use client";

import Link from "next/link";
import { Clock, Star, CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function formatReleaseDate(dateStr?: string) {
  if (!dateStr) return "Date TBD";
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function UpcomingMovieCard({
  movie,
  className,
}: {
  movie: any;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg",
        className,
      )}
    >
      <div className="relative flex h-64 items-center justify-center bg-gray-800 overflow-hidden">
        {movie.poster_url ? (
          <img
            src={movie.poster_url}
            alt={movie.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <Star className="h-16 w-16 text-white/30" />
        )}

        <div className="absolute right-2 top-2 flex gap-1">
          {movie.version?.map((v: string) => (
            <Badge
              key={v}
              variant="secondary"
              className="bg-black/60 text-xs text-white backdrop-blur"
            >
              {v}
            </Badge>
          ))}
        </div>

        {movie.release_date && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 backdrop-blur">
            <CalendarDays className="h-3.5 w-3.5 text-white" />
            <span className="text-xs font-medium text-white">
              {formatReleaseDate(movie.release_date)}
            </span>
          </div>
        )}

        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/60 group-hover:opacity-100 z-10">
          <span className="rounded-md bg-muted px-4 py-2 text-sm font-semibold text-muted-foreground shadow-md">
            Coming Soon
          </span>
        </div>
      </div>

      <Link href={`/movies/${movie.id}`}>
        <div className="p-4">
          <h3 className="text-balance font-semibold text-card-foreground line-clamp-1">
            {movie.title}
          </h3>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>{movie.runtime || "--"}</span>
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {movie.description || "No description available."}
          </p>
        </div>
      </Link>
    </div>
  );
}
