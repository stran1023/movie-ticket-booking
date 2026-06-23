"use client";

import Link from "next/link";
import { Clock, ShieldAlert, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function getRatingBadgeClass(rating?: string) {
  const value = (rating ?? "").toUpperCase().trim();

  if (value.includes("18") || value.includes("16")) {
    return "bg-red-600 text-white ring-1 ring-red-300/60";
  }

  return "bg-yellow-700 text-white ring-1 ring-white/20";
}

export function MovieCard({
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
      {/* Poster Image Container */}
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

        {/* Top Right: Versions Overlay */}
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

        {/* Bottom Left: Rating Overlay */}
        {movie.rating && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1">
            <span
              className={cn(
                "shrink-0 border-2 text-white rounded-md px-2 py-0.5 text-[12px] font-bold uppercase",
                getRatingBadgeClass(movie.rating),
              )}
            >
              {movie.rating}
            </span>
          </div>
        )}

        {/* Hover State: Book Now Button */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/60 group-hover:opacity-100 z-10">
          <Link href={`/booking?movieId=${movie.id}`}>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-md">
              Book Now
            </Button>
          </Link>
        </div>
      </div>

      {/* Card Content Below Poster */}
      <Link href={`/movies/${movie.id}`}>
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="line-clamp-1 text-balance font-semibold text-card-foreground">
              {movie.title}
            </h3>
          </div>

          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>{movie.runtime}</span>
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {movie.description || "No description available."}
          </p>
        </div>
      </Link>
    </div>
  );
}
