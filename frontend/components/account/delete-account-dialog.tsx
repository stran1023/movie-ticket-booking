"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { TriangleAlert, LoaderCircle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

import { deleteAccount } from "@/lib/api/account"
import { useAppDispatch } from "@/lib/store/hooks"
import { logout } from "@/lib/store/slices/authSlice"
import { persistor } from "@/lib/store/store"

const CONFIRM_PHRASE = "DELETE"

export function DeleteAccountDialog() {
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [loading, setLoading] = useState(false)
  const dispatch = useAppDispatch()
  const router = useRouter()

  const canSubmit = confirmText === CONFIRM_PHRASE && !loading

  const handleDelete = async () => {
    setLoading(true)
    try {
      await deleteAccount()

      toast.success("Your account has been deactivated.")

      // Clear in-memory Redux state then wipe persisted storage so
      // redux-persist cannot rehydrate stale tokens on the next page load.
      dispatch(logout())
      await persistor.purge()

      router.push("/")
    } catch {
      toast.error("Failed to delete account. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setConfirmText("") // reset input when dialog closes
        setOpen(next)
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" className="gap-2">
          <TriangleAlert className="h-3.5 w-3.5" />
          Delete Account
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive">
            Delete Account
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2 text-left">
            <span className="block">
              This will <strong>permanently deactivate</strong> your account.
              You will lose access to all your bookings and rewards points.
              This action <strong>cannot be undone</strong>.
            </span>
            <span className="block">
              All active sessions on every device will be signed out immediately.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-1.5 py-2">
          <Label htmlFor="confirm-delete" className="text-sm" mandatory>
            Type{" "}
            <span className="font-mono font-semibold text-destructive">
              {CONFIRM_PHRASE}
            </span>{" "}
            to confirm
          </Label>
          <Input
            id="confirm-delete"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_PHRASE}
            autoComplete="off"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={!canSubmit}
            onClick={handleDelete}
            className="min-w-28 gap-2"
          >
            {loading ? (
              <>
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                Deleting…
              </>
            ) : (
              "Delete My Account"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
