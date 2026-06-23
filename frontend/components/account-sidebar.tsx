"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ticket, Star, User, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

const sidebarLinks = [
  { href: "/account/info", label: "Account Info", icon: User },
  { href: "/account/tickets", label: "Booked Tickets", icon: Ticket },
  { href: "/account/reminders", label: "Movie Reminders", icon: Bell },
  { href: "/account/points", label: "Points History", icon: Star },
];

export function AccountSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-full shrink-0 md:w-56">
      <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col">
        {sidebarLinks.map((link) => {
          const Icon = link.icon;
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
