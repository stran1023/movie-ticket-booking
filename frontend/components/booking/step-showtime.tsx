"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks"
import {
  selectDate,
  selectShowtime,
  setStep,
} from "@/lib/store/slices/bookingSlice"
import { fetchShowtimes, type ShowtimeWithMeta } from "@/lib/api/cinemas"
import apiClient from "@/lib/api/client"
import { DateChip } from "@/components/date-chip"
import { TimeSlotButton } from "@/components/time-slot-button"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { LoginGateDialog } from "@/components/booking/login-gate-dialog"
import { useBookingNav } from "@/components/booking/booking-nav-context"

export function StepShowtime() {
  const dispatch = useAppDispatch()
  const { requestStep } = useBookingNav()
  const { selectedMovieId, selectedDate, selectedShowtimeId } = useAppSelector(
    (s) => s.booking
  )
  const currentStep = useAppSelector((s) => s.booking.currentStep)
  const role = useAppSelector((s) => s.auth.role)

  const [showtimes, setShowtimes] = useState<ShowtimeWithMeta[]>([])
  const [loading, setLoading] = useState(false)
  const [showLoginDialog, setShowLoginDialog] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchShowtimes({ status: "confirmed" }).then((data) => {
      if (!cancelled) {
        setShowtimes(data)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  const movieTitle = useMemo(() => {
    if (!selectedMovieId) return null
    const match = showtimes.find((s) => s.movieId === selectedMovieId)
    return match?.movieTitle ?? null
  }, [showtimes, selectedMovieId])

  const movieShowtimes = useMemo(() => {
    const now = new Date();
    const list = selectedMovieId
      ? showtimes.filter((s) => s.movieId === selectedMovieId)
      : showtimes;

    // Front-end defense-in-depth: Filter out showtimes that started more than 5 mins ago
    return list.filter((s) => {
      // Construct a local Date object from "YYYY-MM-DD" and "HH:mm"
      const showtimeDate = new Date(`${s.date}T${s.time}:00`);
      const fiveMinsAgo = new Date(now.getTime() - 5 * 60 * 1000);
      return showtimeDate >= fiveMinsAgo;
    });
  }, [showtimes, selectedMovieId]);

  const dates = useMemo(
    () => Array.from(new Set(movieShowtimes.map((s) => s.date))).sort(),
    [movieShowtimes]
  )

  const filteredShowtimes = useMemo(
    () =>
      selectedDate
        ? movieShowtimes.filter((s) => s.date === selectedDate)
        : [],
    [movieShowtimes, selectedDate]
  )

  // After successful login: advance to step 3 (showtime is already selected)
  const handleLoginSuccess = useCallback(() => {
    dispatch(setStep(3))
  }, [dispatch])

  const handleNext = useCallback(async () => {
    if (role === "guest") {
      setShowLoginDialog(true)
      return
    }

    // Proactively verify the token is still valid before advancing.
    // The access token may have expired while the user was idle (10-min lifetime).
    // A cheap /me/ call lets the Axios interceptor silently refresh it.
    try {
      await apiClient.get("/me/")
    } catch {
      // Interceptor already dispatched logout() if refresh failed —
      // the auth guard effect will kick the user back to step 2 and
      // the next "Next" click will show the login dialog cleanly.
      return
    }

    dispatch(setStep(3))
  }, [role, dispatch])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading showtimes...</span>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground">Select Showtime</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {movieTitle
          ? `Choose a date and time for "${movieTitle}"`
          : "Select a date and time"}
      </p>

      {dates.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">
          No showtimes available. Check back later.
        </p>
      )}

      <div className="mt-6">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Select Date
        </h3>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {dates.map((date) => (
            <DateChip
              key={date}
              date={date}
              selected={selectedDate === date}
              onClick={() => dispatch(selectDate(date))}
            />
          ))}
        </div>
      </div>

      {selectedDate && filteredShowtimes.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            Select Time
          </h3>
          <div className="flex flex-wrap gap-3">
            {[...filteredShowtimes]
              .sort((a, b) => a.time.localeCompare(b.time))
              .map((st) => (
                <TimeSlotButton
                  key={st.id}
                  time={st.time}
                  format={st.format}
                  hall={st.hall}
                  availableSeats={st.availableSeats}
                  selected={selectedShowtimeId === st.id}
                  onClick={() => dispatch(selectShowtime(st.id))}
                />
              ))}
          </div>
        </div>
      )}

      <div className="mt-8 flex justify-between">
        <Button variant="outline" onClick={() => requestStep(currentStep - 1)}>
          Back
        </Button>
        <Button
          onClick={handleNext}
          disabled={!selectedShowtimeId}
          size="lg"
        >
          Next: Select Seats
        </Button>
      </div>

      <LoginGateDialog
        open={showLoginDialog}
        onOpenChange={setShowLoginDialog}
        onSuccess={handleLoginSuccess}
      />
    </div>
  )
}
