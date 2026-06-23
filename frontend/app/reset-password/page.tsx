"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Film, Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { resetPassword } from "@/lib/api/auth";

// ─── Inner component ──────────────────────────────────────────────────────────
// Isolated so the Suspense boundary can wrap useSearchParams().

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const uid = searchParams.get("uid") ?? "";
  const token = searchParams.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldError(null);

    // Guard: link params must be present
    if (!uid || !token) {
      toast.error(
        "Invalid reset link. Please request a new password reset email.",
      );
      return;
    }

    // Client-side match check before hitting the network
    if (newPassword !== confirmPassword) {
      setFieldError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      await resetPassword(uid, token, newPassword);
      toast.success("Password reset successfully! Please log in with your new password.");
      router.push("/login");
    } catch (err: any) {
      const data = err?.response?.data;

      // { new_password: ["This password is too short.", ...] }
      const passwordErrors: string[] | undefined = Array.isArray(
        data?.new_password,
      )
        ? data.new_password
        : undefined;

      // { detail: "Password reset link is invalid or has expired." }
      const detail: string | undefined =
        typeof data?.detail === "string" ? data.detail : undefined;

      if (passwordErrors?.length) {
        setFieldError(passwordErrors.join(" "));
      } else if (detail) {
        toast.error(detail);
      } else {
        toast.error(
          "Password reset failed. The link may be invalid or expired.",
        );
      }
    } finally {
      setIsLoading(false);
    }
  }

  // ── Missing params guard (renders immediately, no API call needed) ──
  if (!uid || !token) {
    return (
      <div className="space-y-4 py-4 text-center">
        <p className="text-sm text-muted-foreground">
          This reset link is invalid or has already been used.
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/forgot-password">Request a New Reset Link</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* New Password */}
      <div>
        <Label htmlFor="new-password">New Password</Label>
        <div className="relative mt-1">
          <Input
            id="new-password"
            type={showNew ? "text" : "password"}
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setFieldError(null);
            }}
            placeholder="Enter new password"
            className="pr-10"
            required
            disabled={isLoading}
            autoComplete="new-password"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowNew((s) => !s)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
            aria-label={showNew ? "Hide password" : "Show password"}
          >
            {showNew ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Confirm Password */}
      <div>
        <Label htmlFor="confirm-password">Confirm New Password</Label>
        <div className="relative mt-1">
          <Input
            id="confirm-password"
            type={showConfirm ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setFieldError(null);
            }}
            placeholder="Repeat new password"
            className="pr-10"
            required
            disabled={isLoading}
            autoComplete="new-password"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowConfirm((s) => !s)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
            aria-label={showConfirm ? "Hide password" : "Show password"}
          >
            {showConfirm ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Inline error: mismatch OR Django validator messages */}
        {fieldError && (
          <p className="mt-1 text-xs text-destructive">{fieldError}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Resetting…
          </>
        ) : (
          "Reset Password"
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Link
          href="/forgot-password"
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-3 w-3" />
          Request a new link
        </Link>
      </p>
    </form>
  );
}

// ─── Page shell ───────────────────────────────────────────────────────────────

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <Film className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-4 text-2xl font-bold text-foreground">
            Reset Password
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a strong new password for your CineBook account.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            }
          >
            <ResetPasswordContent />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
