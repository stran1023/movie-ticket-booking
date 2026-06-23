import { Separator } from "@/components/ui/separator";
import { RefObject } from "react";
import QRCode from "react-qr-code";

interface TicketReceiptProps {
  bookingId: string;
  movieTitle: string;
  startTime: string;
  endTime: string;
  hall: string;
  seats: string;
  customerName: string;
  totalAmount?: number;
  discountAmount?: number;
  finalAmount?: number;
  pointsEarned?: number;
  pointsUsed?: number;
}

function formatVND(v: number) {
  if (!v) return "0 d";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(v);
}

export function TicketReceipt({
  bookingId,
  movieTitle,
  startTime,
  endTime,
  hall,
  seats,
  customerName,
  totalAmount,
  discountAmount,
  finalAmount,
  pointsEarned,
  pointsUsed,
}: TicketReceiptProps) {
  return (
    <div className="relative mx-auto max-w-md min-w-2xs overflow-hidden rounded-2xl border bg-card shadow-lg">
      {/* Perforated edge effect */}
      <div className="absolute left-0 right-0 top-0 h-3 bg-primary" />

      <div className="px-6 pb-6 pt-8">
        <div className="text-center">
          <p className="text-xs font-medium text-muted-foreground">
            Booking ID
          </p>
          <p className="mt-1 font-mono text-lg font-bold text-primary">
            {bookingId}
          </p>
        </div>

        <Separator className="my-4" />

        <div className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground">Movie</p>
            <p className="font-semibold text-foreground">{movieTitle}</p>
          </div>
          {startTime && (
            <div className="flex gap-6">
              {startTime && (
                <>
                  <div>
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p className="font-medium text-foreground">
                      {startTime.split(" ")[0]}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">From</p>
                    <p className="font-medium text-foreground">
                      {startTime.split(" ")[1]}
                    </p>
                  </div>
                </>
              )}
              {endTime && (
                <div>
                  <p className="text-xs text-muted-foreground">To</p>
                  <p className="font-medium text-foreground">
                    {endTime.split(" ")[1]}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-6">
            <div>
              <p className="text-xs text-muted-foreground">Hall</p>
              <p className="font-medium text-foreground">{hall}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Seats</p>
              <p className="font-medium text-foreground">{seats}</p>
            </div>
          </div>

          <div className="flex gap-6">
            <div>
              <p className="text-xs text-muted-foreground">Customer</p>
              <p className="font-semibold text-foreground">
                {customerName.toUpperCase()}
              </p>
            </div>
          </div>
        </div>

        {/* Financial summary
        {(totalAmount != null && totalAmount > 0) && (
          <>
            <Separator className="my-4" />
            <div className="space-y-1.5 text-sm">
              {(discountAmount ?? 0) > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium text-foreground">{formatVND(totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-{formatVND(discountAmount!)}</span>
                  </div>
                </>
              )}
              {(pointsUsed ?? 0) > 0 && (
                <div className="flex justify-between text-yellow-600">
                  <span>Points Used</span>
                  <span>{pointsUsed} pts</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="font-semibold text-foreground">
                  {(discountAmount ?? 0) > 0 ? "Final Total" : "Total"}
                </span>
                <span className="font-bold text-primary">
                  {formatVND(finalAmount ?? totalAmount)}
                </span>
              </div>
              {(pointsEarned ?? 0) > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Points Earned</span>
                  <span>+{pointsEarned} pts</span>
                </div>
              )}
            </div>
          </>
        )} */}

        <Separator className="my-4" />

        <div className="space-y-3">
          <div className="flex flex-col gap-3 items-center justify-center">
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <QRCode
                value={bookingId || "N/A"}
                size={128}
                bgColor="#FFFFFF"
                fgColor="#000000"
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Scan this code at entry
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
