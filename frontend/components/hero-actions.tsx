import Link from "next/link";
import { ArrowRight, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HeroActions() {
  return (
    <div className="flex gap-3">
      <Link href="/movies">
        <Button size="lg" className="gap-2">
          Browse Movies
          <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
      <Link href="/booking">
        <Button size="lg" variant="outline" className="gap-2">
          <Ticket className="h-4 w-4" />
          Book Tickets
        </Button>
      </Link>
    </div>
  );
}
