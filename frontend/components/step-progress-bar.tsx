import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppDispatch } from "@/lib/store/hooks";
import { setStep } from "@/lib/store/slices/bookingSlice";

type StepProgressBarProps = {
  currentStep: number;

  /**
   * Optional: custom steps label list.
   * In your project, concessions step is mandatory => default is 6-step flow.
   */
  steps?: string[];

  /**
   * Optional: external navigation handler (preferred).
   * If not provided, component will dispatch setStep(stepNum).
   */
  onStepClick?: (step: number) => void;

  /**
   * Optional: custom navigation guard.
   * If not provided, default behavior:
   * - only allow going back (step < currentStep)
   * - never allow navigating to Receipt (last step)
   * - disable navigation on Receipt screen
   */
  canNavigateToStep?: (step: number) => boolean;
};

const DEFAULT_STEPS = [
  "Select Movie",
  "Showtime",
  "Seats",
  "Food & Drink",
  "Confirm",
  "Payment",
  "Receipt",
] as const;

function clampStep(step: number, min: number, max: number) {
  return Math.min(Math.max(step, min), max);
}

export function StepProgressBar({
  currentStep,
  steps,
  onStepClick,
  canNavigateToStep,
}: StepProgressBarProps) {
  const dispatch = useAppDispatch();

  // Concessions is mandatory in flow => default is always 6 steps
  const resolvedSteps = steps?.length ? steps : [...DEFAULT_STEPS];

  const lastStep = resolvedSteps.length;
  const receiptStep = lastStep;
  const maxClickableStep = lastStep - 1; // never navigate to Receipt
  const isOnReceipt = currentStep === receiptStep;

  const defaultCanNavigateTo = React.useCallback(
    (stepNum: number) => {
      if (isOnReceipt) return false; // lock navigation on Receipt screen
      if (stepNum === currentStep) return false; // no-op
      if (stepNum > currentStep) return false; // no forward jump
      if (stepNum > maxClickableStep) return false; // never to Receipt
      return true;
    },
    [currentStep, isOnReceipt, maxClickableStep],
  );

  const canGo = React.useCallback(
    (stepNum: number) =>
      canNavigateToStep
        ? canNavigateToStep(stepNum)
        : defaultCanNavigateTo(stepNum),
    [canNavigateToStep, defaultCanNavigateTo],
  );

  const goTo = React.useCallback(
    (stepNum: number) => {
      if (!canGo(stepNum)) return;

      const safeStep = clampStep(stepNum, 1, lastStep);

      // Prefer controlled navigation from parent
      if (onStepClick) {
        onStepClick(safeStep);
        return;
      }

      dispatch(setStep(safeStep));
    },
    [canGo, dispatch, lastStep, onStepClick],
  );

  const progressPct =
    resolvedSteps.length > 1
      ? ((currentStep - 1) / (resolvedSteps.length - 1)) * 100
      : 0;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-4">
      {/* Absolute-track layout: single background + animated active track */}
      <div className="relative flex justify-between">
        {/* Background track */}
        <div className="absolute top-4 left-0 w-full h-0.5 bg-muted -z-10" />
        {/* Active track */}
        <div
          className="absolute top-4 left-0 h-0.5 bg-green-500 -z-10 transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />

        {resolvedSteps.map((label, index) => {
          const stepNum = index + 1;
          const isCompleted = stepNum < currentStep;
          const isCurrent = stepNum === currentStep;
          const isFuture = stepNum > currentStep;
          const clickable = canGo(stepNum);

          return (
            <div
              key={`${label}-${stepNum}`}
              className="flex flex-col items-center z-10 w-16"
            >
              <button
                type="button"
                disabled={!clickable}
                onClick={() => goTo(stepNum)}
                aria-label={`Go to step ${stepNum}: ${label}`}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all",
                  isCompleted && "bg-green-500 text-white",
                  isCurrent &&
                    "bg-primary text-primary-foreground ring-4 ring-primary/20",
                  isFuture && "bg-muted text-muted-foreground",
                  clickable &&
                    "cursor-pointer hover:scale-110 hover:ring-4 hover:ring-primary/30",
                  !clickable && !isCurrent && "cursor-default",
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : stepNum}
              </button>

              <button
                type="button"
                disabled={!clickable}
                onClick={() => goTo(stepNum)}
                className={cn(
                  "mt-1.5 hidden text-xs font-medium sm:block text-center w-full transition-colors",
                  isCurrent && "text-primary",
                  isCompleted && "text-green-600",
                  isFuture && "text-muted-foreground",
                  clickable && "cursor-pointer hover:text-primary",
                  !clickable && "cursor-default",
                )}
              >
                {label}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
