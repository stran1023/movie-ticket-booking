"use client";

import Link from "next/link";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { resetBooking } from "@/lib/store/slices/bookingSlice";
import { TicketReceipt } from "@/components/ticket-receipt";
import { Button } from "@/components/ui/button";
import { DownloadIcon, Home } from "lucide-react";
import { OrderSummary } from "../order-summary";
import { useRef } from "react";
import { toPng } from "html-to-image";

const formatSeatLabel = (label: string, type: string) => {
  if (type?.toLowerCase() === "couple") {
    const match = label.match(/^([A-Z])(\d+)$/);
    if (match) {
      const row = match[1];
      const num = parseInt(match[2], 10);
      return `${label}-${row}${num + 1}`;
    }
  }
  return label;
};

export function StepReceipt() {
  const dispatch = useAppDispatch();
  const receipt = useAppSelector((s) => s.booking.receipt);

  const receiptRef = useRef<HTMLDivElement>(null);

  const handleDownloadAll = async () => {
    if (!receiptRef.current) return;

    try {
      await document.fonts.ready;

      const dataUrl = await toPng(receiptRef.current, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: "#ffffff",
      });

      const link = document.createElement("a");
      link.download = `booking-invoice-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Failed to download invoice image:", error);
    }
  };

  if (!receipt) {
    return (
      <div className="text-center">
        <p className="text-muted-foreground">No booking found.</p>
        <Link href="/">
          <Button variant="link" className="mt-2">
            Go Home
          </Button>
        </Link>
      </div>
    );
  }

  const seatsText = (receipt.seats ?? [])
    .map((s: any) => {
      if (typeof s === "string") {
        return formatSeatLabel(s, "");
      }

      const label = `${s.row}${s.number}`;
      return formatSeatLabel(label, s.type ?? "");
    })
    .join(", ");
  const backendPointsEarned = Number(receipt.pointsEarned ?? 0);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground">
          Booking Confirmed!
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your tickets have been booked successfully
        </p>
      </div>

      <div
        ref={receiptRef}
        className="flex flex-col items-center gap-6 rounded-2xl bg-background p-6 lg:flex-row"
      >
        <div className="inline-block bg-white p-4">
          <h3 className="text-lg font-semibold text-foreground text-center my-2">
            Ticket
          </h3>
          <TicketReceipt
            bookingId={receipt.bookingId}
            movieTitle={receipt.movieTitle}
            startTime={receipt.startTime}
            endTime={receipt.endTime}
            hall={receipt.hall}
            seats={seatsText}
            customerName={receipt.customer.name}
            totalAmount={receipt.totalAmount}
            discountAmount={receipt.discountAmount}
            finalAmount={receipt.finalAmount}
            pointsEarned={backendPointsEarned}
            pointsUsed={receipt.pointsUsed}
          />
        </div>
        <div className="inline-block bg-white p-4">
          <h3 className="text-lg font-semibold text-foreground text-center my-2">
            Receipt
          </h3>
          <OrderSummary
            title="Receipt Information"
            code={receipt.bookingId}
            pointsEarned={backendPointsEarned}
            shownFinalAmount={receipt.finalAmount}
            shadow
          />
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" className="gap-2" onClick={handleDownloadAll}>
          <DownloadIcon className="h-4 w-4" />
          Download
        </Button>

        <Link href="/">
          <Button className="gap-2" onClick={() => dispatch(resetBooking())}>
            <Home className="h-4 w-4" />
            Back to Home
          </Button>
        </Link>
      </div>

      {receipt.pointsUsed > 0 ? (
        <div className="text-center rounded-xl border bg-card p-4">
          <p className="text-md text-muted-foreground">Points Redeemed</p>
          <p className="text-2xl font-semibold text-red-600">
            -{receipt.pointsUsed}
          </p>
        </div>
      ) : receipt.pointsEarned > 0 ? (
        <div className="text-center rounded-xl border bg-card p-4">
          <p className="text-md text-muted-foreground">Points Earned</p>
          <p className="text-2xl font-semibold text-green-600">
            +{receipt.pointsEarned}
          </p>
        </div>
      ) : null}
    </div>
  );
}
