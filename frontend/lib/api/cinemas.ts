"use client";

import type { Movie, SeatData, Showtime } from "@/lib/mock-data";
import apiClient from "@/lib/api/client";

export const SEAT_PRICES: Record<string, number> = {
  normal: 75000,
  vip: 120000,
  couple: 180000,
};

// ── Movies ─────────────────────────────────────────

interface ApiMovie {
  id: number;
  title: string;
  poster_url: string | null;
  description: string | null;
  runtime: number;
  director: string;
  casts: string | null;
  genres: string[];
  version: string[];
  rating: string | null;
  trailer_url: string | null;
  _type: string;
  languages_subtitles: string | null;
}

function adaptMovie(raw: ApiMovie): Movie {
  return {
    id: String(raw.id),
    title: raw.title,
    posterUrl: raw.poster_url ?? "",
    version: raw.version ?? [],
    runtime: raw.runtime,
    description: raw.description ?? "",
    director: raw.director ?? "",
    cast: raw.casts ? raw.casts.split(",").map((s) => s.trim()) : [],
    genres: raw.genres ?? [],
    releaseDate: "",
    endDate: "",
    trailerUrl: raw.trailer_url ?? "",
    rating: 0,
  };
}

const API = (process.env.NEXT_PUBLIC_API_BASE ?? "").trim();

export async function fetchMovies(
  filter: "all" | "available" | "upcoming" = "all",
  page: number = 1,
  search: string = "",
) {
  const params = new URLSearchParams();

  if (filter && filter !== "all") {
    params.set("filter", filter);
  }
  if (page && page > 1) {
    params.set("page", String(page));
  }
  if (search.trim()) {
    params.set("search", search.trim());
  }

  const res = await fetch(`${API}/api/movies/?${params.toString()}`);
  if (!res.ok) {
    throw new Error("Failed to fetch movies");
  }

  const data = await res.json();

  return {
    movies: data.results.map((raw: ApiMovie) => adaptMovie(raw)),
    total: data.count,
    hasNextPage: Boolean(data.next),
  };
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

interface ApiShowtime {
  id: number;
  movieId: number;
  movieTitle: string;
  date: string;
  time: string;
  endTime: string;
  hall: string;
  format: string;
  availableSeats: number;
  totalSeats: number;
  basePrice: string;
  status: string;
}

function adaptShowtime(raw: ApiShowtime): Showtime {
  return {
    id: String(raw.id),
    movieId: String(raw.movieId),
    date: raw.date,
    time: raw.time,
    hall: raw.hall,
    format: raw.format,
    availableSeats: raw.availableSeats,
    totalSeats: raw.totalSeats,
  };
}

export interface ShowtimeWithMeta extends Showtime {
  movieTitle: string;
  endTime: string;
  basePrice: number;
  status: string;
}

function adaptShowtimeFull(raw: ApiShowtime): ShowtimeWithMeta {
  return {
    ...adaptShowtime(raw),
    movieTitle: raw.movieTitle,
    endTime: raw.endTime,
    basePrice: parseFloat(raw.basePrice),
    status: raw.status,
  };
}

export async function fetchShowtimes(
  params: {
    movieId?: string | number;
    date?: string;
    status?: string;
  } = {},
): Promise<ShowtimeWithMeta[]> {
  try {
    const res = await apiClient.get("/cinemas/showtimes/", {
      params: {
        movie_id: params.movieId,
        date: params.date,
        status: params.status,
      },
    });

    const data: ApiShowtime[] = Array.isArray(res.data)
      ? res.data
      : (res.data.results ?? []);

    return data.map(adaptShowtimeFull);
  } catch (err) {
    console.error("Failed to fetch showtimes", err);
    return [];
  }
}

interface ApiSeat {
  id: string;
  row: string;
  number: number;
  type: "normal" | "vip" | "couple";
  status: "available" | "occupied" | "held" | "held_by_you";
}

export async function fetchSeats(showtimeId: string): Promise<SeatData[]> {
  try {
    const res = await apiClient.get(`/cinemas/showtimes/${showtimeId}/seats/`);

    const data: ApiSeat[] = res.data;

    return data.map((s) => ({
      id: s.id,
      row: s.row,
      number: s.number,
      type: s.type,
      status: s.status,
    }));
  } catch (err) {
    console.error("Failed to fetch seats", err);
    return [];
  }
}

export interface HoldResult {
  held: string[];
  showtime_id: number;
  expires_at: string;
  hold_seconds: number;
}

export class SeatConflictError extends Error {
  conflicting_seats: string[];
  constructor(detail: string, conflicting: string[]) {
    super(detail);
    this.name = "SeatConflictError";
    this.conflicting_seats = conflicting;
  }
}

export class SessionExpiredError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "SessionExpiredError";
  }
}

export async function holdSeats(
  showtimeId: string,
  seatLabels: string[],
): Promise<HoldResult> {
  try {
    const res = await apiClient.post("/bookings/hold/", {
      showtime_id: Number(showtimeId),
      seat_labels: seatLabels,
    });
    return res.data;
  } catch (err: any) {
    const status = err?.response?.status;
    const data = err?.response?.data;

    if (status === 409) {
      throw new SeatConflictError(
        data?.detail || "One or more selected seats are no longer available.",
        data?.conflicting_seats ?? [],
      );
    }
    if (status === 408) {
      throw new SessionExpiredError(
        data?.detail ||
          "Your 15-minute booking window has expired. Please start a new seat selection.",
      );
    }
    throw new Error(data?.detail || "Failed to hold seats");
  }
}

export async function releaseSeats(showtimeId: string): Promise<void> {
  await apiClient.post("/bookings/release/", {
    showtime_id: Number(showtimeId),
  });
}

export interface BookingResult {
  bookingId: string;
  movieTitle: string;
  start_time: string;
  end_time: string;
  purchase_time: string;
  hall: string;
  seats: string[];
  totalAmount: number;
  finalAmount: number;
  discountAmount: number;
  pointsUsed: number;
  pointsEarned: number;
  paymentUrl: string;
  paymentMethod: string;
  txnRef: string;
}

export interface ConfirmBookingRequest {
  showtime_id: number;
  seat_labels: string[];
  payment_method: string;
  flat_price_promotion_id?: number | null;
  points_to_redeem: number;
  promo_code?: string | null;
  movie_id?: number | null;
  concession_amount: number;
  // concessions?: {
  //   id: number;
  //   quantity: number;
  // }[];
}

export async function confirmBooking(
  showtimeId: string,
  seatLabels: string[],
  paymentMethod: string = "vnpay",
  flatPricePromotionId?: number | null,
  pointsToRedeem: number = 0,
  promoCode?: string | null,
  movieId?: number | null,
  // concessions?: {
  //   id: number;
  //   quantity: number;
  // }[],
  concessionsAmount: number = 0,
): Promise<BookingResult> {
  try {
    const payload: ConfirmBookingRequest = {
      showtime_id: Number(showtimeId),
      seat_labels: seatLabels,
      payment_method: paymentMethod,
      flat_price_promotion_id: flatPricePromotionId ?? null,
      points_to_redeem: pointsToRedeem,
      promo_code: promoCode ?? null,
      movie_id: movieId ?? null,
      concession_amount: concessionsAmount,
      //concessions,
    };

    const res = await apiClient.post("/bookings/confirm/", payload);
    //   concession_amount: concessionsAmount,
    // });

    return res.data;
  } catch (err: any) {
    // Axios "network" errors, CORS blocks, or our refresh interceptor's AUTH_EXPIRED
    // won't have a DRF {detail: "..."} shape. Preserve the most informative message.
    const msgFromError =
      typeof err?.message === "string" && err.message.trim()
        ? err.message
        : null;

    const data = err?.response?.data;
    const detail =
      typeof data?.detail === "string"
        ? data.detail
        : typeof data?.message === "string"
          ? data.message
          : null;

    // DRF serializer errors often come as { field: ["msg"] }.
    let fieldError: string | null = null;
    if (!detail && data && typeof data === "object" && !Array.isArray(data)) {
      const firstKey = Object.keys(data)[0];
      const firstVal = firstKey ? (data as any)[firstKey] : null;
      if (Array.isArray(firstVal) && typeof firstVal[0] === "string") {
        fieldError = `${firstKey}: ${firstVal[0]}`;
      }
    }

    throw new Error(detail || fieldError || msgFromError || "Booking failed");
  }
}

export interface PaymentStatusResult {
  txnRef: string;
  status: "pending" | "success" | "failed" | "expired";
  gateway: string;
  amount: number;
  bookingCode: string;
  bookingStatus: string;
}

export async function getPaymentStatus(
  txnRef: string,
): Promise<PaymentStatusResult> {
  const res = await apiClient.get(`/bookings/payment-status/${txnRef}/`);
  return res.data;
}
