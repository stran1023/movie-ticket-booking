"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { setUsePoints, setPointsToRedeem } from "@/lib/store/slices/bookingSlice";
import {
  getPointBalance,
  getPointConfig,
  calculateRedeemablePoints,
  type PointBalance,
  type PointRedemptionConfig,
  type PointCalculation,
} from "@/lib/api/points";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Coins } from "lucide-react";
import { formatMoney } from "@/lib/utils";

interface PointsRedemptionProps {
  subtotal: number;
  amountAlreadyDiscounted: number;
  onPointsDiscountChange: (discount: number) => void;
}

export function PointsRedemption({
  subtotal,
  amountAlreadyDiscounted,
  onPointsDiscountChange,
}: PointsRedemptionProps) {
  const dispatch = useAppDispatch();
  const { usePoints, pointsToRedeem } = useAppSelector((s) => s.booking);

  const [balance, setBalance] = useState<PointBalance | null>(null);
  const [config, setConfig] = useState<PointRedemptionConfig | null>(null);
  const [calculation, setCalculation] = useState<PointCalculation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch config and balance on mount
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    Promise.all([getPointConfig(), getPointBalance()])
      .then(([cfg, bal]) => {
        if (!mounted) return;
        setConfig(cfg);
        setBalance(bal);
      })
      .catch(() => {
        if (!mounted) return;
        setError("Could not load point information.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Recalculate whenever subtotal or discounts change
  useEffect(() => {
    if (!config?.is_active) return;
    if (subtotal <= 0) return;

    let mounted = true;

    calculateRedeemablePoints(subtotal, amountAlreadyDiscounted)
      .then((calc) => {
        if (!mounted) return;
        setCalculation(calc);

        // If current redemption amount exceeds new cap, clamp it
        if (pointsToRedeem > calc.redeemable_points) {
          const clamped = calc.is_redemption_available
            ? calc.redeemable_points
            : 0;
          dispatch(setPointsToRedeem(clamped));
          onPointsDiscountChange(
            clamped * (config?.points_per_vnd ?? 500),
          );
        }
      })
      .catch(() => {
        if (!mounted) return;
        setCalculation(null);
      });

    return () => {
      mounted = false;
    };
  }, [subtotal, amountAlreadyDiscounted, config?.is_active]);

  const handleToggle = useCallback(
    (checked: boolean) => {
      dispatch(setUsePoints(checked));
      if (!checked) {
        dispatch(setPointsToRedeem(0));
        onPointsDiscountChange(0);
      } else if (calculation?.is_redemption_available && config) {
        const minPts = config.min_points_to_redeem;
        dispatch(setPointsToRedeem(minPts));
        onPointsDiscountChange(minPts * config.points_per_vnd);
      }
    },
    [dispatch, calculation, config, onPointsDiscountChange],
  );

  const handleSliderChange = useCallback(
    (value: number[]) => {
      const pts = value[0];
      dispatch(setPointsToRedeem(pts));
      onPointsDiscountChange(pts * (config?.points_per_vnd ?? 500));
    },
    [dispatch, config, onPointsDiscountChange],
  );

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading points...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border bg-card p-4">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  const isConfigDisabled = !config?.is_active;
  const balanceTooLow =
    !isConfigDisabled &&
    balance !== null &&
    config !== null &&
    balance.balance < config.min_points_to_redeem;
  const isDisabled =
    isConfigDisabled || balanceTooLow || !calculation?.is_redemption_available;

  const pointsVndValue = (balance?.balance ?? 0) * (config?.points_per_vnd ?? 500);

  return (
    <div
      className={`rounded-xl border bg-card p-4 ${isDisabled ? "opacity-60" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-yellow-500" />
          <div>
            <h3 className="font-semibold text-foreground">Use Points</h3>
            <p className="text-sm text-muted-foreground">
              Your Points:{" "}
              <span className="font-semibold text-foreground">
                {balance?.balance ?? 0} pts
              </span>
              <span className="ml-1 text-xs">
                ({formatMoney(pointsVndValue)})
              </span>
            </p>
          </div>
        </div>

        <Switch
          checked={usePoints && !isDisabled}
          onCheckedChange={handleToggle}
          disabled={isDisabled}
        />
      </div>

      {/* Disabled messages */}
      {isConfigDisabled && (
        <p className="mt-2 text-xs text-muted-foreground italic">
          Point redemption is currently unavailable.
        </p>
      )}
      {balanceTooLow && !isConfigDisabled && (
        <p className="mt-2 text-xs text-muted-foreground italic">
          You need at least {config?.min_points_to_redeem} points to redeem
          (you have {balance?.balance ?? 0} pts).
        </p>
      )}

      {/* Redemption controls */}
      {usePoints && !isDisabled && calculation?.is_redemption_available && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <Label className="text-muted-foreground">
              Redeem: {pointsToRedeem} pts
            </Label>
            <span className="font-medium text-yellow-600">
              -{formatMoney(pointsToRedeem * (config?.points_per_vnd ?? 500))}
            </span>
          </div>

          <Slider
            min={config?.min_points_to_redeem ?? 4}
            max={calculation.redeemable_points}
            step={1}
            value={[pointsToRedeem]}
            onValueChange={handleSliderChange}
            className="py-2"
          />

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              Min: {config?.min_points_to_redeem} pts
            </span>
            <span>
              Max: {calculation.redeemable_points} pts (
              {formatMoney(calculation.max_discount_vnd)})
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
