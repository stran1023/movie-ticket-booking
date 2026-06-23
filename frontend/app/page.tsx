import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Film, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MovieCard } from "@/components/movie-card";
import { UpcomingMovieCard } from "@/components/upcoming-movie-card";

import { getMovies } from "@/lib/api/movies";
import { promotions as mockPromotions } from "@/lib/mock-data";
import type { Promotion } from "@/lib/mock-data";
import { PromotionCard } from "@/components/promotion-card";
// NOTE: For now we derive featured promotions from mock data
// while the dedicated Promotions page consumes the real API.

export default async function HomePage() {
  const [availableData, upcomingData] = await Promise.all([
    getMovies({ filter: "NOW_SHOWING" }),
    getMovies({ filter: "COMING_SOON" }),
  ]);

  const availableList = availableData.results
    ? availableData.results
    : availableData;
  const upcomingList = upcomingData.results
    ? upcomingData.results
    : upcomingData;

  const nowShowing = availableList.slice(0, 4);
  const upcoming = upcomingList.slice(0, 4);
  const featuredPromos: Promotion[] = mockPromotions.slice(0, 2);

  const backgroundPosters = [...availableList, ...upcomingList]
    .map((movie: any) => movie.poster_url)
    .filter(Boolean)
    .slice(0, 8);

  const totalAvailable =
    availableData.count !== undefined
      ? availableData.count
      : availableList.length;
  const totalUpcoming =
    upcomingData.count !== undefined ? upcomingData.count : upcomingList.length;
  const totalMovies = totalAvailable + totalUpcoming;

  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-background">
        {backgroundPosters.length > 0 && (
          <div className="absolute inset-0 z-0 flex items-center justify-center opacity-40 pointer-events-none overflow-hidden">
            <div className="flex flex-col gap-4 -rotate-6">
              <div className="flex w-max animate-marquee gap-4">
                {[...backgroundPosters, ...backgroundPosters].map(
                  (url, idx) => (
                    <Image
                      key={`row1-${idx}`}
                      src={url}
                      alt=""
                      width={256}
                      height={384}
                      priority={false}
                      unoptimized
                      className="h-96 w-64 object-cover rounded-xl shadow-2xl"
                    />
                  ),
                )}
              </div>

              {/* Row 2: Scrolling Right */}
              <div className="flex w-max animate-marquee-reverse gap-4 ml-[-25%]">
                {[...backgroundPosters, ...backgroundPosters]
                  .reverse()
                  .map((url, idx) => (
                    <Image
                      key={`row2-${idx}`}
                      src={url}
                      alt=""
                      width={256}
                      height={384}
                      className="h-96 w-64 object-cover rounded-xl shadow-2xl"
                    />
                  ))}
              </div>
            </div>
          </div>
        )}
        <div className="absolute inset-0 z-0 bg-linear-to-br from-background/90 via-background/30 to-background/90" />

        {/* Foreground Content */}
        <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 py-20 text-center lg:py-28">
          <div className="flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary backdrop-blur-sm">
            <Film className="h-4 w-4" />
            Now Showing
          </div>
          <h1 className="max-w-3xl text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl drop-shadow-sm">
            Your Movie Experience Starts Here
          </h1>
          <p className="max-w-xl text-pretty text-lg text-muted-foreground leading-relaxed drop-shadow-sm">
            Browse the latest movies, pick your perfect seats, and book your
            tickets in minutes. Cinema magic is just a few clicks away.
          </p>

          <div className="mt-8 flex gap-8 text-center bg-background/50 p-6 rounded-2xl backdrop-blur-md border border-border/50 shadow-sm">
            <div>
              <p className="text-2xl font-bold text-foreground">
                {totalMovies > 0 ? `${totalMovies}+` : "..."}
              </p>
              <p className="text-sm text-muted-foreground">Movies</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">5</p>
              <p className="text-sm text-muted-foreground">Halls</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {featuredPromos.length}
              </p>
              <p className="text-sm text-muted-foreground">Promotions</p>
            </div>
          </div>
        </div>
      </section>

      {/* Now Showing */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Now Showing</h2>
            <p className="mt-1 text-muted-foreground">
              Catch the latest blockbusters on the big screen
            </p>
          </div>
          <Link href="/movies?filter=NOW_SHOWING">
            <Button variant="ghost" className="gap-1 text-primary">
              View All <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        {nowShowing.length === 0 ? (
          <div className="mt-8 text-center text-muted-foreground">
            No movies currently showing.
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {nowShowing.map((movie: any) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>
        )}
      </section>

      {/* Upcoming */}
      <section className="bg-muted/20 py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Upcoming</h2>
              <p className="mt-1 text-muted-foreground">
                Get excited for these upcoming releases
              </p>
            </div>
            <Link href="/movies?filter=COMING_SOON">
              <Button variant="ghost" className="gap-1 text-primary">
                View All <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <div className="mt-8 text-center text-muted-foreground">
              No upcoming movies scheduled.
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {upcoming.map((movie: any) => (
                <UpcomingMovieCard key={movie.id} movie={movie} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Promotions */}
      <section className="bg-muted/30 py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Promotions</h2>
              <p className="mt-1 text-muted-foreground">
                Special deals and offers for movie lovers
              </p>
            </div>
            <Link href="/promotions">
              <Button variant="ghost" className="gap-1 text-primary">
                View All <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
            {featuredPromos.map((promo) => (
              <PromotionCard key={promo.id} promotion={promo} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="rounded-2xl bg-linear-to-r from-primary/10 to-accent/10 p-8 text-center lg:p-12">
          <Users className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-4 text-2xl font-bold text-foreground">
            Become a Member
          </h2>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground leading-relaxed">
            Earn points on every booking, get exclusive promotions, and enjoy a
            seamless ticket booking experience.
          </p>
          <Link href="/register">
            <Button size="lg" className="mt-6 gap-2">
              Register Now
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
