"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Bell, BellOff, Loader2 } from "lucide-react"; // Awesome icons for the toggle!
import apiClient from "@/lib/api/client";
import { useAppSelector } from "@/lib/store/hooks";
import { toast } from "sonner"; // Using your existing toast notification

interface RemindMeButtonProps {
  movieId: number | string;
  status: string;
}

export default function RemindMeButton({
  movieId,
  status,
}: RemindMeButtonProps) {
  const router = useRouter();
  const pathname = usePathname();

  const role = useAppSelector((s) => s.auth.role);
  const isAuthenticated = role !== "guest";

  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [initialCheckDone, setInitialCheckDone] = useState<boolean>(false);

  // 1. Check if the user is already subscribed when the component loads
  useEffect(() => {
    if (!isAuthenticated || status !== "COMING_SOON") {
      setInitialCheckDone(true);
      return;
    }

    const checkSubscriptionStatus = async () => {
      try {
        const response = await apiClient.get(`/movies/${movieId}/remind/`);
        setIsSubscribed(response.data.is_subscribed);
      } catch (error) {
        console.error("Failed to check subscription status", error);
      } finally {
        setInitialCheckDone(true);
      }
    };

    checkSubscriptionStatus();
  }, [isAuthenticated, movieId, status]);

  if (status !== "COMING_SOON") return null;

  // Don't render the button until we know if they are subscribed to prevent layout shift
  if (isAuthenticated && !initialCheckDone) return null;

  const toggleSubscription = async () => {
    if (!isAuthenticated) {
      const returnUrl = encodeURIComponent(pathname);
      router.push(`/login?returnUrl=${returnUrl}`);
      return;
    }

    setLoading(true);

    try {
      if (isSubscribed) {
        // Cancel Reminder
        await apiClient.delete(`/movies/${movieId}/remind/`);
        setIsSubscribed(false);
        toast.success("Reminder cancelled.");
      } else {
        // Set Reminder
        await apiClient.post(`/movies/${movieId}/remind/`);
        setIsSubscribed(true);
        toast.success("Successfully subscribed to alerts!");
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.detail || "Action failed. Try again.";
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggleSubscription}
      disabled={loading}
      className={`w-full flex items-center justify-center gap-2 py-2 h-11 text-lg font-medium rounded-md transition-colors shadow-sm cursor-pointer ${
        loading
          ? "bg-muted text-muted-foreground cursor-not-allowed"
          : isSubscribed
            ? "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-white/10" // Cancel Style
            : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20" // Subscribe Style
      }`}
    >
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : isSubscribed ? (
        <>
          <BellOff className="h-5 w-5" />
          Cancel Reminder
        </>
      ) : (
        <>
          <Bell className="h-5 w-5" />
          Remind Me
        </>
      )}
    </button>
  );
}
