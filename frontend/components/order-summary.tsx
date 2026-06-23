"use client";

import { useAppSelector } from "@/lib/store/hooks";
import { seatUnitCount } from "@/lib/store/slices/bookingSlice";
import { Separator } from "@/components/ui/separator";
import { cn, formatMoney } from "@/lib/utils";
import Barcode from "react-barcode";

export interface OrderSummaryProps {
  title?: string;
  showTotals?: boolean;
  shownSeatsAmount?: number;
  shownConcessionsAmount?: number;
  shownTotalAmount?: number;
  shownFinalAmount?: number;
  pointsEarned?: number;
  pointsDiscount?: number;
  pointsUsed?: number;
  flatPriceDiscount?: number;
  code?: string;
  hideSeatCount?: boolean;
  shadow?: boolean;
}

export function OrderSummary({
  title,
  showTotals,
  shownSeatsAmount,
  shownConcessionsAmount,
  shownTotalAmount,
  shownFinalAmount,
  pointsEarned,
  pointsDiscount,
  pointsUsed,
  flatPriceDiscount,
  code,
  hideSeatCount,
  shadow,
}: OrderSummaryProps) {
  const selectedSeats = useAppSelector((s) => s.booking.selectedSeats);
  const { appliedDiscount, selectedConcessions, receipt } = useAppSelector(
    (s) => s.booking,
  );
  const seatsAmount = shownSeatsAmount ?? receipt?.seatsAmount;
  const concessionsAmount =
    shownConcessionsAmount ?? receipt?.concessionsAmount;
  const pointEarned = receipt?.pointsEarned;
  const units = seatUnitCount(selectedSeats);

  const totalAmount =
    shownTotalAmount ?? (seatsAmount ?? 0) + (concessionsAmount ?? 0);

  const finalAmount =
    shownFinalAmount ?? Math.max(0, totalAmount - appliedDiscount);

  if (selectedSeats.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-4">
        <h3 className="font-semibold text-foreground">
          {title ?? "Order Overview"}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          No seats selected yet
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 min-w-xs max-w-md",
        shadow && "shadow-lg",
      )}
    >
      <h3 className="font-bold text-foreground text-lg">
        {title ?? "Order Overview"}
      </h3>

      <Separator className="my-3" />

      <h3 className="font-semibold text-foreground">Seats</h3>
      <div className="mt-3 space-y-2">
        {selectedSeats.map((seat) => (
          <div
            key={seat.id}
            className="flex items-center justify-between text-sm"
          >
            <span className="text-muted-foreground">
              {seat.type === "couple"
                ? `${seat.row}${seat.number}-${seat.row}${seat.number + 1} (Couple)`
                : `${seat.row}${seat.number} (${seat.type})`}
            </span>
            <span className="font-medium text-foreground">
              {formatMoney(seat.price)}
            </span>
          </div>
        ))}
      </div>

      {/* Food & Drink summary */}
      {selectedConcessions.length > 0 && (
        <>
          <Separator className="my-4" />
          <h4 className="font-semibold text-foreground">Food &amp; Drink</h4>

          <div className="mt-3 space-y-2 text-sm">
            {selectedConcessions.map((item) => (
              <div key={item.variantId} className="flex justify-between">
                <span className="text-muted-foreground">
                  {item.displayName} x{item.quantity}
                </span>
                <span className="font-medium text-foreground">
                  {formatMoney(item.lineTotal)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {(showTotals ?? true) && (
        <>
          <Separator className="my-3" />

          <h3 className="font-semibold text-foreground">Summary</h3>

          <div className="mt-3 space-y-2 text-sm">
            {/* Seats */}
            {typeof seatsAmount === "number" && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Seats</span>
                <span className="font-medium text-foreground">
                  {formatMoney(seatsAmount)}
                </span>
              </div>
            )}
            {/* Food & Drink */}
            {typeof concessionsAmount === "number" && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Food & Drink</span>
                <span className="font-medium text-foreground">
                  {formatMoney(concessionsAmount)}
                </span>
              </div>
            )}
          </div>

          <Separator className="my-3" />

          {/* Subtotal */}
          <div className="flex items-center justify-between">
            <span className="text-foreground">Subtotal</span>
            <span className="font-medium text-foreground">
              {formatMoney(totalAmount)}
            </span>
          </div>

          {/* Flat Price Promotion */}
          {(flatPriceDiscount ?? 0) > 0 && (
            <div className="flex items-center justify-between text-green-600">
              <span>Flat Price Promotion</span>
              <span>-{formatMoney(flatPriceDiscount!)}</span>
            </div>
          )}

          {/* Promo Code Discount */}
          {appliedDiscount > 0 && (
            <div className="flex items-center justify-between text-green-600">
              <span>Promo Code</span>
              <span>-{formatMoney(appliedDiscount)}</span>
            </div>
          )}

          {/* Points Redeemed */}
          {(pointsDiscount ?? 0) > 0 && (
            <div className="flex items-center justify-between text-yellow-600">
              <span>Points Redeemed ({pointsUsed ?? 0} pts)</span>
              <span>-{formatMoney(pointsDiscount!)}</span>
            </div>
          )}

          {/* Total */}
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">Total</span>
            <span className="text-lg font-bold text-primary">
              {formatMoney(finalAmount)}
            </span>
          </div>

          {/* Points to earn preview */}
          {finalAmount > 0 && pointEarned && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Points you will earn
              </span>
              <span className="font-medium text-green-600">
                +{pointEarned} pts
              </span>
            </div>
          )}

          {(!hideSeatCount || code) && <Separator className="my-3" />}

          {code && <Barcode value={code} height={40} />}

          {receipt?.purchaseTime && (
            <>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium text-foreground">
                    Purchase Time
                  </span>
                  <span className="font-medium text-foreground">
                    {receipt.purchaseTime}
                  </span>
                </div>
              </div>
            </>
          )}

          {!hideSeatCount && (
            <p className="mt-1 text-xs text-muted-foreground">
              {units} seat{units !== 1 && "s"} selected (max 8)
            </p>
          )}
        </>
      )}

      <Separator className="my-3" />
    </div>
  );
}
