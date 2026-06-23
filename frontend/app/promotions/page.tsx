// app/promotions/page.tsx
import { PromotionCard } from "@/components/promotion-card";
import { getPromotions } from "@/lib/api/promotions";

export default async function PromotionsPage() {
  const promotions = await getPromotions();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-foreground">Promotions</h1>
        <p className="text-muted-foreground">
          Special deals and offers to make your movie experience even better
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {promotions.map((promo) => (
          <PromotionCard
            key={`${promo.promotionType}-${promo.id}`}
            promotion={promo}
          />
        ))}
      </div>
    </div>
  );
}
