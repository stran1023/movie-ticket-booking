import Link from "next/link";
import Image from "next/image";
import { Clock, Calendar, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/back-button";
import RemindMeButton from "@/components/remind-button";
import { getMovieById, toTitleCase } from "@/lib/api/movies";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    const resolvedParams = await params;
    const movie = await getMovieById(resolvedParams.id);
    return {
      title: `${toTitleCase(movie.title)} | CineBook`,
      description: movie.description || "Book tickets now.",
      openGraph: {
        images: [movie.poster_url],
      },
    };
  } catch (error) {
    return { title: "Movie Not Found" };
  }
}

export default async function MovieDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let movie = null;
  let errorMsg = "";

  try {
    const resolvedParams = await params;
    movie = await getMovieById(resolvedParams.id);
  } catch (err: any) {
    errorMsg = err.message || "Failed to fetch movie";
  }

  if (errorMsg || !movie) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
        <h1 className="text-3xl font-bold">{errorMsg || "Movie not found"}</h1>
        <Button asChild variant="outline">
          <Link href="/movies">Back to Movies</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Dynamic Background Blur Layer */}
      {movie.poster_url && (
        <div className="absolute inset-0 z-0 pointer-events-none">
          <Image
            src={movie.poster_url}
            alt=""
            fill
            priority
            className="object-cover opacity-25 blur-[120px] saturate-150"
          />
          <div className="absolute inset-0 bg-linear-to-b from-transparent via-background/60 to-background" />
        </div>
      )}

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8">
        <BackButton />

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Left Column: Poster & Quick Info */}
          <div className="flex flex-col gap-4">
            <div className="relative aspect-2/3 w-full overflow-hidden rounded-xl bg-gray-800 shadow-2xl ring-1 ring-white/10">
              {movie.poster_url ? (
                <Image
                  src={movie.poster_url}
                  alt={`${movie.title} poster`}
                  fill
                  priority
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-gray-700 text-gray-500">
                  No Poster Available
                </div>
              )}
            </div>
            <div className="flex flex-col gap-3">
              {/* SWAP START: Conditionally show Book Tickets OR Remind Me */}
              {movie._type === "NOW_SHOWING" ? (
                <Link href={`/booking?movieId=${movie.id}`} className="w-full">
                  <Button
                    className="w-full text-lg shadow-lg shadow-primary/20"
                    size="lg"
                  >
                    Book Tickets Now
                  </Button>
                </Link>
              ) : (
                <div className="w-full">
                  <RemindMeButton movieId={movie.id} status={movie._type} />
                </div>
              )}
              {/* SWAP END */}

              {movie.trailer_url && (
                <Link
                  href={movie.trailer_url}
                  target="_blank"
                  rel="noopener"
                  className="w-full"
                >
                  <Button
                    variant="outline"
                    className="w-full text-lg backdrop-blur-sm bg-background/50"
                    size="lg"
                  >
                    <Video className="mr-2 h-5 w-5" />
                    Watch Trailer
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* Right Column: Movie Details */}
          <div className="md:col-span-2">
            <div className="mb-4 flex items-center gap-3">
              <Badge
                variant="secondary"
                className={
                  movie._type === "NOW_SHOWING"
                    ? "bg-primary/10 text-primary border-primary/20"
                    : "bg-red-500/10 text-red-500 border-red-500/20"
                }
              >
                {movie._type === "NOW_SHOWING" ? "Now Showing" : "Coming Soon"}
              </Badge>
              {movie.rating && (
                <Badge
                  variant="outline"
                  className="border-amber-400/50 bg-amber-400/10 text-amber-500 backdrop-blur-sm"
                >
                  {movie.rating}
                </Badge>
              )}
            </div>

            <h1 className="text-4xl font-bold text-foreground sm:text-5xl drop-shadow-sm">
              {movie.title}
            </h1>

            <div className="mt-6 flex flex-wrap items-center gap-6 text-muted-foreground">
              {movie.runtime && (
                <div className="flex items-center gap-2 bg-background/40 px-3 py-1.5 rounded-full backdrop-blur-sm">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm font-medium">{movie.runtime}</span>
                </div>
              )}
              {movie.release_date && (
                <div className="flex items-center gap-2 bg-background/40 px-3 py-1.5 rounded-full backdrop-blur-sm">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {movie.release_date}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-wrap gap-2">
              {movie.genres?.map((genre: string) => (
                <Badge
                  key={genre}
                  variant="secondary"
                  className="bg-secondary/50 backdrop-blur-sm"
                >
                  {genre}
                </Badge>
              ))}
            </div>

            <div className="mt-8 rounded-2xl bg-background/40 p-6 backdrop-blur-md border border-white/5 shadow-sm">
              <h2 className="text-xl font-semibold">Synopsis</h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                {movie.description ||
                  "No description available for this movie."}
              </p>
            </div>

            {/* Expanded Details Grid */}
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 rounded-2xl bg-background/40 p-6 backdrop-blur-md border border-white/5 shadow-sm">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Director
                </h3>
                <p className="mt-1 font-medium">
                  {movie.director || "Unknown"}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Cast
                </h3>
                <p className="mt-1 font-medium">{movie.casts || "Unknown"}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Available Versions
                </h3>
                <div className="mt-2 flex gap-2">
                  {movie.version?.length > 0 ? (
                    movie.version.map((v: string) => (
                      <Badge
                        key={v}
                        variant="outline"
                        className="bg-background/50"
                      >
                        {v}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm">Standard 2D</span>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Languages & Subtitles
                </h3>
                <p className="mt-1 font-medium">
                  {movie.languages_subtitles || "Standard"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
