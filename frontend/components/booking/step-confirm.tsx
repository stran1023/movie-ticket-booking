"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";

import {
  nextStep,
  setCustomerInfo,
  setReceipt,
  setHoldExpiresAt,
  setPendingPayment,
  clearSeats,
  setStep,
  setAppliedPromotion,
  clearPromotion,
  setUsePoints,
  setPointsToRedeem,
} from "@/lib/store/slices/bookingSlice";

import {
  validatePromotion,
  redeemPromotion,
  getFlatPricePromotions,
  validateFlatPricePromotion,
  getCommunityPromoTickets,
  type FlatPricePromotion,
  type FlatPriceValidateResponse,
} from "@/lib/api/promotions";
import {
  fetchShowtimes,
  confirmBooking,
  type ShowtimeWithMeta,
  // releaseSeats, // TODO: enable when backend merges cancel/release flow
} from "@/lib/api/cinemas";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { OrderSummary } from "@/components/order-summary";
import { PointsRedemption } from "@/components/booking/points-redemption";

import {
  User,
  Mail,
  Phone,
  CreditCard,
  Loader2,
  Ticket,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/utils";
import {
  fetchComboComponents,
  previewConcessionPrice,
} from "@/lib/api/concessions";
import { useBookingNav } from "@/components/booking/booking-nav-context";

/**
 * NOTE / TODO (CANCEL BOOKING)
 * - Seat-hold & cancel flow is currently simplified in the main branch.
 * - We intentionally DO NOT implement "Cancel booking" button yet because:
 *    1) releaseSeats()/cancel endpoint is not merged to this branch
 *    2) Doing local-cancel without server release can cause mismatch & debugging pain
 * - TODO: When backend merges releaseSeats/cancel API:
 *    - Add a "Cancel booking" button (with confirm dialog)
 *    - Call releaseSeats(selectedShowtimeId) (best-effort)
 *    - Clear local booking state (holdExpiresAt, seats, concessions, promo, receipt)
 *    - Redirect to Step 1 (or Step 3 depending on desired UX)
 */
const ENABLE_CANCEL_BOOKING = false; // TODO: set true when releaseSeats is available

export function StepConfirm() {
  const dispatch = useAppDispatch();
  const { requestStep } = useBookingNav();

  const {
    selectedMovieId,
    selectedShowtimeId,
    selectedSeats,
    selectedConcessions,
    selectedDate,
    appliedDiscount,
    appliedPromotion,
    holdExpiresAt,
    usePoints,
    pointsToRedeem,
    currentStep,
  } = useAppSelector((s) => s.booking);

  const profile = useAppSelector((s) => s.auth.profile);
  const { items: cartItems } = useAppSelector((state) => state.cart as any);

  const [promoCode, setPromoCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);

  // Flat price promotion state
  const [flatPromos, setFlatPromos] = useState<FlatPricePromotion[]>([]);
  const [flatPromosLoading, setFlatPromosLoading] = useState(false);
  const [flatPromosOpen, setFlatPromosOpen] = useState(false);
  const [selectedFlatPromoId, setSelectedFlatPromoId] = useState<number | null>(
    null,
  );
  const [flatPromoValidating, setFlatPromoValidating] = useState(false);
  const [flatPromoResult, setFlatPromoResult] =
    useState<FlatPriceValidateResponse | null>(null);
  const [flatPromoError, setFlatPromoError] = useState<string | null>(null);

  // Community promo tickets (recently validated codes from Redis)
  const [communityPromoCodes, setCommunityPromoCodes] = useState<string[]>([]);
  const [communityPromoLoading, setCommunityPromoLoading] = useState(false);

  const [showtime, setShowtime] = useState<ShowtimeWithMeta | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"vnpay" | "momo">("vnpay");
  const [pointsDiscountVnd, setPointsDiscountVnd] = useState(0);

  const [previewing, setPreviewing] = useState(false);
  const [concessionsValid, setConcessionsValid] = useState(true);
  const [serverConcessionsTotal, setServerConcessionsTotal] = useState<
    number | null
  >(null);

  const isComboId = (id: string) => id.startsWith("combo-");
  const parseComboId = (id: string) => Number(id.replace("combo-", ""));

  // Fetch showtime meta for display (movieTitle, time, hall...)
  useEffect(() => {
    if (!selectedShowtimeId) return;

    fetchShowtimes({ status: "confirmed" }).then((list) => {
      const match = list.find((s) => s.id === selectedShowtimeId);
      if (match) setShowtime(match);
    });
  }, [selectedShowtimeId]);

  // Fetch community promo tickets once on mount
  useEffect(() => {
    let mounted = true;
    setCommunityPromoLoading(true);

    getCommunityPromoTickets(5)
      .then((data) => {
        if (!mounted) return;
        setCommunityPromoCodes(data.codes ?? []);
      })
      .catch(() => {
        if (!mounted) return;
        setCommunityPromoCodes([]);
      })
      .finally(() => {
        if (mounted) setCommunityPromoLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Fetch active flat price promotions scoped to the current showtime
  useEffect(() => {
    if (!selectedShowtimeId) return;

    let mounted = true;
    setFlatPromosLoading(true);

    getFlatPricePromotions({ showtime_id: Number(selectedShowtimeId) })
      .then((data) => {
        if (!mounted) return;
        setFlatPromos(data);
      })
      .catch(() => {
        if (!mounted) return;
        setFlatPromos([]);
      })
      .finally(() => {
        if (mounted) setFlatPromosLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [selectedShowtimeId]);

  // Amounts
  const seatsAmount = useMemo(
    () => selectedSeats.reduce((sum, s) => sum + s.price, 0),
    [selectedSeats],
  );

  // When a valid flat price promotion is applied, override the seat subtotal
  const effectiveSeatsAmount =
    flatPromoResult?.valid && flatPromoResult.new_subtotal !== undefined
      ? flatPromoResult.new_subtotal
      : seatsAmount;

  const concessionsAmount = useMemo(
    () => selectedConcessions.reduce((sum, c) => sum + c.lineTotal, 0),
    [selectedConcessions],
  );

  //
  // Backend Concession Price Preview (authoritative)
  //
  useEffect(() => {
    let mounted = true;

    if (selectedConcessions.length === 0) {
      setConcessionsValid(true);
      setServerConcessionsTotal(0);
      return;
    }

    (async () => {
      setPreviewing(true);
      try {
        // Build server lines (expend combos)
        const lines: {
          variantId: string;
          quantity: number;
          pricing: "base" | "combo";
        }[] = [];
        for (const item of selectedConcessions) {
          if (isComboId(item.variantId)) {
            const cid = parseComboId(item.variantId);
            const components = await fetchComboComponents(String(cid));
            for (const { variant, quantity } of components) {
              lines.push({
                variantId: String(variant.id),
                quantity: item.quantity * quantity,
                pricing: "combo",
              });
            }
          } else {
            lines.push({
              variantId: String(item.variantId),
              quantity: item.quantity,
              pricing: "base",
            });
          }
        }

        const preview = await previewConcessionPrice({ lines });
        const serverTotal = parseFloat(preview.total);

        if (!mounted) {
          return;
        }

        setServerConcessionsTotal(serverTotal);

        const epsilon = 0.01;
        const ok = Math.abs(serverTotal - concessionsAmount) < epsilon;
        setConcessionsValid(ok);

        if (!ok) {
          toast.error(
            "Concession price changed on server." +
              ` Updated total: ${formatMoney(serverTotal)}.`,
          );
        }
      } catch (e) {
        if (!mounted) {
          return;
        }

        setConcessionsValid(false);
        setServerConcessionsTotal(null);

        toast.error("Could not validate concession pricing.");
        console.error(e);
      } finally {
        if (mounted) {
          setPreviewing(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [selectedConcessions, concessionsAmount]);

  //
  // Final Total
  //
  const concessionsAmountEffective =
    serverConcessionsTotal ?? concessionsAmount;

  const totalAmount = effectiveSeatsAmount + concessionsAmountEffective;

  // Flat price discount = difference between original seats total and effective
  const flatPriceDiscount =
    flatPromoResult?.valid && flatPromoResult.new_subtotal !== undefined
      ? seatsAmount - flatPromoResult.new_subtotal
      : 0;

  // Amount already discounted = flat price savings + promo code savings
  const amountAlreadyDiscounted = flatPriceDiscount + appliedDiscount;
  const hasAnyPromotion =
    (selectedFlatPromoId !== null && !!flatPromoResult?.valid) ||
    appliedDiscount > 0 ||
    (usePoints && pointsToRedeem > 0);

  const finalAmount = Math.max(
    0,
    totalAmount - appliedDiscount - pointsDiscountVnd,
  );

  const holdExpired =
    !!holdExpiresAt && new Date(holdExpiresAt).getTime() <= Date.now();

  // In 6-step flow: Confirm is Step 5. Back goes to Step 4 (Concessions).
  // Do NOT release seats on Back (user may only want to adjust concessions).
  const handleBack = useCallback(() => {
    requestStep(currentStep - 1);
  }, [requestStep, currentStep]);

  // Build seat breakdown string (e.g. "normal:2,vip:1") from selected seats
  const buildSeatBreakdown = useCallback(() => {
    const counts: Record<string, number> = {};
    for (const seat of selectedSeats) {
      counts[seat.type] = (counts[seat.type] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([type, count]) => `${type}:${count}`)
      .join(",");
  }, [selectedSeats]);

  // Returns a single seat type when all selected seats share the same type.
  // Returns null when there are mixed seat types or no seats.
  const buildSeatTypes = useCallback((): string | null => {
    if (selectedSeats.length === 0) return null;
    const uniqueTypes = new Set(selectedSeats.map((s) => s.type));
    if (uniqueTypes.size === 1) {
      return Array.from(uniqueTypes)[0];
    }
    return null;
  }, [selectedSeats]);

  // Call the validate API and update flat promo result state
  const runFlatPromoValidation = useCallback(
    async (promoId: number, silent = false) => {
      if (!selectedShowtimeId) return;

      // 0 seats → no validation
      if (selectedSeats.length === 0) {
        setFlatPromoResult(null);
        if (!silent) {
          setFlatPromoError(null);
        }
        return;
      }

      const seatType = buildSeatTypes();
      // Mixed seat types are not allowed for flat price promotions
      if (!seatType) {
        const message = "Flat price promotion only applies to same seat type";
        setFlatPromoResult(null);
        setFlatPromoError(message);
        if (silent) {
          setSelectedFlatPromoId(null);
          toast.warning(message);
        } else {
          toast.error(message);
        }
        return;
      }

      if (!silent) setFlatPromoValidating(true);
      setFlatPromoError(null);

      try {
        const result = await validateFlatPricePromotion({
          promotion_id: promoId,
          showtime_id: Number(selectedShowtimeId),
          seat_types: seatType,
          seats: buildSeatBreakdown(),
        });

        setFlatPromoResult(result);

        if (!result.valid) {
          setFlatPromoError(result.error ?? "This promotion is not valid.");
          if (silent) {
            // Auto-deselect on background re-validation failure
            setSelectedFlatPromoId(null);
            setFlatPromoResult(null);
            toast.warning(
              "Your selected promotion is no longer valid due to seat changes. Please reselect.",
            );
          }
        }
      } catch {
        setFlatPromoResult(null);
        if (!silent) {
          setFlatPromoError("Could not validate promotion. Please try again.");
        }
      } finally {
        if (!silent) setFlatPromoValidating(false);
      }
    },
    [
      selectedShowtimeId,
      selectedSeats.length,
      buildSeatTypes,
      buildSeatBreakdown,
    ],
  );

  // Select or deselect a flat price promotion
  const handleSelectFlatPromo = async (promoId: number) => {
    // Strict frontend validation: mixed seat types are not allowed
    const seatType = buildSeatTypes();
    if (selectedSeats.length > 1 && !seatType) {
      const message = "Flat price promotion only applies to same seat type";
      setSelectedFlatPromoId(null);
      setFlatPromoResult(null);
      setFlatPromoError(message);
      toast.error(message);
      return;
    }

    if (selectedFlatPromoId === promoId) {
      setSelectedFlatPromoId(null);
      setFlatPromoResult(null);
      setFlatPromoError(null);
      return;
    }

    // Clear points when selecting a flat price promo
    if (usePoints) {
      dispatch(setUsePoints(false));
      dispatch(setPointsToRedeem(0));
      setPointsDiscountVnd(0);
    }

    setSelectedFlatPromoId(promoId);
    await runFlatPromoValidation(promoId, false);
  };

  const handleClearFlatPromo = () => {
    setSelectedFlatPromoId(null);
    setFlatPromoResult(null);
    setFlatPromoError(null);
  };

  // When points discount changes, disable flat price and promo code
  const handlePointsDiscountChange = useCallback(
    (discount: number) => {
      setPointsDiscountVnd(discount);
      if (discount > 0) {
        // Clear flat price promo and promo code when using points
        setSelectedFlatPromoId(null);
        setFlatPromoResult(null);
        setFlatPromoError(null);
        if (appliedDiscount > 0) {
          dispatch(clearPromotion());
          setPromoCode("");
        }
      }
    },
    [dispatch, appliedDiscount],
  );

  // Re-validate the selected flat price promotion when seat selection changes
  useEffect(() => {
    if (selectedFlatPromoId === null) return;
    // Silent re-validation: auto-deselects with toast if no longer valid
    runFlatPromoValidation(selectedFlatPromoId, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSeats]);

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) {
      toast.error("Please enter a promo code");
      return;
    }

    // Clear points when applying promo code
    if (usePoints) {
      dispatch(setUsePoints(false));
      dispatch(setPointsToRedeem(0));
      setPointsDiscountVnd(0);
    }

    setIsValidating(true);
    try {
      const movieIdForApi = selectedMovieId;
      if (!movieIdForApi) {
        toast.error("Please select a movie before applying a promo code.");
        return;
      }

      const response = await validatePromotion({
        code: promoCode.trim(),
        movie_id: Number(movieIdForApi),
        total_amount: effectiveSeatsAmount.toString(), // <-- use seats only
      });

      if (response.valid && response.calculated_discount) {
        const discountAmount = parseFloat(
          response.calculated_discount.discount_amount,
        );

        dispatch(
          setAppliedPromotion({
            code: promoCode.trim(),
            validation: response,
            discountAmount,
          }),
        );

        toast.success("Promo code applied!");
      } else {
        dispatch(clearPromotion());
        toast.error(
          response.error ||
            response.reason ||
            "This promo code is not valid for your booking.",
        );
      }
    } catch (error) {
      dispatch(clearPromotion());
      toast.error("Failed to validate promo code");
      console.error(error);
    } finally {
      setIsValidating(false);
    }
  };

  // Re-validate promo automatically when subtotal changes
  useEffect(() => {
    if (!appliedPromotion?.code) return;
    if (!selectedMovieId) return;

    (async () => {
      try {
        const response = await validatePromotion({
          code: appliedPromotion.code,
          movie_id: Number(selectedMovieId),
          total_amount: effectiveSeatsAmount.toString(),
        });

        if (response.valid && response.calculated_discount) {
          const discountAmount = parseFloat(
            response.calculated_discount.discount_amount,
          );

          dispatch(
            setAppliedPromotion({
              code: appliedPromotion.code,
              validation: response,
              discountAmount,
            }),
          );
        } else {
          dispatch(clearPromotion());
          toast.error(
            response.error ||
              response.reason ||
              "This promo code is no longer valid for your updated subtotal.",
          );
        }
      } catch (e) {
        console.error("Failed to re-validate promotion", e);
        dispatch(clearPromotion());
        toast.error("Could not re-validate promo code. It has been removed.");
      }
    })();
  }, [totalAmount, selectedMovieId, appliedPromotion?.code, dispatch]);

  const handleRemovePromo = () => {
    setPromoCode("");
    dispatch(clearPromotion());
    toast.message("Promo code removed");
  };

  const handleConfirm = async () => {
    if (!profile || !selectedShowtimeId) return;

    if (holdExpired) return;

    if (!concessionsValid) {
      toast.error("Concession prices changed. Please check again.");
      return;
    }

    setConfirming(true);
    try {
      // Redeem promo first (if any)
      if (appliedPromotion?.code) {
        const redeemResult = await redeemPromotion({
          code: appliedPromotion.code,
        });

        if (!redeemResult.success) {
          toast.error("Promo could not be redeemed. Please try again.");
          setConfirming(false);
          return;
        }
      }

      const labels = selectedSeats.map((s) => `${s.row}${s.number}`);

      const flatPromoIdToSend =
        selectedFlatPromoId !== null && flatPromoResult?.valid
          ? selectedFlatPromoId
          : null;

      // Map from selectedConcessions (which drives the UI) and safely parse the ID
      const concessionsPayload = selectedConcessions.map((item) => {
        const dbId = String(item.variantId).replace("combo-", "");
        return {
          id: Number(dbId),
          quantity: Number(item.quantity),
        };
      });

      const result = await confirmBooking(
        selectedShowtimeId,
        labels,
        paymentMethod,
        flatPromoIdToSend,
        usePoints ? pointsToRedeem : 0,
        appliedPromotion?.code ?? null,
        selectedMovieId ? Number(selectedMovieId) : null,
        //concessionsPayload.length > 0 ? concessionsPayload : undefined,
        concessionsAmountEffective,
      );

      const customerValues = {
        name: profile.fullName,
        email: profile.email,
        phone: profile.phoneNumber,
        identityCard: profile.identityCard,
      };

      dispatch(setCustomerInfo(customerValues));
      dispatch(setHoldExpiresAt(null));

      const receiptDiscountAmount = appliedDiscount + pointsDiscountVnd;
      const receiptSeatsAmount = effectiveSeatsAmount;
      const receiptTotal = receiptSeatsAmount + concessionsAmountEffective;
      const receiptFinal = Math.max(0, receiptTotal - receiptDiscountAmount);
      const receiptPointsEarned = hasAnyPromotion ? 0 : result.pointsEarned;

      dispatch(
        setReceipt({
          bookingId: result.bookingId,
          movieTitle: result.movieTitle,
          startTime: result.start_time,
          endTime: result.end_time,
          purchaseTime: result.purchase_time,
          hall: result.hall,

          seats: selectedSeats,
          concessions: selectedConcessions,

          customer: customerValues,

          seatsAmount: receiptSeatsAmount,
          concessionsAmount: concessionsAmountEffective,
          totalAmount: receiptTotal,
          discountAmount: receiptDiscountAmount,
          finalAmount: receiptFinal,

          pointsUsed: result.pointsUsed ?? (usePoints ? pointsToRedeem : 0),
          pointsEarned: receiptPointsEarned > 0 ? receiptPointsEarned : 0,
          createdAt: new Date().toISOString(),
        }),
      );

      dispatch(
        setPendingPayment({
          paymentUrl: result.paymentUrl,
          paymentMethod: result.paymentMethod as "vnpay" | "momo",
          txnRef: result.txnRef,
          amount: result.finalAmount,
        }),
      );

      dispatch(nextStep()); // Step 5 -> Step 6 Payment
      toast.success("Booking created! Please complete payment.");
    } catch (err: any) {
      const msg = typeof err?.message === "string" ? err.message : "";
      if (msg === "AUTH_EXPIRED") {
        toast.error("Your session expired. Please sign in again.");
      } else {
        toast.error(msg || "Booking failed. Please try again.");
      }
      console.error("Confirm booking failed:", err);
    } finally {
      setConfirming(false);
    }
  };

  // TODO: Cancel booking handler (enable when releaseSeats is merged)
  // const handleCancelBooking = async () => {
  //   if (!selectedShowtimeId) return;
  //   try {
  //     await releaseSeats(selectedShowtimeId);
  //   } finally {
  //     dispatch(setHoldExpiresAt(null));
  //     dispatch(clearSeats());
  //     dispatch(clearPromotion());
  //     dispatch(setStep(1));
  //   }
  // };

  return (
    <div>
      <div>
        <h2 className="text-xl font-bold text-foreground">Confirm Booking</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review your booking details before confirming
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        <div className="flex-1">
          {/* Booking details */}
          <div className="rounded-xl border bg-card p-4">
            <h3 className="font-semibold text-foreground">Booking Details</h3>

            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Movie</span>
                <span className="font-medium text-foreground">
                  {showtime?.movieTitle ?? "—"}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium text-foreground">
                  {selectedDate ?? "—"}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Start Time</span>
                <span className="font-medium text-foreground">
                  {showtime?.time ?? "—"}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">End Time</span>
                <span className="font-medium text-foreground">
                  {showtime?.time ?? "—"}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Hall</span>
                <span className="font-medium text-foreground">
                  {showtime?.hall ?? "—"}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Seats</span>
                <span className="font-medium text-foreground">
                  {selectedSeats.map((s) => `${s.row}${s.number}`).join(", ")}
                </span>
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Flat Price Promotions — hidden when no active promotions exist */}
          {!flatPromosLoading && flatPromos.length > 0 && (
            <div
              className={`rounded-xl border bg-card p-4 ${
                usePoints && pointsToRedeem > 0
                  ? "opacity-50 pointer-events-none"
                  : ""
              }`}
            >
              {/* Header row — acts as the collapsible toggle */}
              <button
                type="button"
                onClick={() => setFlatPromosOpen((prev) => !prev)}
                className="flex w-full items-center justify-between text-left"
              >
                <h3 className="font-semibold text-foreground">
                  Available Promotions
                  <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-normal text-primary">
                    {flatPromos.length}
                  </span>
                </h3>
                {flatPromosOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {/* Collapsible list */}
              {flatPromosOpen && (
                <div className="mt-3 space-y-2">
                  {flatPromos.map((promo) => {
                    const isSelected = selectedFlatPromoId === promo.id;
                    return (
                      <button
                        key={promo.id}
                        type="button"
                        onClick={() => handleSelectFlatPromo(promo.id)}
                        className={`flex w-full items-start gap-3 rounded-lg border-2 p-3 text-left transition-all ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-transparent bg-muted/40 hover:border-primary/30 hover:bg-muted/60"
                        }`}
                      >
                        {/* Radio-style indicator */}
                        <div
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                            isSelected
                              ? "border-primary bg-primary"
                              : "border-muted-foreground"
                          }`}
                        >
                          {isSelected && (
                            <div className="h-1.5 w-1.5 rounded-full bg-white" />
                          )}
                        </div>

                        <Ticket className="mt-0.5 h-4 w-4 shrink-0 text-primary" />

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">
                            {promo.title}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {promo.small_description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Validation state for selected promotion */}
              {selectedFlatPromoId !== null && (
                <div className="mt-3">
                  {flatPromoValidating && (
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Validating promotion…
                    </p>
                  )}

                  {!flatPromoValidating && flatPromoResult?.valid && (
                    <div className="flex items-start justify-between">
                      <div className="space-y-0.5 text-sm">
                        <p className="font-medium text-yellow-500">
                          ✓ Promotion applied!
                        </p>
                        <p className="text-muted-foreground">
                          Flat price:{" "}
                          <span className="font-medium text-foreground">
                            {formatMoney(flatPromoResult.flat_price!)}
                          </span>{" "}
                          / seat · New seat total:{" "}
                          <span className="font-semibold text-yellow-500">
                            {formatMoney(flatPromoResult.new_subtotal!)}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground line-through">
                          Original: {formatMoney(seatsAmount)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearFlatPromo}
                        className="ml-2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                        aria-label="Remove flat price promotion"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  {!flatPromoValidating && flatPromoError && (
                    <p className="text-sm text-destructive">{flatPromoError}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* loading skeleton while promotions fetch */}
          {flatPromosLoading && (
            <div className="rounded-xl border bg-card p-4">
              <div className="h-4 w-40 animate-pulse rounded bg-muted" />
            </div>
          )}

          <Separator className="my-6" />

          {/* Points Redemption — between flat price promo and promo code */}
          <PointsRedemption
            subtotal={effectiveSeatsAmount}
            amountAlreadyDiscounted={amountAlreadyDiscounted}
            onPointsDiscountChange={handlePointsDiscountChange}
          />

          <Separator className="my-6" />

          {/* Promo code */}
          <div
            className={`rounded-xl border bg-card p-4 ${usePoints && pointsToRedeem > 0 ? "opacity-50 pointer-events-none" : ""}`}
          >
            <h3 className="mb-3 font-semibold text-foreground">
              Apply Promo Code
            </h3>

            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Enter promo code"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                disabled={isValidating || appliedDiscount > 0}
                className="flex-1"
              />

              {appliedDiscount <= 0 ? (
                <Button
                  onClick={handleApplyPromo}
                  disabled={isValidating}
                  variant="outline"
                >
                  {isValidating ? "Validating..." : "Apply"}
                </Button>
              ) : (
                <Button onClick={handleRemovePromo} variant="destructive">
                  Remove
                </Button>
              )}
            </div>

            {/* Community-discovered promo tickets */}
            {!communityPromoLoading && communityPromoCodes.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Available Promo Tickets from the community
                </p>
                <div className="flex flex-wrap gap-2">
                  {communityPromoCodes.map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setPromoCode(code.toUpperCase())}
                      className="rounded-full border bg-muted/60 px-3 py-1 text-xs font-semibold text-foreground hover:bg-muted"
                    >
                      {code.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {appliedDiscount > 0 && (
              <div className="mt-2 space-y-1 text-sm">
                <p className="text-green-600">
                  ✓ Promo applied! Discount: {formatMoney(appliedDiscount)}
                </p>
                {appliedPromotion?.validation?.promotion && (
                  <p className="text-muted-foreground">
                    {appliedPromotion.validation.promotion.discount_type ===
                    "PERCENTAGE"
                      ? (() => {
                          const raw = Number(
                            appliedPromotion.validation.promotion
                              .discount_value,
                          );
                          const percent = Math.round(raw * 100);
                          const cap =
                            appliedPromotion.validation.promotion
                              .max_discount_cap;
                          return cap
                            ? `Discount ${percent}% up to ${formatMoney(
                                Number(cap),
                              )}`
                            : `Discount ${percent}%`;
                        })()
                      : `Discount ${formatMoney(
                          Number(
                            appliedPromotion.validation.promotion
                              .discount_value,
                          ),
                        )}`}
                  </p>
                )}
              </div>
            )}
          </div>

          <Separator className="my-6" />

          {/* Customer info */}
          <h3 className="font-semibold text-foreground">
            Customer Information
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Information from your account profile
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-muted-foreground">Full Name</Label>
              <div className="mt-1 flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2.5">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  {profile?.fullName || "---"}
                </span>
              </div>
            </div>

            <div>
              <Label className="text-muted-foreground">Email</Label>
              <div className="mt-1 flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2.5">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  {profile?.email || "---"}
                </span>
              </div>
            </div>

            <div>
              <Label className="text-muted-foreground">Phone</Label>
              <div className="mt-1 flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2.5">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  {profile?.phoneNumber || "---"}
                </span>
              </div>
            </div>

            <div>
              <Label className="text-muted-foreground">Identity Card</Label>
              <div className="mt-1 flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2.5">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  {profile?.identityCard || "---"}
                </span>
              </div>
            </div>
          </div>

          {/* Payment method selection */}
          <div className="mt-6">
            <h3 className="font-semibold text-foreground">Payment Method</h3>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod("vnpay")}
                className={`flex items-center gap-3 rounded-xl border-2 p-4 transition-all ${
                  paymentMethod === "vnpay"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                    : "border-muted hover:border-blue-300"
                }`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 font-bold text-xs">
                  VNPay
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">VNPay</p>
                  <p className="text-xs text-muted-foreground">
                    Banking / QR Transfer
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("momo")}
                className={`flex items-center gap-3 rounded-xl border-2 p-4 transition-all ${
                  paymentMethod === "momo"
                    ? "border-pink-500 bg-pink-50 dark:bg-pink-950"
                    : "border-muted hover:border-pink-300"
                }`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pink-100 text-pink-600 font-bold text-xs">
                  MoMo
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">MoMo</p>
                  <p className="text-xs text-muted-foreground">E-Wallet</p>
                </div>
              </button>
            </div>
          </div>

          {/* Footer actions */}
          <div className="mt-8 flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={confirming}
            >
              Back
            </Button>

            <Button
              size="lg"
              onClick={handleConfirm}
              disabled={
                confirming || holdExpired || !concessionsValid || previewing
              }
            >
              {confirming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>Continue to Payment {formatMoney(finalAmount)}</>
              )}
            </Button>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="w-full lg:w-64">
          <div className="sticky top-32">
            <OrderSummary
              shownSeatsAmount={effectiveSeatsAmount}
              shownConcessionsAmount={concessionsAmountEffective}
              shownTotalAmount={totalAmount}
              shownFinalAmount={finalAmount}
              flatPriceDiscount={
                flatPriceDiscount > 0 ? flatPriceDiscount : undefined
              }
              pointsDiscount={
                pointsDiscountVnd > 0 ? pointsDiscountVnd : undefined
              }
              pointsUsed={pointsToRedeem > 0 ? pointsToRedeem : undefined}
              hideSeatCount
            />
          </div>
        </div>
      </div>
    </div>
  );
}
