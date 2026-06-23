import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { logout } from "./authSlice";

interface CartItem {
  seatId: string;
  label: string;
  type: string;
  price: number;
}

interface CartState {
  items: CartItem[];
  discount: number;
  pointsDiscount: number;
}

const initialState: CartState = {
  items: [],
  discount: 0,
  pointsDiscount: 0,
};

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    setCartItems(state, action: PayloadAction<CartItem[]>) {
      state.items = action.payload;
    },
    setDiscount(state, action: PayloadAction<number>) {
      state.discount = action.payload;
    },
    setPointsDiscount(state, action: PayloadAction<number>) {
      state.pointsDiscount = action.payload;
    },
    clearCart() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(logout, () => initialState);
  },
});

export const { setCartItems, setDiscount, setPointsDiscount, clearCart } =
  cartSlice.actions;
export default cartSlice.reducer;
