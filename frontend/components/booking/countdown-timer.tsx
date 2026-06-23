"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { clearHold, setStep } from "@/lib/store/slices/bookingSlice";
import { Clock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function CountdownTimer() {
  const dispatch = useAppDispatch();

  const holdExpiresAt = useAppSelector((s) => s.booking.holdExpiresAt);

  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleExpire = useCallback(() => {
    dispatch(clearHold());
    dispatch(setStep(3));

    toast.error(
      "Your seat hold has expired. Please reselect your seats.",
      { duration: 5000 },
    );
  }, [dispatch]);

  useEffect(() => {
    if (!holdExpiresAt) {
      setSecondsLeft(null);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const tick = () => {
      const diff = Math.max(
        0,
        Math.floor((new Date(holdExpiresAt).getTime() - Date.now()) / 1000),
      );
      setSecondsLeft(diff);

      if (diff <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        handleExpire();
      }
    };

    tick();
    timerRef.current = setInterval(tick, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [holdExpiresAt, handleExpire]);

  if (secondsLeft == null || secondsLeft <= 0) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const isUrgent = secondsLeft <= 60;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors",
        isUrgent
          ? "animate-pulse border-red-400 bg-red-50 text-red-600 dark:border-red-600 dark:bg-red-950 dark:text-red-400"
          : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-400",
      )}
    >
      <Clock className="h-4 w-4" />
      <span className="tabular-nums">
        {minutes}:{seconds.toString().padStart(2, "0")}
      </span>
    </div>
  );
}
