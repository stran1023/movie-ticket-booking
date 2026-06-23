import type { Promotion } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

export function PromotionCard({
  promotion,
  className,
}: {
  promotion: Promotion;
  className?: string;
}) {
  return (
    <Link
      href={`/promotions/${promotion.id}?type=${promotion.promotionType}`}
      className="cursor-pointer transition-transform hover:scale-[1.02]"
    >
      <div
        className={cn(
          "overflow-hidden rounded-xl border bg-card shadow-md flex flex-col h-full",
          className,
        )}
      >
        {/* Banner */}
        <div className="relative overflow-hidden rounded-lg">
          {promotion.bannerUrl ? (
            <img
              src={promotion.bannerUrl}
              alt={promotion.title}
              className="w-full h-48 object-cover"
            />
          ) : (
            <div
              className={cn(
                "w-full h-48 flex items-center justify-center text-lg font-semibold text-primary-foreground",
                promotion.bannerColor,
              )}
            >
              {promotion.title}
            </div>
          )}
          <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground text-sm px-3 py-1 shadow">
            {promotion.discount}
          </Badge>
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 p-5">
          <h3 className="text-lg font-bold text-card-foreground leading-snug">
            {promotion.title}
          </h3>
          <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            <span>
              {promotion.startDate} – {promotion.endDate}
            </span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            {promotion.description}
          </p>
        </div>
      </div>
    </Link>
  );
}
