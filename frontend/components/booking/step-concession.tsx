"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Minus,
  Plus,
  Check,
  Star,
  Flame,
  Waves,
  Zap,
  Diamond,
  Heart,
} from "lucide-react";
import { fetchComboComponents, fetchConcessions } from "@/lib/api/concessions";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  nextStep,
  addConcession,
  updateConcessionQuantity,
  removeConcession,
} from "@/lib/store/slices/bookingSlice";
import type { Concession, ConcessionVariant } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn, formatMoney } from "@/lib/utils";
import { useBookingNav } from "@/components/booking/booking-nav-context";

type CategoryGroup = {
  displayName: string;
  items: Concession[];
};

type VariantItem = {
  type: "variant";
  id: string;
  variant: ConcessionVariant;
  concession: Concession;
  poster?: any;
  icon: React.ReactElement;
};

type ComboItem = {
  type: "combo";
  id: string;
  concession: Concession;
  poster?: any;
  icon: React.ReactElement;
};

type SellableItem = VariantItem | ComboItem;

export function StepConcession() {
  const dispatch = useAppDispatch();
  const { requestStep } = useBookingNav();
  const currentStep = useAppSelector((s) => s.booking.currentStep);

  const [concessions, setConcessions] = useState<Concession[]>([]);
  const [loading, setLoading] = useState(true);
  const [comboPrices, setComboPrices] = useState<Record<string, number>>({});
  const [comboSubtitles, setComboSubtitles] = useState<Record<string, string>>(
    {},
  );

  const selectedConcessions = useAppSelector(
    (s) => s.booking.selectedConcessions,
  );

  useEffect(() => {
    let mounted = true;

    fetchConcessions().then(async (data) => {
      if (mounted) {
        setConcessions(data);
        setLoading(false);

        const combos = data.filter((c) => c.isCombo);
        const priceMap: Record<string, number> = {};
        const subtitleMap: Record<string, string> = {};

        await Promise.all(
          combos.map(async (combo) => {
            try {
              const components = await fetchComboComponents(combo.id);
              priceMap[`combo-${combo.id}`] = components.reduce(
                (sum, c) => sum + Number(c.variant.in_combo_price) * c.quantity,
                0,
              );
              subtitleMap[`combo-${combo.id}`] = components
                .map(
                  (c) =>
                    `${c.quantity} x ${c.variant.concession.name} ${c.variant.name}`,
                )
                .join(", ");
            } catch (e) {
              console.error("Failed to load combo price", combo.id, e);
              priceMap[`combo-${combo.id}`] = NaN;
            }
          }),
        );

        setComboPrices(priceMap);
        setComboSubtitles(subtitleMap);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const categorizedItems = useMemo(() => {
    return concessions.reduce(
      (acc, concession) => {
        if (!concession.isActive || concession.isCombo) return acc;
        const key = concession.category;
        const displayName =
          concession.categoryDisplayName ||
          concession.category.charAt(0).toUpperCase() +
            concession.category.slice(1);

        if (!acc[key]) acc[key] = { displayName, items: [] as Concession[] };
        acc[key].items.push(concession);
        return acc;
      },
      {} as Record<string, CategoryGroup>,
    );
  }, [concessions]);

  const combos = useMemo(() => {
    return concessions.filter((c) => c.isActive && c.isCombo);
  }, [concessions]);

  const selectedItemIds = useMemo(
    () => new Set(selectedConcessions.map((x) => x.variantId)),
    [selectedConcessions],
  );

  const totalPrice = useMemo(
    () => selectedConcessions.reduce((sum, item) => sum + item.lineTotal, 0),
    [selectedConcessions],
  );

  const handleNext = useCallback(() => {
    dispatch(nextStep()); // Step 4 -> Step 5 Confirm
  }, [dispatch]);

  const handleSelectItem = useCallback(
    async (item: SellableItem) => {
      const isSelected = selectedItemIds.has(item.id);

      if (isSelected) {
        dispatch(removeConcession(item.id));
        return;
      }

      if (item.type === "variant") {
        dispatch(
          addConcession({
            variantId: item.id,
            displayName: `${item.concession.name} - ${item.variant.name}`,
            quantity: 1,
            unitPrice: item.variant.basePrice,
            lineTotal: item.variant.basePrice,
          }),
        );
      } else {
        const price = comboPrices[item.id];

        if (!Number.isFinite(price)) {
          return;
        }

        dispatch(
          addConcession({
            variantId: item.id,
            displayName: item.concession.name,
            quantity: 1,
            unitPrice: price,
            lineTotal: price,
          }),
        );
      }
    },
    [dispatch, selectedItemIds, comboPrices],
  );

  const ConcessionSection = ({
    title,
    items,
    limit,
  }: {
    title: string;
    items: Concession[];
    limit?: number;
  }) => {
    let count = 0;
    const allItems = items.flatMap<SellableItem | null>((concession) => {
      if (limit && count >= limit) {
        return null;
      }

      const poster = concession.imageUrl;
      const icon = poster ? (
        <img
          className="h-full w-full object-cover rounded-xl"
          src={poster}
          alt={concession.name}
        />
      ) : (
        <Star className="h-full w-full object-cover rounded-xl" />
      );

      let items: SellableItem[];

      if (!concession.isCombo) {
        items = concession.variants
          .filter((v) => v.isActive)
          .map<VariantItem>((variant) => ({
            type: "variant" as const,
            id: variant.id,
            variant,
            concession,
            poster,
            icon,
          }));
      } else {
        items = [
          {
            type: "combo" as const,
            id: `combo-${concession.id}`,
            concession,
            poster,
            icon,
          } satisfies ComboItem,
        ];
      }

      count += items.length;

      return items;
    });

    return (
      <div className="space-y-3">
        <h4 className="font-semibold text-foreground">{title}</h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(limit ? allItems.slice(0, limit) : allItems)
            .filter((x) => x != null)
            .map((item) => {
              const { icon } = item;

              const isSelected = selectedItemIds.has(item.id);

              const title = item.concession.name;

              const subtitle =
                item.type === "variant"
                  ? item.variant.name
                  : item.id in comboSubtitles
                    ? comboSubtitles[item.id]
                    : "Combo";

              const isPriceReady =
                item.type === "variant" ||
                Number.isFinite(comboPrices[item.id]);

              const price =
                item.type === "variant"
                  ? item.variant.basePrice
                  : (comboPrices[item.id] ?? 0);

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectItem(item)}
                  disabled={!isPriceReady}
                  className={cn(
                    "flex w-full items-start gap-4 rounded-xl border p-4 text-left transition-all",
                    isSelected
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border bg-card hover:border-primary/30 hover:shadow-sm",
                  )}
                  aria-pressed={isSelected}
                >
                  <div
                    className={cn(
                      "size-18 shrink-0 overflow-hidden rounded-xl border bg-muted",
                      "from-gray-700 to-gray-900",
                    )}
                  >
                    {icon}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="line-clamp-2 font-semibold text-foreground leading-tight">
                        {title}
                      </h3>
                      {isSelected && (
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {subtitle}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-primary">
                      {formatMoney(price)}
                    </p>
                    {!isPriceReady && (
                      <p className="text-xs text-muted-foreground">
                        Loading price&dots;
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
        </div>
      </div>
    );
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground">Food &amp; Drink</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Add snacks and beverages to your order (optional)
      </p>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        <div className="flex-1 space-y-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">
              Loading concessions…
            </p>
          ) : (
            <>
              <ConcessionSection
                key="___combos___"
                title="Bestseller Combos"
                items={combos}
              />
              {Object.entries(categorizedItems).map(([key, group]) => (
                <ConcessionSection
                  key={key}
                  title={group.displayName}
                  items={group.items}
                />
              ))}
            </>
          )}
        </div>
        <div className="w-full lg:w-80">
          <div className="sticky top-32 rounded-xl border bg-card p-4">
            <h3 className="font-semibold text-foreground">Order Summary</h3>

            {selectedConcessions.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No items selected
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {selectedConcessions.map((item) => (
                  <div key={item.variantId} className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {item.displayName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatMoney(item.unitPrice)} each
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          dispatch(
                            updateConcessionQuantity({
                              variantId: item.variantId,
                              quantity: Math.max(0, item.quantity - 1),
                            }),
                          )
                        }
                        className="h-7 w-7 p-0"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>

                      <span className="w-8 text-center text-sm font-medium">
                        {item.quantity}
                      </span>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          dispatch(
                            updateConcessionQuantity({
                              variantId: item.variantId,
                              quantity: item.quantity + 1,
                            }),
                          )
                        }
                        className="h-7 w-7 p-0"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>

                      <span className="ml-auto text-sm font-semibold text-primary">
                        {formatMoney(item.lineTotal)}
                      </span>
                    </div>

                    <Separator className="my-2" />
                  </div>
                ))}

                <div className="flex items-center justify-between pt-2">
                  <span className="font-semibold text-foreground">Total</span>
                  <span className="text-lg font-bold text-primary">
                    {formatMoney(totalPrice)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-between">
        <Button variant="outline" onClick={() => requestStep(currentStep - 1)}>
          Back
        </Button>
        <Button size="lg" onClick={handleNext}>
          {selectedConcessions.length === 0
            ? "Skip & Continue"
            : "Next: Confirm Booking"}
        </Button>
      </div>
    </div>
  );
}
