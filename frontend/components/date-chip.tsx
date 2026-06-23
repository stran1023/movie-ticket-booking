"use client"

import { cn } from "@/lib/utils"

interface DateChipProps {
  date: string
  selected: boolean
  onClick: () => void
}

export function DateChip({ date, selected, onClick }: DateChipProps) {
  const d = new Date(date + "T00:00:00")
  const dayName = d.toLocaleDateString("en-US", { weekday: "short" })
  const dayNum = d.getDate()
  const month = d.toLocaleDateString("en-US", { month: "short" })

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex min-w-[4.5rem] flex-col items-center gap-0.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
        selected
          ? "bg-primary text-primary-foreground shadow-md"
          : "bg-muted text-muted-foreground hover:bg-muted/80"
      )}
    >
      <span className="text-xs">{dayName}</span>
      <span className="text-lg font-bold leading-tight">{dayNum}</span>
      <span className="text-xs">{month}</span>
    </button>
  )
}
