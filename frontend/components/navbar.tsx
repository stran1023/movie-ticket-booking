"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Film, Menu, X, LogOut } from "lucide-react";
import { useState } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { logout as clearAuth } from "@/lib/store/slices/authSlice";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";

const navLinks = {
  guest: [
    { href: "/", label: "Home" },
    { href: "/movies", label: "Movies" },
    { href: "/promotions", label: "Promotions" },
    { href: "/booking", label: "Book Tickets" },
  ],
  member: [
    { href: "/", label: "Home" },
    { href: "/movies", label: "Movies" },
    { href: "/promotions", label: "Promotions" },
    { href: "/booking", label: "Book Tickets" },
    { href: "/account/info", label: "My Account" },
  ],
} as const;

export function Navbar() {
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const router = useRouter();

  const role = useAppSelector((s) => s.auth.role);
  const profile = useAppSelector((s) => s.auth.profile);

  const [mobileOpen, setMobileOpen] = useState(false);

  const links = navLinks[role];

  async function handleLogout() {
    dispatch(clearAuth());
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2">
          <Film className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold tracking-tight text-foreground">
            CineBook
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => {
            const active =
              pathname === link.href ||
              (link.href !== "/" && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          {/* Read-only role + user display */}
          {profile && (
            <div className="hidden items-center lg:flex">
              <span className="px-2 py-1 text-sm font-semibold text-gray-800">
                Greetings, {profile.username}!
              </span>
            </div>
          )}

          {/* Auth CTA (desktop) */}
          {role === "guest" ? (
            <Link href="/login/" className="hidden md:block">
              <Button size="sm" variant="outline">
                Login
              </Button>
            </Link>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={handleLogout}
              className="hidden md:inline-flex"
            >
              <LogOut className="mr-1.5 h-4 w-4" />
            </Button>
          )}

          {/* Mobile sheet */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                {mobileOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <SheetTitle className="sr-only">Navigation</SheetTitle>

              {/* Role + user in sheet */}
              {profile && (
                <div className="mt-2 flex flex-col gap-1">
                  <span className="px-2 py-1 text-sm text-pink-400">
                    (˶ᵔᗜᵔ˶)ﾉﾞ Ohayoo, {profile.username} chan {">"}⩊{"<"}
                  </span>
                </div>
              )}

              <nav className="mt-6 flex flex-col gap-1">
                {links.map((link) => {
                  const active =
                    pathname === link.href ||
                    (link.href !== "/" && pathname.startsWith(link.href));
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {link.label}
                    </Link>
                  );
                })}

                {role === "guest" ? (
                  <Link href="/login/" onClick={() => setMobileOpen(false)}>
                    <Button size="sm" className="mt-4 w-full">
                      Login
                    </Button>
                  </Link>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-4 w-full hover:cursor-pointer"
                    onClick={() => {
                      setMobileOpen(false);
                      handleLogout();
                    }}
                  >
                    <LogOut className="mr-1.5 h-4 w-4" />
                  </Button>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
