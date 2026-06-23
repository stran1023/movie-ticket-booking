import type { MemberProfile, Gender } from "@/lib/store/slices/authSlice";

type ServerUser = {
  id: number | string;
  username: string;
  email?: string;
  date_joined?: string;
  created_at?: string;
  profile?: {
    full_name?: string;
    phone_number?: string;
    identity_card?: string | null;
    address?: string;
    date_of_birth?: string | null;
    gender?: string;
    total_points?: number;
    created_at?: string;
    avatar?: string | null;
  };
};

export function mapServerUserToMemberProfile(u: ServerUser): MemberProfile {
  const p = u.profile || {};
  const isoToDate = (v?: string | null) => (v ? v.split("T")[0] : ""); // keep "YYYY-MM-DD"

  return {
    id: String(u.id),
    username: u.username,
    fullName: p.full_name || "",
    email: u.email || "",
    phoneNumber: p.phone_number || "",
    dateOfBirth: p.date_of_birth ? isoToDate(p.date_of_birth) : "",
    gender: (p.gender as Gender) || "other",
    identityCard: p.identity_card || "",
    address: p.address || "",
    points: p.total_points ?? 0,
    memberSince: isoToDate(
      u.date_joined || p.created_at || u.created_at || new Date().toISOString(),
    ),
    avatar: p.avatar ?? null,
  };
}
