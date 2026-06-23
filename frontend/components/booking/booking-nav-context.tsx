"use client";

import { createContext, useContext } from "react";

type BookingNavContextValue = {
  requestStep: (step: number) => void;
};

const BookingNavContext = createContext<BookingNavContextValue>({
  requestStep: () => {},
});

export const BookingNavProvider = BookingNavContext.Provider;

export function useBookingNav() {
  return useContext(BookingNavContext);
}
