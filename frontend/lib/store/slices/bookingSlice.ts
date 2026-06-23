import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { PromotionValidateResponse } from "../../api/promotions";
import { logout } from "./authSlice";

export interface SelectedSeat {
  id: string;
  row: string;
  number: number;
  type: "normal" | "vip" | "couple";
  price: number;
}

export interface ConcessionItem {
  variantId: string;
  displayName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
  identityCard: string;
}

export interface BookingReceipt {
  bookingId: string;
  movieTitle: string;
  startTime: string;
  endTime: string;
  purchaseTime: string;
  hall: string;

  seats: SelectedSeat[];
  concessions: ConcessionItem[];

  customer: CustomerInfo;
  seatsAmount: number;
  concessionsAmount: number;
  totalAmount: number;

  pointsUsed: number;
  pointsEarned: number;

  createdAt: string;

  // promotion/discount (from Code 1)
  discountAmount?: number;
  finalAmount?: number;
}

export interface PendingPayment {
  paymentUrl: string;
  paymentMethod: "vnpay" | "momo";
  txnRef: string;
  amount: number;
}

interface BookingState {
  currentStep: number;

  selectedMovieId: string | null;
  selectedDate: string | null;
  selectedShowtimeId: string | null;

  selectedSeats: SelectedSeat[];
  selectedConcessions: ConcessionItem[];

  customerInfo: CustomerInfo | null;
  receipt: BookingReceipt | null;

  usePoints: boolean;
  pointsToRedeem: number;

  holdExpiresAt: string | null;
  pendingPayment: PendingPayment | null;

  appliedPromoCode: string | null;
  promotionValidation: PromotionValidateResponse | null;
  appliedDiscount: number;
  appliedPromotion: {
    code: string;
    discountAmount: number;
    validation: PromotionValidateResponse;
  } | null;
}

const initialState: BookingState = {
  currentStep: 1,

  selectedMovieId: null,
  selectedDate: null,
  selectedShowtimeId: null,

  selectedSeats: [],
  selectedConcessions: [],

  customerInfo: null,
  receipt: null,

  usePoints: false,
  pointsToRedeem: 0,

  holdExpiresAt: null,
  pendingPayment: null,

  appliedPromoCode: null,
  promotionValidation: null,
  appliedPromotion: null,
  appliedDiscount: 0,
};

const MAX_STEP = 7;
const MAX_SEAT_UNITS = 8;

export function seatUnitCount(seats: SelectedSeat[]): number {
  return seats.reduce((sum, s) => sum + (s.type === "couple" ? 2 : 1), 0);
}

function seatUnits(seat: SelectedSeat): number {
  return seat.type === "couple" ? 2 : 1;
}

const bookingSlice = createSlice({
  name: "booking",
  initialState,
  reducers: {
    setStep(state, action: PayloadAction<number>) {
      state.currentStep = action.payload;
    },

    nextStep(state) {
      if (state.currentStep < MAX_STEP) state.currentStep += 1;
    },

    prevStep(state) {
      if (state.currentStep > 1) state.currentStep -= 1;
    },

    selectMovie(state, action: PayloadAction<string>) {
      state.selectedMovieId = action.payload;
      state.selectedDate = null;
      state.selectedShowtimeId = null;

      state.selectedSeats = [];
      state.selectedConcessions = [];

      // optional: clear promotion when movie changes (tuỳ business)
      state.appliedPromotion = null;
      state.appliedPromoCode = null;
      state.promotionValidation = null;
      state.appliedDiscount = 0;
    },

    selectDate(state, action: PayloadAction<string>) {
      state.selectedDate = action.payload;
      state.selectedShowtimeId = null;

      state.selectedSeats = [];
      state.selectedConcessions = [];
    },

    selectShowtime(state, action: PayloadAction<string>) {
      state.selectedShowtimeId = action.payload;

      state.selectedSeats = [];
      state.selectedConcessions = [];
    },

    toggleSeat(state, action: PayloadAction<SelectedSeat>) {
      const seat = action.payload;
      const index = state.selectedSeats.findIndex((s) => s.id === seat.id);

      if (index >= 0) {
        state.selectedSeats.splice(index, 1);
        return;
      }

      const currentUnits = seatUnitCount(state.selectedSeats);
      const nextUnits = currentUnits + seatUnits(seat);

      if (nextUnits <= MAX_SEAT_UNITS) {
        state.selectedSeats.push(seat);
      }
    },

    clearSeats(state) {
      state.selectedSeats = [];
    },

    clearHold(state) {
      state.selectedSeats = [];
      state.holdExpiresAt = null;
    },

    addConcession(state, action: PayloadAction<ConcessionItem>) {
      const item = action.payload;
      const existingIndex = state.selectedConcessions.findIndex(
        (c) => c.variantId === item.variantId,
      );

      if (existingIndex >= 0) {
        const existing = state.selectedConcessions[existingIndex];
        existing.quantity += item.quantity;
        existing.lineTotal = existing.quantity * existing.unitPrice;
      } else {
        state.selectedConcessions.push(item);
      }
    },

    updateConcessionQuantity(
      state,
      action: PayloadAction<{ variantId: string; quantity: number }>,
    ) {
      const { variantId, quantity } = action.payload;
      const item = state.selectedConcessions.find(
        (c) => c.variantId === variantId,
      );

      if (!item) return;

      item.quantity = Math.max(0, quantity);
      item.lineTotal = item.quantity * item.unitPrice;

      if (item.quantity === 0) {
        state.selectedConcessions = state.selectedConcessions.filter(
          (c) => c.variantId !== variantId,
        );
      }
    },

    removeConcession(state, action: PayloadAction<string>) {
      state.selectedConcessions = state.selectedConcessions.filter(
        (c) => c.variantId !== action.payload,
      );
    },

    clearConcessions(state) {
      state.selectedConcessions = [];
    },

    setCustomerInfo(state, action: PayloadAction<CustomerInfo>) {
      state.customerInfo = action.payload;
    },

    setReceipt(
      state,
      action: PayloadAction<
        Omit<BookingReceipt, "concessions"> & { concessions?: ConcessionItem[] }
      >,
    ) {
      state.receipt = {
        ...action.payload,
        concessions: action.payload.concessions || [],
      } as BookingReceipt;
    },

    setUsePoints(state, action: PayloadAction<boolean>) {
      state.usePoints = action.payload;
      if (!action.payload) {
        state.pointsToRedeem = 0;
      }
    },

    setPointsToRedeem(state, action: PayloadAction<number>) {
      state.pointsToRedeem = action.payload;
    },

    setHoldExpiresAt(state, action: PayloadAction<string | null>) {
      state.holdExpiresAt = action.payload;
    },

    setPendingPayment(state, action: PayloadAction<PendingPayment | null>) {
      state.pendingPayment = action.payload;
    },

    setAppliedPromotion(
      state,
      action: PayloadAction<{
        code: string;
        validation: PromotionValidateResponse;
        discountAmount: number;
      }>,
    ) {
      state.appliedPromotion = action.payload;
      state.appliedPromoCode = action.payload.code;
      state.promotionValidation = action.payload.validation;
      state.appliedDiscount = action.payload.discountAmount;
    },

    clearPromotion(state) {
      state.appliedPromotion = null;
      state.appliedPromoCode = null;
      state.promotionValidation = null;
      state.appliedDiscount = 0;
    },

    resetBooking() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(logout, () => initialState);
  },
});

export const {
  setStep,
  nextStep,
  prevStep,
  selectMovie,
  selectDate,
  selectShowtime,
  toggleSeat,
  clearSeats,
  clearHold,

  addConcession,
  updateConcessionQuantity,
  removeConcession,
  clearConcessions,

  setCustomerInfo,
  setReceipt,
  setUsePoints,
  setPointsToRedeem,

  setHoldExpiresAt,
  setPendingPayment,
  resetBooking,
  setAppliedPromotion,
  clearPromotion,
} = bookingSlice.actions;

export default bookingSlice.reducer;
