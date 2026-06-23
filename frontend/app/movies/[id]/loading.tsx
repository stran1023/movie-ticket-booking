export default function Loading() {
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-6xl">
        {/* Fake Back Button */}
        <div className="mb-6 h-5 w-32 animate-pulse rounded bg-muted"></div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Fake Poster */}
          <div className="aspect-2/3 w-full animate-pulse rounded-xl bg-muted/50"></div>

          {/* Fake Details */}
          <div className="md:col-span-2 flex flex-col gap-6">
            <div className="h-12 w-3/4 animate-pulse rounded-lg bg-muted/50"></div>
            <div className="flex gap-4">
              <div className="h-8 w-24 animate-pulse rounded-full bg-muted/50"></div>
              <div className="h-8 w-24 animate-pulse rounded-full bg-muted/50"></div>
            </div>
            <div className="h-32 w-full animate-pulse rounded-xl bg-muted/50"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
