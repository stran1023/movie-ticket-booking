// app/promotions/[id]/page.tsx
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Ticket, Info } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Promotion } from "@/lib/mock-data";
// refactor later inside promotions api views
async function getPromotionDetail(
  id: string,
  type: string,
): Promise<Promotion | null> {
  const res = await fetch(
    `http://localhost:8000/api/promotions/${id}/?type=${type}`,
    {
      cache: "no-store",
    },
  );

  if (!res.ok) return null;
  return res.json();
}

export default async function PromotionDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type: string }>;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;

  const id = params.id;
  const type = searchParams.type || "MOVIE";

  const promo = await getPromotionDetail(id, type);

  if (!promo) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-xl font-semibold text-foreground">
          Promotion not found
        </h2>
        <Link
          href="/promotions"
          className="text-primary hover:underline mt-2 inline-block"
        >
          Return to all promotions
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/promotions" className="text-sm text-primary hover:underline">
        ← Back to all promotions
      </Link>

      {/* Banner image with badge overlay */}
      <div className="relative mt-6 overflow-hidden rounded-2xl shadow-sm">
        {promo.bannerUrl ? (
          <img
            src={promo.bannerUrl}
            alt={promo.title}
            className="w-full h-64 object-cover"
          />
        ) : (
          <div className="w-full h-64 bg-gradient-to-r from-primary/10 to-accent/20 flex items-center justify-center text-2xl font-bold text-primary-foreground">
            {promo.title}
          </div>
        )}
        <Badge className="absolute top-4 left-4 bg-primary text-primary-foreground text-lg px-4 py-1 shadow">
          {promo.discount}
        </Badge>
      </div>

      <div className="mt-8 space-y-6">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground">
            {promo.title}
          </h1>
          <div className="mt-3 flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="h-5 w-5" />
            <span className="font-medium">
              Valid: {promo.startDate} — {promo.endDate}
            </span>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/30 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Info className="h-5 w-5 text-primary" />
            Offer Details
          </h2>
          <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
            {promo.description}
          </p>
          {promo.code && (
            <div className="mt-4 p-3 bg-primary/10 border border-dashed border-primary rounded-md text-center">
              <span className="text-xs uppercase text-muted-foreground font-bold block mb-1">
                Use Code
              </span>
              <span className="text-2xl font-mono font-bold text-primary tracking-widest">
                {promo.code}
              </span>
            </div>
          )}
        </div>

        <Button
          asChild
          size="lg"
          className="w-full gap-2 text-lg py-6"
          aria-label="Redeem this offer"
        >
          <Link href={`/booking`}>
            <Ticket className="h-5 w-5" />
            Redeem This Offer
          </Link>
        </Button>
      </div>
    </div>
  );
}
