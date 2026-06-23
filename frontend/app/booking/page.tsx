"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  selectMovie,
  selectShowtime,
  setStep,
  clearHold,
  resetBooking,
} from "@/lib/store/slices/bookingSlice";
import { fetchShowtimes, getPaymentStatus, releaseSeats } from "@/lib/api/cinemas";

import { StepProgressBar } from "@/components/step-progress-bar";
import { StepMovie } from "@/components/booking/step-movie";
import { StepShowtime } from "@/components/booking/step-showtime";
import { StepSeats } from "@/components/booking/step-seats";
import { StepConcession } from "@/components/booking/step-concession";
import { StepConfirm } from "@/components/booking/step-confirm";
import { StepPayment } from "@/components/booking/step-payment";
import { StepReceipt } from "@/components/booking/step-receipt";
import { CountdownTimer } from "@/components/booking/countdown-timer";
import { ConfirmLeaveModal } from "@/components/booking/confirm-leave-modal";
import { BookingNavProvider } from "@/components/booking/booking-nav-context";
import { Button } from "@/components/ui/button";

const STEPS = [
  "Select Movie",
  "Showtime",
  "Seats",
  "Food & Drink",
  "Confirm",
  "Payment",
  "Receipt",
] as const;

const TOTAL_STEPS = STEPS.length;
const RECEIPT_STEP = TOTAL_STEPS;
const MAX_CLICKABLE_STEP = TOTAL_STEPS - 1;

export default function BookingPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl px-4 py-6">
          <div className="h-12 animate-pulse rounded-lg bg-muted" />
        </div>
      }
    >
      <BookingContent />
    </Suspense>
  );
}

function BookingContent() {
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const currentStep = useAppSelector((s) => s.booking.currentStep);
  const holdExpiresAt = useAppSelector((s) => s.booking.holdExpiresAt);
  const selectedSeats = useAppSelector((s) => s.booking.selectedSeats);
  const selectedShowtimeId = useAppSelector(
    (s) => s.booking.selectedShowtimeId,
  );
  const role = useAppSelector((s) => s.auth.role);
  const isAuthenticated = role !== "guest";

  const highestStep = useRef(currentStep);
  if (currentStep > highestStep.current) highestStep.current = currentStep;

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [pendingTargetStep, setPendingTargetStep] = useState<number | null>(
    null,
  );
  const [releasing, setReleasing] = useState(false);

  const hasActiveHold =
    selectedSeats.length > 0 || holdExpiresAt !== null;

  useEffect(() => {
    if (!isAuthenticated && currentStep >= 3) {
      dispatch(clearHold());
      dispatch(setStep(1));
      highestStep.current = 1;
    }
  }, [isAuthenticated, currentStep, dispatch]);

  const navigateDirectly = useCallback(
    (step: number) => {
      dispatch(setStep(step));
      if (step < highestStep.current) {
        highestStep.current = Math.max(step, highestStep.current);
      }
    },
    [dispatch],
  );

  const executeReleaseAndGo = useCallback(
    async (targetStep: number) => {
      setReleasing(true);
      try {
        if (selectedShowtimeId) {
          await releaseSeats(selectedShowtimeId);
        }
      } catch (err) {
        console.error("Release failed, forcing local cleanup", err);
      } finally {
        if (targetStep <= 1) {
          dispatch(resetBooking());
        } else {
          dispatch(clearHold());
        }
        dispatch(setStep(targetStep));
        highestStep.current = targetStep;
        setShowLeaveModal(false);
        setPendingTargetStep(null);
        setReleasing(false);
      }
    },
    [dispatch, selectedShowtimeId],
  );

  const requestStep = useCallback(
    (step: number) => {
      if (currentStep === RECEIPT_STEP) return;
      if (step > highestStep.current || step > MAX_CLICKABLE_STEP) return;
      if (step === currentStep) return;

      // Navigation to step 1 or 2 while holding seats requires confirmation
      const needsGuard = step <= 2 && currentStep >= 3 && hasActiveHold;

      if (needsGuard) {
        setPendingTargetStep(step);
        setShowLeaveModal(true);
        return;
      }

      navigateDirectly(step);
    },
    [currentStep, hasActiveHold, navigateDirectly],
  );

  const handleModalConfirm = useCallback(() => {
    if (pendingTargetStep !== null) {
      executeReleaseAndGo(pendingTargetStep);
    }
  }, [pendingTargetStep, executeReleaseAndGo]);

  const handleModalCancel = useCallback(() => {
    setShowLeaveModal(false);
    setPendingTargetStep(null);
  }, []);

  const navContextValue = useMemo(
    () => ({ requestStep }),
    [requestStep],
  );

  useEffect(() => {
    const movieId = searchParams.get("movieId");
    const showtimeId = searchParams.get("showtimeId");

    if (!movieId) return;

    dispatch(selectMovie(movieId));

    if (!showtimeId) {
      dispatch(setStep(2));
      return;
    }

    fetchShowtimes({ status: "confirmed" }).then((list) => {
      const match = list.find((s) => s.id === showtimeId);
      if (match) {
        dispatch(selectShowtime(showtimeId));
        dispatch(setStep(3));
      } else {
        dispatch(setStep(2));
      }
    });
  }, [searchParams, dispatch]);

  useEffect(() => {
    const callback = searchParams.get("payment_callback");
    const txnRef = searchParams.get("txn_ref");
    if (!callback || !txnRef) return;

    getPaymentStatus(txnRef).then((result) => {
      if (result.status === "success") {
        dispatch(setStep(RECEIPT_STEP));
      } else {
        dispatch(setStep(6));
      }
    }).catch(() => {
      dispatch(setStep(6));
    });
  }, [searchParams, dispatch]);

  const isPaymentCallback =
    searchParams.has("vnp_ResponseCode") ||
    searchParams.has("resultCode") ||
    searchParams.has("payment_callback");

  if (isPaymentCallback) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 py-10 text-center">
        <div className="rounded-full bg-green-100 p-3 dark:bg-green-900/30">
          <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Payment Processed!
          </h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-md">
            Your transaction has been recorded. Please close this tab and return to your original booking window to view your tickets.
          </p>
        </div>
        <Button onClick={() => window.close()} size="lg" className="mt-4 w-full max-w-xs">
          Close This Tab
        </Button>
      </div>
    );
  }

  return (
    <BookingNavProvider value={navContextValue}>
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="sticky top-16 z-40 -mx-4 bg-background/95 px-4 backdrop-blur">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <StepProgressBar
                currentStep={currentStep}
                steps={[...STEPS]}
                onStepClick={requestStep}
              />
            </div>
            <CountdownTimer />
          </div>
        </div>

        <div className="mt-6">
          {currentStep === 1 && <StepMovie />}
          {currentStep === 2 && <StepShowtime />}
          {currentStep === 3 && <StepSeats />}
          {currentStep === 4 && <StepConcession />}
          {currentStep === 5 && <StepConfirm />}
          {currentStep === 6 && <StepPayment />}
          {currentStep === 7 && <StepReceipt />}
        </div>
      </div>

      <ConfirmLeaveModal
        open={showLeaveModal}
        onOpenChange={handleModalCancel}
        onConfirm={handleModalConfirm}
        loading={releasing}
      />
    </BookingNavProvider>
  );
}
