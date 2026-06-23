import apiClient from "@/lib/api/client";
import type { Promotion } from "@/lib/mock-data";

const API = (process.env.NEXT_PUBLIC_API_BASE ?? "").trim();

// ── Flat Price Promotions ──────────────────────────────────────────────────────

export interface FlatPricePromotion {
  id: number;
  title: string;
  description: string;
  small_description: string;
  flat_price: number;
  seat_scope: "normal" | "vip" | "couple" | "all";
  cinema_version: { id: number; name: string } | null;
  recurring_weekday: number | null;
  start_date: string | null;
  end_date: string | null;
  bannerUrl?: string;
}

export interface FlatPriceValidateResponse {
  valid: boolean;
  flat_price?: number;
  applies_to?: string[];
  new_subtotal?: number;
  error?: string;
}

export async function getFlatPricePromotions(params: {
  showtime_id?: number;
}): Promise<FlatPricePromotion[]> {
  const searchParams = new URLSearchParams();
  if (params.showtime_id !== undefined) {
    searchParams.set("showtime_id", String(params.showtime_id));
  }

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/flat-price-promotions/?${searchParams.toString()}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error("Failed to fetch flat price promotions");
  }

  return response.json();
}

export async function validateFlatPricePromotion(params: {
  promotion_id: number;
  showtime_id: number;
  seat_types: string;
  seats: string;
}): Promise<FlatPriceValidateResponse> {
  const searchParams = new URLSearchParams({
    promotion_id: String(params.promotion_id),
    showtime_id: String(params.showtime_id),
    seat_types: params.seat_types,
    seats: params.seats,
  });

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/flat-price-promotions/validate/?${searchParams.toString()}`,
  );

  if (!response.ok) {
    throw new Error("Failed to validate flat price promotion");
  }

  return response.json();
}

export interface MovieValidateRequest {
  code: string;
  movie_id: number;
  total_amount: string;
}

export interface CalculatedDiscount {
  original_amount: string;
  discount_amount: string;
  final_amount: string;
}

export interface MoviePromotionData {
  id: number;
  code: string;
  discount_type: "PERCENTAGE" | "FIXED_AMOUNT";
  discount_value: string;
  max_discount_cap: string | null;
  stacking_rule: string;
  start_date: string;
  end_date: string;
  movie_id: number | null;
}

export interface PromotionValidateResponse {
  valid: boolean;
  reason?: string;
  error?: string;
  promotion?: MoviePromotionData;
  calculated_discount?: CalculatedDiscount;
  movie_id?: number;
  total_amount?: string;
}

export async function getPromotions(): Promise<Promotion[]> {
  const res = await fetch(`${API}/api/promotions/all`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch promotions");
  }

  return res.json();
}

export async function validatePromotion(
  request: MovieValidateRequest,
): Promise<PromotionValidateResponse> {
  const params = new URLSearchParams({
    code: request.code,
    movie_id: String(request.movie_id),
    total_amount: request.total_amount,
  });

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/promotions/validate?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error("Failed to validate promotion");
  }

  return response.json();
}

export async function redeemPromotion(params: { code: string }) {
  const res = await apiClient.post("/promotions/redeem", params);
  return res.data as { success: boolean; reason?: string };
}

export interface CommunityPromoTicketsResponse {
  codes: string[];
}

export async function getCommunityPromoTickets(
  limit = 5,
): Promise<CommunityPromoTicketsResponse> {
  const params = new URLSearchParams();
  if (limit !== undefined) {
    params.set("limit", String(limit));
  }

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/promotions/community?${params.toString()}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error("Failed to fetch community promo tickets");
  }

  return response.json();
}
