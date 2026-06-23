import apiClient from "@/lib/api/client";

export interface AccountProfile {
  id: number;
  username: string;
  fullName: string | null;
  email: string;
  phoneNumber: string | null;
  dateOfBirth: string | null;
  gender: "male" | "female" | "other" | null;
  identityCard: string | null;
  province: string | null;
  ward: string | null;
  streetAddress: string | null;
  points: number;
  memberSince: string | null; // ISO date (YYYY-MM-DD)
  avatar: string | null;
}

export interface AccountProfileUpdatePayload {
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  gender?: "male" | "female" | "other";
  province?: string;
  ward?: string;
  streetAddress?: string;
}

export interface TicketDetail {
  id: number;
  seatLabel: string;
  seatType?: string;
  showDate: string | null;
  showTime: string;
  hall: string;
  movieTitle: string;
  price: string;
  ticketStatus: string;
}

export interface AccountBookedTicket {
  id: string;
  movieTitle: string;
  bookingDate: string;
  showDate: string | null;
  showTime: string;
  hall: string;
  seats: string;
  total: string;
  discountAmount: string;
  finalAmount: string;
  status: string;
  customerName: string;
  pointsEarned: number;
  pointsUsed: number;
  tickets: TicketDetail[];
}

export interface ChangePasswordPayload {
  old_password: string;
  new_password: string;
}

export interface AccountPointHistory {
  id: number;
  date: string;
  movieTitle: string;
  type: "added" | "used";
  points: number;
  description: string;
}

/**
 * Wrapper around authedFetch that returns JSON or throws with a readable message.
 * This must be called from a client component (or a client hook) after login.
 */
async function requestJson<T>(path: string, config?: any): Promise<T> {
  try {
    const res = await apiClient({ url: path, ...config });
    return res.data as T;
  } catch (err: any) {
    console.error(`API error at ${path}:`, err?.response?.data ?? err);
    throw err;
  }
}

// ---- NEW: mappers ----
function toCamelProfile(raw: any): AccountProfile {
  const p = raw?.profile ?? {};
  return {
    id: raw?.id,
    username: raw?.username,
    email: raw?.email,
    fullName: p.full_name ?? null,
    phoneNumber: p.phone_number ?? null,
    dateOfBirth: p.date_of_birth ?? null, // keep as "YYYY-MM-DD"
    gender: (p.gender as any) ?? null,
    identityCard: p.identity_card ?? null,
    province: p.province ?? null,
    ward: p.ward ?? null,
    // Fall back to legacy `address` field so existing data still renders
    streetAddress: p.street_address ?? p.address ?? null,
    points: p.total_points ?? 0,
    avatar: p.avatar ?? null,
    // Prefer user date_joined (top-level) as “Member Since”
    memberSince: raw?.date_joined
      ? String(raw.date_joined).split("T")[0]
      : null,
  };
}

function toSnakeUpdate(payload: AccountProfileUpdatePayload) {
  const out: any = {};
  if (payload.email !== undefined) out.email = payload.email; // top-level email
  if (payload.fullName !== undefined) out.full_name = payload.fullName;
  if (payload.phoneNumber !== undefined) out.phone_number = payload.phoneNumber;
  if (payload.gender !== undefined) out.gender = payload.gender;
  if (payload.province !== undefined) out.province = payload.province;
  if (payload.ward !== undefined) out.ward = payload.ward;
  if (payload.streetAddress !== undefined)
    out.street_address = payload.streetAddress;
  return out;
}

// ---- Read ----
export async function getAccountProfile(): Promise<AccountProfile> {
  return requestJson<any>("/me/").then(toCamelProfile);
}

// If apiClient is AXIOS:
export async function updateAccountProfile(
  payload: AccountProfileUpdatePayload,
): Promise<AccountProfile> {
  const dataToSend = toSnakeUpdate(payload);
  return requestJson<any>("/me/", {
    method: "PATCH",
    data: dataToSend, // axios uses `data`
    headers: { "Content-Type": "application/json" },
    withCredentials: true,
  }).then(toCamelProfile);
}

export async function getPointHistory(): Promise<AccountPointHistory[]> {
  return requestJson<AccountPointHistory[]>("/me/points/");
}

// Ensure this maps your backend payload into what the UI expects.
function mapBookedTicket(raw: any): AccountBookedTicket {
  return {
    id: raw.id,
    movieTitle: raw.movie_title ?? raw.movieTitle ?? "",
    bookingDate:
      raw.booking_date ??
      raw.bookingDate ??
      raw.created_at?.split("T")[0] ??
      "",
    showDate: raw.show_date ?? raw.showDate ?? null,
    showTime: raw.show_time ?? raw.showTime ?? "",
    hall: raw.hall ?? raw.cinema_room_name ?? "",
    seats: Array.isArray(raw.tickets)
      ? raw.tickets.map((t: any) => t.seat_label ?? t.seatLabel).join(", ")
      : (raw.seats ?? ""),
    total: String(raw.total ?? raw.total_amount ?? "0"),
    discountAmount: String(raw.discount_amount ?? raw.discountAmount ?? "0"),
    finalAmount: String(
      raw.final_amount ?? raw.finalAmount ?? raw.total ?? "0",
    ),
    status: raw.status ?? "",
    customerName: raw.customer_name ?? raw.customerName ?? "",
    pointsEarned: Number(raw.points_earned ?? raw.pointsEarned ?? 0),
    pointsUsed: Number(raw.points_used ?? raw.pointsUsed ?? 0),
    tickets: Array.isArray(raw.tickets)
      ? raw.tickets.map((t: any) => ({
          id: t.id,
          seatLabel: t.seat_label ?? t.seatLabel ?? "",
          seatType:
            t.seat_type ?? t.seatType ?? t.seat_type_snapshot ?? undefined,
          showDate: t.show_date ?? t.showDate ?? null,
          showTime: t.show_time ?? t.showTime ?? "",
          hall: t.hall ?? t.cinema_room_name ?? "",
          movieTitle: t.movie_title ?? t.movieTitle ?? raw.movie_title ?? "",
          price: String(t.price ?? t.ticket_price ?? "0"),
          ticketStatus: t.ticket_status ?? t.status ?? "",
        }))
      : [],
  };
}

// ✅ point to the new /me/ path and map the response
export async function getBookedTickets(): Promise<AccountBookedTicket[]> {
  const data = await requestJson<any[]>("/me/tickets/"); // <-- new endpoint
  return (Array.isArray(data) ? data : []).map(mapBookedTicket);
}

export async function changePassword(
  payload: ChangePasswordPayload,
): Promise<void> {
  await requestJson<void>("/change-password/", {
    method: "PUT",
    data: payload,
    headers: { "Content-Type": "application/json" },
  });
}

export async function deleteAccount(): Promise<void> {
  await requestJson<void>("/me/delete/", { method: "DELETE" });
}

export async function uploadAvatar(file: File): Promise<{ avatar: string }> {
  const formData = new FormData();
  formData.append("avatar", file);
  // Override Content-Type so axios doesn't lock it to application/json from
  // the default headers, but omit a fixed value so axios auto-generates the
  // correct multipart/form-data boundary.
  const res = await apiClient.patch("/me/avatar/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data as { avatar: string };
}

export async function deleteAvatar(): Promise<void> {
  await apiClient.delete("/me/avatar/");
}
