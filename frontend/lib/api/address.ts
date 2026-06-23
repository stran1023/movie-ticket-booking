import axios from "axios";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ProvinceResponse {
  code: number;
  name: string;
  division_type: string;
  codename: string;
}

export interface WardResponse {
  code: number;
  name: string;
  division_type: string;
  codename: string;
  province_code: number;
}

// ── Client ─────────────────────────────────────────────────────────────────────

const addressClient = axios.create({
  baseURL: "https://provinces.open-api.vn/api/v2",
  timeout: 10_000,
});

// ── Fetch Functions ────────────────────────────────────────────────────────────

/**
 * Fetch all provinces/cities.
 * GET /p/
 */
export async function getProvinces(): Promise<ProvinceResponse[]> {
  try {
    const res = await addressClient.get<ProvinceResponse[]>("/p/");
    return res.data;
  } catch (err: any) {
    throw new Error(
      err?.response?.data?.detail ?? "Failed to fetch provinces.",
    );
  }
}

/**
 * Fetch all wards belonging to a province.
 * Based on the 2025 Administrative Merger there are no districts —
 * wards connect directly to provinces.
 * GET /w/?province={provinceCode}
 */
export async function getWardsByProvince(
  provinceCode: number,
): Promise<WardResponse[]> {
  try {
    const res = await addressClient.get<WardResponse[]>("/w/", {
      params: { province: provinceCode },
    });
    return res.data;
  } catch (err: any) {
    throw new Error(
      err?.response?.data?.detail ??
        `Failed to fetch wards for province ${provinceCode}.`,
    );
  }
}
