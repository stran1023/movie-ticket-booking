"use client"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

interface TimeSlotButtonProps {
  time: string
  format: string
  hall: string
  availableSeats: number
  selected: boolean
  onClick: () => void
}

export function TimeSlotButton({
  time,
  format,
  hall,
  availableSeats,
  selected,
  onClick,
}: TimeSlotButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-lg border-2 px-4 py-3 transition-all",
        selected
          ? "border-primary bg-primary/5 shadow-md"
          : "border-border bg-card hover:border-primary/30 hover:shadow-sm"
      )}
    >
      <span
        className={cn(
          "text-lg font-bold",
          selected ? "text-primary" : "text-foreground"
        )}
      >
        {time}
      </span>
      <Badge
        variant="secondary"
        className={cn(
          "text-xs",
          selected && "bg-primary/10 text-primary"
        )}
      >
        {format}
      </Badge>

      <span
        className={cn(
          "text-xs",
          availableSeats < 20 ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {availableSeats} seats
      </span>
    </button>
  )
}
