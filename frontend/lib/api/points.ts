import apiClient from "@/lib/api/client";

export interface PointRedemptionConfig {
  max_redeem_percentage: number;
  min_points_to_redeem: number;
  points_per_vnd: number;
  is_active: boolean;
}

export interface PointBalance {
  balance: number;
  total_earned: number;
  total_redeemed: number;
}

export interface PointCalculation {
  redeemable_points: number;
  max_discount_vnd: number;
  user_balance: number;
  min_points: number;
  max_redeem_percentage: number;
  is_redemption_available: boolean;
  config_active: boolean;
}

export interface RedeemResult {
  balance: number;
  points_redeemed: number;
  discount_applied: number;
}

export interface PointTransactionRecord {
  id: number;
  transaction_type: "earn" | "redeem" | "adjust";
  points: number;
  balance_after: number;
  booking_code: string | null;
  note: string;
  created_at: string;
}

export async function getPointConfig(): Promise<PointRedemptionConfig> {
  const res = await apiClient.get("/points/config/");
  return res.data;
}

export async function getPointBalance(): Promise<PointBalance> {
  const res = await apiClient.get("/points/balance/");
  return res.data;
}

export async function calculateRedeemablePoints(
  subtotal: number,
  amountAlreadyDiscounted: number = 0,
): Promise<PointCalculation> {
  const res = await apiClient.get("/points/calculate/", {
    params: {
      subtotal,
      amount_already_discounted: amountAlreadyDiscounted,
    },
  });
  return res.data;
}

export async function redeemPoints(params: {
  booking_id: number;
  points_to_redeem: number;
  subtotal: number;
  amount_already_discounted: number;
}): Promise<RedeemResult> {
  const res = await apiClient.post("/points/redeem/", params);
  return res.data;
}

export async function getPointTransactionHistory(): Promise<
  PointTransactionRecord[]
> {
  const res = await apiClient.get("/points/history/");
  return res.data;
}
