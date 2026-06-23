"use client";

import { useEffect, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  nextStep,
  setStep,
  setPendingPayment,
} from "@/lib/store/slices/bookingSlice";
import { getPaymentStatus } from "@/lib/api/cinemas";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/utils";

const POLL_INTERVAL = 3000;

export function StepPayment() {
  const dispatch = useAppDispatch();
  const pendingPayment = useAppSelector((s) => s.booking.pendingPayment);
  const receipt = useAppSelector((s) => s.booking.receipt);

  const [paymentStatus, setPaymentStatus] = useState<string>("pending");
  const [polling, setPolling] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const windowRef = useRef<Window | null>(null);

  useEffect(() => {
    if (!pendingPayment?.txnRef) return;

    const poll = async () => {
      try {
        const result = await getPaymentStatus(pendingPayment.txnRef);
        setPaymentStatus(result.status);

        if (result.status === "success") {
          setPolling(false);
          if (intervalRef.current) clearInterval(intervalRef.current);
          toast.success("Payment successful!");
          dispatch(nextStep());
        } else if (result.status === "failed" || result.status === "expired") {
          setPolling(false);
          if (intervalRef.current) clearInterval(intervalRef.current);
          toast.error("Payment failed or expired.");
        }
      } catch {
        // keep polling
      }
    };

    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pendingPayment?.txnRef, dispatch]);

  const handleOpenPayment = () => {
    if (!pendingPayment?.paymentUrl) return;
    windowRef.current = window.open(pendingPayment.paymentUrl, "_blank");
  };

  const handleRetry = () => {
    dispatch(setPendingPayment(null));
    dispatch(setStep(5));
  };

  if (!pendingPayment) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center">
        <p className="text-muted-foreground">No payment in progress.</p>
        <Button className="mt-4" onClick={() => dispatch(setStep(5))}>
          Back to Confirm
        </Button>
      </div>
    );
  }

  const isMomo = pendingPayment.paymentMethod === "momo";
  const gatewayLabel = isMomo ? "MoMo" : "VNPay";
  const accentColor = isMomo ? "pink" : "blue";

  return (
    <div className="mx-auto max-w-lg py-8">
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        {/* Header */}
        <div className="text-center">
          <div
            className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-${accentColor}-100 text-${accentColor}-600 font-bold text-lg`}
          >
            {gatewayLabel}
          </div>
          <h2 className="mt-4 text-xl font-bold text-foreground">
            Complete Your Payment
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pay with {gatewayLabel} to confirm your booking
          </p>
        </div>

        {/* Amount */}
        <div className="mt-6 rounded-xl bg-muted/50 p-4 text-center">
          <p className="text-sm text-muted-foreground">Amount to pay</p>
          <p className="mt-1 text-3xl font-bold text-foreground">
            {formatMoney(pendingPayment.amount)}
          </p>
          {receipt && (
            <p className="mt-1 text-xs text-muted-foreground">
              Booking: {receipt.bookingId}
            </p>
          )}
        </div>

        {/* Status */}
        <div className="mt-6">
          {paymentStatus === "pending" && (
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 text-amber-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm font-medium">Waiting for payment...</span>
              </div>

              <Button
                size="lg"
                className="w-full"
                onClick={handleOpenPayment}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open {gatewayLabel} Payment Page
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                A new tab will open with the {gatewayLabel} payment page.
                Complete the payment there, and this page will update automatically.
              </p>

              {!isMomo && (
                <div className="mt-3 w-full rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
                  <p className="font-semibold">VNPay Sandbox Test Card:</p>
                  <p>Bank: NCB &middot; Card: 9704198526191432198</p>
                  <p>Name: NGUYEN VAN A &middot; Date: 07/15 &middot; OTP: 123456</p>
                </div>
              )}

              {isMomo && (
                <div className="mt-3 w-full rounded-lg border border-pink-200 bg-pink-50 p-3 text-xs text-pink-800 dark:border-pink-800 dark:bg-pink-950 dark:text-pink-300">
                  <p className="font-semibold">MoMo Test Wallet:</p>
                  <p>Phone: 9999888877 &middot; OTP: 000000</p>
                  <p>This is the MoMo sandbox environment for testing.</p>
                </div>
              )}
            </div>
          )}

          {paymentStatus === "success" && (
            <div className="flex flex-col items-center gap-3 text-green-600">
              <CheckCircle2 className="h-12 w-12" />
              <p className="text-lg font-semibold">Payment Successful!</p>
              <p className="text-sm text-muted-foreground">
                Redirecting to your receipt...
              </p>
            </div>
          )}

          {(paymentStatus === "failed" || paymentStatus === "expired") && (
            <div className="flex flex-col items-center gap-3">
              <XCircle className="h-12 w-12 text-red-500" />
              <p className="text-lg font-semibold text-red-600">
                Payment {paymentStatus === "expired" ? "Expired" : "Failed"}
              </p>
              <p className="text-sm text-muted-foreground">
                Your payment could not be completed. Please try again.
              </p>
              <Button onClick={handleRetry} variant="outline" className="mt-2">
                Try Again
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
