"use client";

import { useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { toggleSeat } from "@/lib/store/slices/bookingSlice";
import type { SeatData } from "@/lib/mock-data";
import { SEAT_PRICES } from "@/lib/api/cinemas";
import { canToggleSeat } from "@/lib/seat-validation";
import { SeatIcon } from "@/components/seat-icon";
import { SeatLegend } from "@/components/seat-legend";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SeatGridProps {
  seats: SeatData[];
  onSeatClick?: (seat: SeatData) => void;
  selectedSeatIds?: string[];
  readOnly?: boolean;
}

export function SeatGrid({
  seats,
  onSeatClick,
  selectedSeatIds,
  readOnly,
}: SeatGridProps) {
  const dispatch = useAppDispatch();
  const bookingSelectedSeats = useAppSelector((s) => s.booking.selectedSeats);
  const selected = selectedSeatIds ?? bookingSelectedSeats.map((s) => s.id);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const rows = Array.from(new Set(seats.map((s) => s.row))).sort();
  const seatsPerRow = Math.max(...seats.map((s) => s.number));

  function handleClick(seat: SeatData) {
    if (seat.status === "occupied" || seat.status === "held" || readOnly)
      return;

    const isDeselecting = selectedSet.has(seat.id);

    if (!canToggleSeat(seat, seats, selectedSet, isDeselecting)) {
      toast.error(
        "Cannot select this seat — it would leave a single isolated empty seat between booked seats.",
      );
      return;
    }

    if (onSeatClick) {
      onSeatClick(seat);
    } else {
      dispatch(
        toggleSeat({
          id: seat.id,
          row: seat.row,
          number: seat.number,
          type: seat.type as "normal" | "vip" | "couple",
          price: SEAT_PRICES[seat.type] ?? 75000,
        }),
      );
    }
  }

  function getSeatVisualType(seat: SeatData) {
    if (selectedSet.has(seat.id)) return "selected" as const;
    // If we held it previously but just deselected it in Redux, it's pending release. Show as available.
    if (seat.status === "held_by_you") return seat.type;
    if (seat.status === "held") return "held" as const;
    if (seat.status === "occupied") return "occupied" as const;
    return seat.type;
  }

  function isSeatDisabled(seat: SeatData): boolean {
    if (seat.status === "occupied" || seat.status === "held" || readOnly)
      return true;

    const isDeselecting = selectedSet.has(seat.id);
    return !canToggleSeat(seat, seats, selectedSet, isDeselecting);
  }

  function getSeatLabels(seat: SeatData): { left: string; right: string } {
    if (seat.type === "couple") {
      const pairNumber = Math.ceil(seat.number / 2);
      const leftSeatNumber = pairNumber * 2 - 1;
      const rightSeatNumber = pairNumber * 2;
      return {
        left: `${seat.row}${leftSeatNumber}`,
        right: `${seat.row}${rightSeatNumber}`,
      };
    }
    return {
      left: `${seat.row}${seat.number}`,
      right: "",
    };
  }

  return (
    <div className="flex flex-col items-center gap-2 w-full select-none">
      <div className="w-2/3 rounded-b-[40%] bg-muted/60 py-1 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
        Screen
      </div>

      <div className="flex justify-center w-full">
        <div className="flex flex-col gap-1">
          {rows.map((row) => {
            const processedSeats = new Set<number>();

            return (
              <div key={row} className="flex items-center gap-1 justify-center">
                <span className="w-5 text-center text-[10px] font-black text-muted-foreground/50">
                  {row}
                </span>

                {Array.from({ length: seatsPerRow }, (_, i) => {
                  const seatNumber = i + 1;
                  if (processedSeats.has(seatNumber)) return null;

                  const seat = seats.find(
                    (s) => s.row === row && s.number === seatNumber,
                  );

                  if (!seat) return <div key={i} className="h-10 w-10" />;

                  if (seat.type === "couple") {
                    processedSeats.add(seatNumber + 1);
                  }

                  const isCouple = seat.type === "couple";
                  const isOccupied =
                    seat.status === "occupied" || seat.status === "held";
                  const disabled = isSeatDisabled(seat);
                  const labels = getSeatLabels(seat);
                  const visualType = getSeatVisualType(seat);

                  return (
                    <button
                      key={seat.id}
                      onClick={() => handleClick(seat)}
                      disabled={disabled}
                      title={`${labels.left}${labels.right ? `-${labels.right}` : ''} - ${seat.type}`}
                      className={cn(
                        "relative flex items-center justify-center transition-transform",
                        isCouple ? "h-10 w-20" : "h-10 w-10",
                        !disabled &&
                          "hover:scale-110 active:scale-95 cursor-pointer",
                        disabled && !isOccupied && "opacity-40 cursor-not-allowed",
                        isOccupied && "cursor-not-allowed",
                      )}
                    >
                      <SeatIcon
                        type={visualType}
                        isOccupied={isOccupied}
                        isSelected={selectedSet.has(seat.id)}
                        originalType={seat.type}
                        className="h-full w-full drop-shadow-sm"
                      />

                    {isCouple ? (
                      // Two labels for couple seats
                      <>
                        <span
                          className={cn(
                            "absolute left-4 top-1/2 -translate-y-1/2 font-bold pointer-events-none",
                            "font-mono tabular-nums tracking-tighter text-[10px]",
                            isOccupied
                              ? "text-white/40"
                              : "text-white drop-shadow-sm",
                          )}
                        >
                          {labels.left}
                        </span>
                        <span
                          className={cn(
                            "absolute right-4 top-1/2 -translate-y-1/2 font-bold pointer-events-none",
                            "font-mono tabular-nums tracking-tighter text-[10px]",
                            isOccupied
                              ? "text-white/40"
                              : "text-white drop-shadow-sm",
                          )}
                        >
                          {labels.right}
                        </span>
                      </>
                    ) : (
                      // Single label for normal seats
                      <span
                        className={cn(
                          "absolute inset-0 flex items-center justify-center font-bold pointer-events-none",
                          "font-mono tabular-nums tracking-tighter text-[10px] pt-0.5",
                          isOccupied
                            ? "text-white/40"
                            : "text-white drop-shadow-sm",
                        )}
                      >
                        {labels.left}
                      </span>
                    )}
                    </button>
                  );
                }).filter(Boolean)}

                <span className="w-5 text-center text-[10px] font-black text-muted-foreground/50">
                  {row}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 opacity-80 scale-90">
        <SeatLegend />
      </div>
    </div>
  );
}