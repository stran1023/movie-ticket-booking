"use client";

import { useEffect, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  nextStep,
  setStep,
  setHoldExpiresAt,
  resetBooking,
} from "@/lib/store/slices/bookingSlice";
import { useBookingNav } from "@/components/booking/booking-nav-context";
import {
  fetchSeats,
  holdSeats,
  SeatConflictError,
  SessionExpiredError,
} from "@/lib/api/cinemas";
import type { SeatData } from "@/lib/mock-data";

import { SeatGrid } from "@/components/seat-grid";
import { OrderSummary } from "@/components/order-summary";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function StepSeats() {
  const dispatch = useAppDispatch();
  const { requestStep } = useBookingNav();

  const { selectedShowtimeId, selectedSeats, holdExpiresAt } = useAppSelector(
    (s) => s.booking,
  );
  const currentStep = useAppSelector((s) => s.booking.currentStep);

  const [seats, setSeats] = useState<SeatData[]>([]);
  const [loading, setLoading] = useState(false);
  const [holding, setHolding] = useState(false);
  const selectedSeatIdsRef = useRef<Set<string>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const isEditMode = !!(
    holdExpiresAt && new Date(holdExpiresAt).getTime() > Date.now()
  );

  async function loadSeats() {
    if (!selectedShowtimeId) return;
    setLoading(true);
    try {
      const data = await fetchSeats(selectedShowtimeId);
      setSeats(data);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load seats.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    selectedSeatIdsRef.current = new Set(
      selectedSeats.map((s) => `${s.row}${s.number}`),
    );
  }, [selectedSeats]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedShowtimeId) return;

    setLoading(true);
    fetchSeats(selectedShowtimeId)
      .then((data) => {
        if (!cancelled) setSeats(data);
      })
      .catch((err: any) => {
        if (!cancelled) toast.error(err?.message || "Failed to load seats.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedShowtimeId]);

  useEffect(() => {
    if (!selectedShowtimeId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    let wsHost = "localhost:8000";

    if (process.env.NEXT_PUBLIC_API_URL) {
      try {
        wsHost = new URL(process.env.NEXT_PUBLIC_API_URL).host;
      } catch {
        wsHost = "localhost:8000";
      }
    }

    const wsUrl = `${protocol}//${wsHost}/ws/showtime/${selectedShowtimeId}/`;
    let active = true;

    const connect = () => {
      if (!active) return;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const action = data?.action;
          const labels = Array.isArray(data?.seats) ? data.seats : [];

          if (!labels.length) return;
          if (!["hold", "release", "book"].includes(action)) return;

          const labelSet = new Set(labels as string[]);

          setSeats((prev) =>
            prev.map((seat) => {
              if (!labelSet.has(seat.id)) return seat;

              // Keep local selected seats visually stable while user is interacting.
              if (selectedSeatIdsRef.current.has(seat.id)) return seat;
              if (seat.status === "held_by_you") return seat;

              if (action === "release") {
                return { ...seat, status: "available" };
              }

              if (action === "book") {
                return { ...seat, status: "occupied" };
              }

              return { ...seat, status: "held" };
            }),
          );
        } catch (err) {
          console.error("WebSocket message error:", err);
        }
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onclose = () => {
        if (!active) return;

        const nextAttempt = reconnectAttemptsRef.current + 1;
        reconnectAttemptsRef.current = nextAttempt;

        // Exponential backoff with cap and jitter to avoid reconnect storms.
        const baseDelayMs = 500;
        const maxDelayMs = 15000;
        const exponent = Math.min(nextAttempt - 1, 6);
        const jitterMs = Math.floor(Math.random() * 300);
        const delayMs = Math.min(maxDelayMs, baseDelayMs * (2 ** exponent)) + jitterMs;

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delayMs);
      };
    };

    connect();

    return () => {
      active = false;
      reconnectAttemptsRef.current = 0;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [selectedShowtimeId]);

  const handleNext = async () => {
    if (!selectedShowtimeId || selectedSeats.length === 0) return;

    setHolding(true);
    try {
      const labels = selectedSeats.map((s) => `${s.row}${s.number}`);

      const result = await holdSeats(selectedShowtimeId, labels);

      dispatch(setHoldExpiresAt(result.expires_at));

      dispatch(nextStep());
    } catch (err: any) {
      if (err instanceof SessionExpiredError) {
        dispatch(resetBooking());
        dispatch(setStep(1));
        toast.error(
          "Your 15-minute session has ended. Please start over.",
          { duration: 5000 },
        );
        return;
      }

      if (err instanceof SeatConflictError) {
        toast.error(
          "Some of your selected seats were just taken. Please update your selection.",
          { duration: 4000 },
        );
      } else if (err?.message === "AUTH_EXPIRED") {
        toast.error(
          "Your login session has expired. Please log in again.",
          { duration: 5000 },
        );
        return;
      } else {
        toast.error(err?.message || "Failed to hold seats. Please try again.");
      }

      await loadSeats();
    } finally {
      setHolding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading seats...</span>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground">Select Seats</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {isEditMode
          ? "Editing your selection. Your held seats are highlighted. Click Next to re-lock."
          : "Choose up to 8 seat units (couple seat = 2). Tap a seat to select or deselect."}
      </p>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        <div className="flex-1">
          <SeatGrid seats={seats} />
        </div>

        <div className="w-full lg:w-64">
          <div className="sticky top-32">
            <OrderSummary showTotals={false} />
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-between">
        <Button
          variant="outline"
          onClick={() => requestStep(currentStep - 1)}
          disabled={holding}
        >
          Back
        </Button>

        <Button
          onClick={handleNext}
          disabled={selectedSeats.length === 0 || holding}
          size="lg"
        >
          {holding ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Reserving seats...
            </>
          ) : isEditMode ? (
            "Update & Continue"
          ) : (
            "Next: Food & Drink"
          )}
        </Button>
      </div>
    </div>
  );
}
