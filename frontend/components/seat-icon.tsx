"use client";

import { cn } from "@/lib/utils";

export interface SeatIconProps {
  type: "normal" | "vip" | "couple" | "selected" | "occupied" | "held";
  isOccupied?: boolean;
  isSelected?: boolean;
  originalType?: "normal" | "vip" | "couple";
  className?: string;
}

const typeColors: Record<string, string> = {
  normal: "text-blue-500",
  vip: "text-amber-500",
  couple: "text-pink-400",
  selected: "text-primary",
  occupied: "text-foreground/30",
  held: "text-foreground/30",
};

export function SeatIcon({
  type,
  isOccupied,
  isSelected,
  originalType,
  className,
}: SeatIconProps) {
  const isCoupleRender = originalType === "couple" || type === "couple";

  let color: string;
  if (isSelected || type === "selected") {
    color = typeColors["selected"];
  } else if (isOccupied || type === "occupied" || type === "held") {
    color = typeColors["occupied"];
  } else {
    color = typeColors[type] ?? typeColors["occupied"];
  }

  // Couple seat - rectangle with two armchairs side by side
  if (isCoupleRender) {
    return (
      <svg
        viewBox="0 0 72 40"
        fill="currentColor"
        className={cn("w-16 h-8 md:w-18 md:h-9", color, className)}
      >
        {/* Background rectangle for couple seat */}
        <rect x="2" y="2" width="68" height="36" rx="4" fill="currentColor" opacity="0.2" />
        
        {/* Left armchair */}
        <g opacity="0.9">
          {/* Backrest - curved top */}
          <path d="M10 8 C10 5, 24 5, 24 8 L24 20 L10 20 Z" fill="currentColor" />
          {/* Seat cushion */}
          <rect x="8" y="20" width="18" height="6" rx="2" fill="currentColor" />
          {/* Left armrest */}
          <rect x="6" y="16" width="4" height="12" rx="2" fill="currentColor" />
          {/* Right armrest */}
          <rect x="24" y="16" width="4" height="12" rx="2" fill="currentColor" />
          {/* Legs */}
          <rect x="12" y="25" width="3" height="6" rx="1" fill="currentColor" />
          <rect x="19" y="25" width="3" height="6" rx="1" fill="currentColor" />
        </g>
        
        {/* Right armchair */}
        <g opacity="0.9">
          {/* Backrest - curved top */}
          <path d="M48 8 C48 5, 62 5, 62 8 L62 20 L48 20 Z" fill="currentColor" />
          {/* Seat cushion */}
          <rect x="46" y="20" width="18" height="6" rx="2" fill="currentColor" />
          {/* Left armrest */}
          <rect x="44" y="16" width="4" height="12" rx="2" fill="currentColor" />
          {/* Right armrest */}
          <rect x="62" y="16" width="4" height="12" rx="2" fill="currentColor" />
          {/* Legs */}
          <rect x="50" y="26" width="3" height="6" rx="1" fill="currentColor" />
          <rect x="57" y="26" width="3" height="6" rx="1" fill="currentColor" />
        </g>
      </svg>
    );
  }

  // Single seat - square with armchair icon
  return (
    <svg
      viewBox="0 0 36 40"
      fill="currentColor"
      className={cn("w-8 h-8 md:w-9 md:h-9", color, className)}
    >
      {/* Background square for single seat */}
      <rect x="2" y="2" width="32" height="36" rx="4" fill="currentColor" opacity="0.2" />
      
      {/* Armchair icon */}
      <g opacity="0.9">
        {/* Backrest - curved top */}
        <path d="M10 8 C10 5, 26 5, 26 8 L26 20 L10 20 Z" fill="currentColor" />
        {/* Seat cushion */}
        <rect x="8" y="20" width="20" height="6" rx="2" fill="currentColor" />
        {/* Left armrest */}
        <rect x="6" y="16" width="4" height="12" rx="2" fill="currentColor" />
        {/* Right armrest */}
        <rect x="26" y="16" width="4" height="12" rx="2" fill="currentColor" />
        {/* Legs */}
        <rect x="12" y="26" width="4" height="6" rx="1" fill="currentColor" />
        <rect x="20" y="26" width="4" height="6" rx="1" fill="currentColor" />
      </g>
    </svg>
  );
}