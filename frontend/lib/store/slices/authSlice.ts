// authSlice.ts
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export const userRoles = ["guest", "member"] as const;
export type UserRole = (typeof userRoles)[number];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && userRoles.includes(value as UserRole);
}

export type Gender = "male" | "female" | "other";

export interface MemberProfile {
  id: string;
  username: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth: string;
  gender: Gender;
  identityCard: string;
  address: string;
  points: number;
  memberSince: string;
  avatar?: string | null;
}

interface AuthState {
  role: UserRole;
  profile: MemberProfile | null;
  accessToken: string | null;
}

const initialState: AuthState = {
  role: "guest",
  profile: null,
  accessToken: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setLoggedIn(
      state,
      action: PayloadAction<{ role: UserRole; profile: MemberProfile }>,
    ) {
      state.role = action.payload.role;
      state.profile = action.payload.profile;
    },
    setProfile(state, action: PayloadAction<MemberProfile>) {
      state.profile = action.payload;
    },
    setAccessToken(state, action: PayloadAction<string | null>) {
      state.accessToken = action.payload;
    },
    clearAccessToken(state) {
      state.accessToken = null;
    },
    updateProfile(state, action: PayloadAction<Partial<MemberProfile>>) {
      if (state.profile) {
        state.profile = { ...state.profile, ...action.payload };
      }
    },
    logout(state) {
      state.role = "guest";
      state.profile = null;
      state.accessToken = null;
    },
  },
});

export const {
  setLoggedIn,
  setProfile,
  updateProfile,
  logout,
  setAccessToken,
  clearAccessToken,
} = authSlice.actions;
export default authSlice.reducer;
