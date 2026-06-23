"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Film, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { forgotPassword } from "@/lib/api/auth";

const COOLDOWN_SECONDS = 60;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up the interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function startCooldown() {
    setCooldown(COOLDOWN_SECONDS);
    intervalRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim() || isLoading || cooldown > 0) return;

    setIsLoading(true);
    try {
      await forgotPassword(email.trim());
    } catch {
      // Intentionally swallowed: backend always returns 200 to prevent
      // enumeration; we mirror that behaviour on the frontend.
      // Only genuine network / server-crash errors reach here — we still
      // show the same generic message so the UX is consistent.
    } finally {
      setIsLoading(false);
      toast.success(
        "If an account with this email exists, a reset link has been sent.",
        { duration: 5000 },
      );
      startCooldown();
    }
  }

  const isDisabled = isLoading || cooldown > 0;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <Film className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-4 text-2xl font-bold text-foreground">
            Forgot Password?
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your email address and we&apos;ll send a reset link if an
            account exists.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1"
                required
                disabled={isDisabled}
                autoComplete="email"
              />
            </div>

            <Button type="submit" className="w-full" disabled={isDisabled}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : cooldown > 0 ? (
                `Resend available in ${cooldown}s`
              ) : (
                "Send Reset Link"
              )}
            </Button>
          </form>

          {/* Cooldown explanation */}
          {cooldown > 0 && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Check your inbox (and spam folder). You can request another link
              in {cooldown} second{cooldown !== 1 ? "s" : ""}.
            </p>
          )}

          <p className="mt-4 text-center text-sm text-muted-foreground">
            <Link
              href="/login"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
