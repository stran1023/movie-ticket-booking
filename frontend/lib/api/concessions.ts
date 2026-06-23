"use client";

import apiClient from "@/lib/api/client";
import type { Concession, ConcessionVariant } from "@/lib/mock-data";

/* ───────────────────────── API DTOs ───────────────────────── */

interface ApiCategory {
  id: number;
  name: string;
}

interface ApiVariant {
  id: number;
  name: string;
  sku: string;
  base_price: string;
  in_combo_price: string;
  is_active: boolean;
  concession: {
    id: number;
    name: string;
  };
}

interface ApiConcession {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  is_combo: boolean;
  category: ApiCategory;
  variants?: ApiVariant[];
  image_url?: string;
  priority: number;
}

type ApiPricing = "base" | "combo";

/* ───────────────────────── Helpers ───────────────────────── */

function toNumber(v: string | number | null | undefined): number {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function slugifyCategory(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function unwrapList<T>(data: any): T[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

/* ───────────────────────── Adapters ───────────────────────── */

function adaptVariant(raw: ApiVariant): ConcessionVariant {
  return {
    id: String(raw.id),
    concessionId: String(raw.concession.id),
    name: raw.name,
    sku: raw.sku,
    basePrice: toNumber(raw.base_price),
    inComboPrice: toNumber(raw.in_combo_price ?? raw.base_price),
    isActive: raw.is_active,
  };
}

function adaptConcession(raw: ApiConcession): Concession {
  const categoryDisplayName = raw.category?.name ?? "Other";

  return {
    id: String(raw.id),
    name: raw.name,
    description: raw.description ?? "",
    isActive: raw.is_active,
    isCombo: raw.is_combo,
    category: slugifyCategory(categoryDisplayName),
    categoryDisplayName,
    variants: Array.isArray(raw.variants) ? raw.variants.map(adaptVariant) : [],
    imageUrl: typeof raw.image_url === "string" ? raw.image_url : null,
    priority: raw.priority,
  };
}

/* ───────────────────────── API Calls ───────────────────────── */

/**
 * GET /concessions/concessions/?include=variants
 */
export async function fetchConcessions(): Promise<Concession[]> {
  try {
    const res = await apiClient.get("/concessions/concessions/", {
      params: {
        include: "variants",
        ordering: "-priority",
      },
    });

    const list = unwrapList<ApiConcession>(res.data);
    return list.map(adaptConcession);
  } catch (err) {
    console.error("Failed to fetch concessions", err);
    throw err;
  }
}

/**
 * GET /concessions/concessions/combos/
 */
export async function fetchComboConcessions(): Promise<Concession[]> {
  try {
    const res = await apiClient.get("/concessions/concessions/combos/", {
      params: {
        include: "variants",
      },
    });

    const list = unwrapList<ApiConcession>(res.data);
    return list.map(adaptConcession);
  } catch (err) {
    console.error("Failed to fetch combo concessions", err);
    throw err;
  }
}

/**
 * GET /concessions/concessions/<concession_id>/components/
 */
export async function fetchComboComponents(concessionId: string) {
  try {
    const res = await apiClient.get(
      `/concessions/concessions/${concessionId}/components/`,
    );

    return unwrapList<{
      id: number;
      quantity: number;
      variant: {
        id: number;
        concession: {
          name: string;
        };
        name: string;
        base_price: string;
        in_combo_price: string;
      };
    }>(res.data);
  } catch (err) {
    console.error("Failed to fetch combo components:", err);
    throw err;
  }
}

/**
 * POST /concessions/price/preview/
 */
export async function previewConcessionPrice(payload: {
  lines: {
    variantId: string;
    quantity: number;
    pricing?: ApiPricing;
    unitPrice?: number;
    displayName?: string;
  }[];
}) {
  try {
    const res = await apiClient.post("/concessions/price/preview/", {
      lines: payload.lines.map((line) => ({
        pricing: line.pricing,
        variant_id: Number(line.variantId),
        quantity: line.quantity,
        unit_price:
          line.unitPrice !== undefined ? String(line.unitPrice) : null,
        display_name: line.displayName ?? "",
      })),
    });

    return res.data as {
      lines: {
        variant_id: number;
        quantity: number;
        unit_price: string;
        line_total: string;
      }[];
      subtotal: string;
      discounts: never[];
      total: string;
    };
  } catch (err) {
    console.error("Failed to preview concession price:", err);
    throw err;
  }
}

/**
 * POST /concessions/orders/
 */
export async function createConcessionOrder(payload: {
  orderCode: string;
  salesChannel: "WEB" | "APP" | "KIOSK" | "IN_SEAT";
  booking?: number | null;
}) {
  try {
    const res = await apiClient.post("/concessions/orders/", {
      order_code: payload.orderCode,
      sales_channel: payload.salesChannel,
      booking: payload.booking ?? null,
    });

    return res.data as {
      id: number;
      order_code: string;
      sales_channel: string;
      booking: number | null;
      order_total: string;
    };
  } catch (err) {
    console.error("Failed to create concession order:", err);
    throw err;
  }
}

/**
 * POST /concessions/items/?order=<order_id>
 */
export async function addOrderItem(
  orderId: number,
  line: {
    variantId: number;
    quantity: number;
    displayName?: string;
    unitPrice?: string | number | null;
    pricing?: ApiPricing;
    notes?: string;
  },
  opts?: { pricing?: ApiPricing },
) {
  const payload: {
    variant_id: number;
    quantity: number;
    display_name?: string;
    unit_price?: string;
    notes?: string;
  } = {
    variant_id: line.variantId,
    quantity: line.quantity,
  };

  if (line.displayName !== undefined) {
    payload.display_name = line.displayName;
  }
  if (line.unitPrice !== undefined && line.unitPrice !== null) {
    payload.unit_price = String(line.unitPrice);
  }
  if (line.notes) {
    payload.notes = line.notes ?? "";
  }

  try {
    const qp = new URLSearchParams({ order: String(orderId) });
    if (opts?.pricing) qp.set("pricing", opts.pricing);

    const res = await apiClient.post(
      `/concessions/items/?${qp.toString()}`,
      payload,
    );

    return res.data as {
      id: number;
      display_name: string;
      quantity: number;
      unit_price: string;
      line_total: string;
    };
  } catch (err) {
    console.error("Failed to add order item:", err);
    throw err;
  }
}

/**
 * POST /concessions/orders/<order_id>/recalc/
 */
export async function recalcOrder(orderId: number) {
  try {
    const res = await apiClient.post(`/concessions/orders/${orderId}/recalc/`);

    return res.data as {
      id: number;
      order_code: string;
      sales_channel: string;
      booking: number | null;
      order_total: string;
      items: Array<{
        id: number;
        display_name: string;
        quantity: number;
        unit_price: string;
        line_total: string;
        variant: {
          id: number;
          name: string;
          sku: string;
          base_price: string;
          in_combo_price: string;
          concession: {
            id: number;
            name: string;
          };
        };
      }>;
    };
  } catch (err) {
    console.error("Failed to recalculate order:", err);
    throw err;
  }
}
