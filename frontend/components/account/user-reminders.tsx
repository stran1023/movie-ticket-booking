"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bell, Calendar } from "lucide-react";
import apiClient from "@/lib/api/client";

export function UserReminders() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [movies, setMovies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReminders = async () => {
      try {
        const response = await apiClient.get("/me/reminders/");
        setMovies(response.data);
      } catch (error) {
        console.error("Failed to fetch reminders:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReminders();
  }, []);

  if (loading) return null; // Fail silently while loading

  if (movies.length === 0) return null; // Don't show the section if they have no reminders

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-4">
        <Bell className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">
          Coming Soon Alerts
        </h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {movies.map((movie) => (
          <Link
            key={movie.id}
            href={`/movies/${movie.id}`}
            className="group relative flex flex-col gap-2 rounded-xl border bg-card p-3 transition-colors hover:border-primary/50"
          >
            <div className="relative aspect-2/3 w-full overflow-hidden rounded-lg bg-muted">
              {movie.poster_url ? (
                <Image
                  src={movie.poster_url}
                  alt={movie.title}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  No Poster
                </div>
              )}
            </div>
            <div className="flex flex-col">
              <span
                className="truncate text-sm font-semibold"
                title={movie.title}
              >
                {movie.title}
              </span>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <Calendar className="h-3 w-3" />
                <span>{movie.release_date || "TBA"}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
