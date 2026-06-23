"use client"

import { useRef, useState } from "react"
import { Camera, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { uploadAvatar, deleteAvatar } from "@/lib/api/account"
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks"
import { updateProfile } from "@/lib/store/slices/authSlice"

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "").trim()

/** Resolves a server-relative avatar path to a full URL with a cache-busting param. */
function resolveAvatarUrl(url: string | null | undefined, bust?: number): string | undefined {
  if (!url) return undefined
  const base = url.startsWith("http") ? url : `${API_BASE}${url}`
  return bust ? `${base}?v=${bust}` : base
}

function getInitials(fullName?: string | null, username?: string | null): string {
  if (fullName?.trim()) {
    return fullName
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase()
  }
  return username?.[0]?.toUpperCase() ?? "?"
}

export function AvatarUpload() {
  const dispatch = useAppDispatch()
  const profile = useAppSelector((s) => s.auth.profile)

  const originalUrl = resolveAvatarUrl(profile?.avatar)
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(originalUrl)
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const initials = getInitials(profile?.fullName, profile?.username)
  const busy = isUploading || isDeleting
  const hasAvatar = Boolean(profile?.avatar)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const localPreview = URL.createObjectURL(file)
    setPreviewUrl(localPreview)
    setIsUploading(true)

    try {
      const data = await uploadAvatar(file)
      // Cache-bust the newly uploaded URL so the browser fetches the fresh file
      const newResolved = resolveAvatarUrl(data.avatar, Date.now())
      setPreviewUrl(newResolved)
      dispatch(updateProfile({ avatar: data.avatar }))
      toast.success("Avatar updated successfully!")
    } catch {
      setPreviewUrl(originalUrl)
      toast.error("Failed to upload avatar. Please try again.")
    } finally {
      setIsUploading(false)
      // Reset so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleDelete() {
    setIsDeleting(true)
    try {
      await deleteAvatar()
      setPreviewUrl(undefined)
      dispatch(updateProfile({ avatar: null }))
      toast.success("Avatar removed.")
    } catch {
      toast.error("Failed to remove avatar. Please try again.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0">
        <Avatar className="h-20 w-20">
          <AvatarImage src={previewUrl} alt={profile?.fullName ?? "Avatar"} />
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>

        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          </div>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
          className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 disabled:opacity-50"
          aria-label="Change avatar"
        >
          <Camera className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="min-w-0">
        <h2 className="truncate text-xl font-semibold text-foreground">
          {profile?.fullName || profile?.username}
        </h2>
        {hasAvatar && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={handleDelete}
            className="mt-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            {isDeleting ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            )}
            Remove photo
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
