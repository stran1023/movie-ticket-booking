"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAppSelector } from "@/lib/store/hooks"
import { AccountSidebar } from "@/components/account-sidebar"

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const role = useAppSelector((s) => s.auth.role)
  const router = useRouter()

  const isAuthenticated = role !== "guest"

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login?returnUrl=/account/info")
    }
  }, [isAuthenticated, router])

  // Block rendering until we know the user is allowed in.
  // PersistGate (loading={null}) guarantees rehydration is complete before
  // this layout ever mounts, so there is no false-positive redirect on load.
  if (!isAuthenticated) return null

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl font-bold text-foreground">My Account</h1>
      <p className="mt-1 text-muted-foreground">
        Manage your bookings and account settings
      </p>
      <div className="mt-6 flex flex-col gap-6 md:flex-row">
        <AccountSidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
