import { Film } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="flex animate-pulse flex-col items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20 text-primary">
          <Film className="h-8 w-8 animate-spin-slow" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">
          Loading CineBook...
        </h2>
      </div>
    </div>
  );
}
