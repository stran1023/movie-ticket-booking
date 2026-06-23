// store/index.ts
import { configureStore, combineReducers } from "@reduxjs/toolkit"
import storage from "./storage"
import { persistReducer, persistStore, createTransform } from "redux-persist"

import authReducer from "./slices/authSlice"
import bookingReducer from "./slices/bookingSlice"
import cartReducer from "./slices/cartSlice"

const ACCESS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
type PersistedAuth = {
  role: string
  profile: any
  accessToken: string | null
  _ts?: number
}

const authExpiryTransform = createTransform(
  (inboundState: any) => {
    if (!inboundState) return inboundState
    return { ...inboundState, _ts: Date.now() }
  },
  (outboundState: PersistedAuth) => {
    if (!outboundState) return outboundState
    const age = Date.now() - (outboundState._ts ?? 0)
    if (age > ACCESS_MAX_AGE_MS) {
      return { role: "guest", profile: null, accessToken: null }
    }
    return outboundState
  },
  { whitelist: ["auth"] }
)

const authPersistConfig = {
  key: "auth",
  storage,
  whitelist: ["role", "profile", "accessToken"],
  transforms: [authExpiryTransform],
}

const bookingExpiryTransform = createTransform(
  (inboundState: any) => inboundState,
  (outboundState: any) => {
    if (!outboundState?.holdExpiresAt) return outboundState
    const remaining = new Date(outboundState.holdExpiresAt).getTime() - Date.now()
    if (remaining <= 0) {
      return {
        ...outboundState,
        holdExpiresAt: null,
        selectedSeats: [],
        currentStep: 1,
      }
    }
    return outboundState
  },
  { whitelist: ["booking"] },
)

const bookingPersistConfig = {
  key: "booking",
  storage,
  whitelist: [
    "selectedSeats",
    "holdExpiresAt",
    "selectedShowtimeId",
    "selectedMovieId",
    "selectedDate",
    "currentStep",
    "selectedConcessions",
  ],
  transforms: [bookingExpiryTransform],
}

const rootReducer = combineReducers({
  auth: persistReducer(authPersistConfig, authReducer),
  booking: persistReducer(bookingPersistConfig, bookingReducer),
  cart: cartReducer,
})

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefault) =>
    getDefault({
      serializableCheck: false,
    }),
})

export const persistor = 
  typeof window != "undefined" ? persistStore(store) : null

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch