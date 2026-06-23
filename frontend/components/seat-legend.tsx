import { SeatIcon } from "@/components/seat-icon";

const legendItems = [
  { type: "normal" as const, label: "Normal (75.000₫)" },
  { type: "vip" as const, label: "VIP (120.000₫)" },
  { type: "couple" as const, label: "Couple (180.000₫)" },
  { type: "selected" as const, label: "Selected" },
  { type: "occupied" as const, label: "Sold / Held" },
];

export function SeatLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 py-3">
      {legendItems.map((item) => (
        <div key={item.type} className="flex items-center gap-1.5">
          <SeatIcon type={item.type} className="h-5 w-5" />
          <span className="text-xs text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
