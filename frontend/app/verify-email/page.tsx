"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Loader2, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { verifyEmail } from "@/lib/api/auth";

// ─── Inner component ──────────────────────────────────────────────────────────
// Isolated so that the Suspense boundary can be placed in the outer shell,
// satisfying Next.js App Router's requirement for useSearchParams().

type VerifyStatus = "loading" | "success" | "error";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const uid = searchParams.get("uid");
  const token = searchParams.get("token");

  const [status, setStatus] = useState<VerifyStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!uid || !token) {
      setErrorMessage(
        "The activation link is missing required parameters. Please check your email and try again.",
      );
      setStatus("error");
      return;
    }

    verifyEmail(uid, token)
      .then(() => setStatus("success"))
      .catch((err: any) => {
        const detail = err?.response?.data?.detail;
        setErrorMessage(
          typeof detail === "string"
            ? detail
            : "Activation failed. The link may be invalid or has already been used. Please register again or contact support.",
        );
        setStatus("error");
      });
  }, [uid, token]);

  // ── Loading ──
  if (status === "loading") {
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          Verifying your email address…
        </p>
      </div>
    );
  }

  // ── Success ──
  if (status === "success") {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="rounded-full bg-green-100 p-3 dark:bg-green-900/30">
          <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Email Verified!
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your account is now active. Sign in to start booking your tickets.
          </p>
        </div>
        <Button asChild className="mt-2 w-full">
          <Link href="/login">Go to Login</Link>
        </Button>
      </div>
    );
  }

  // ── Error ──
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <div className="rounded-full bg-destructive/10 p-3">
        <XCircle className="h-10 w-10 text-destructive" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Verification Failed
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{errorMessage}</p>
      </div>
      <Button asChild variant="outline" className="mt-2 w-full">
        <Link href="/">Go to Homepage</Link>
      </Button>
    </div>
  );
}

// ─── Page shell ───────────────────────────────────────────────────────────────

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <Film className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-4 text-2xl font-bold text-foreground">
            Account Activation
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            We're confirming your email address
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <Suspense
            fallback={
              <div className="flex flex-col items-center gap-4 py-10">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading…</p>
              </div>
            }
          >
            <VerifyEmailContent />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
