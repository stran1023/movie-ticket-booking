"use client"

import { useState } from "react"
import { Formik, Form, Field, ErrorMessage } from "formik"
import { KeyRound, Eye, EyeOff, LoaderCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

import { changePassword } from "@/lib/api/account"
import { changePasswordSchema, validateWithZod } from "@/lib/validations"
import { useAppDispatch } from "@/lib/store/hooks"
import { logout } from "@/lib/store/slices/authSlice"
import { persistor } from "@/lib/store/store"

// ---- types ----
interface FormValues {
  oldPassword: string
  newPassword: string
  confirmPassword: string
}

const INITIAL_VALUES: FormValues = {
  oldPassword: "",
  newPassword: "",
  confirmPassword: "",
}

// ---- sub-component: password field with show/hide toggle ----
function PasswordField({
  name,
  label,
  placeholder,
}: {
  name: string
  label: string
  placeholder?: string
}) {
  const [show, setShow] = useState(false)

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name} className="text-sm" mandatory>
        {label}
      </Label>
      <div className="relative">
        <Field
          as={Input}
          id={name}
          name={name}
          type={show ? "text" : "password"}
          placeholder={placeholder ?? "••••••••"}
          className="pr-10"
          autoComplete={name === "oldPassword" ? "current-password" : "new-password"}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>
      <ErrorMessage
        name={name}
        render={(msg) => (
          <p className="text-xs text-destructive">{msg}</p>
        )}
      />
    </div>
  )
}

// ---- main component ----
export function ChangePasswordDialog() {
  const [open, setOpen] = useState(false)
  const dispatch = useAppDispatch()
  const router = useRouter()

  const handleSubmit = async (
    values: FormValues,
    {
      setSubmitting,
      setFieldError,
      resetForm,
    }: {
      setSubmitting: (s: boolean) => void
      setFieldError: (field: string, msg: string) => void
      resetForm: () => void
    }
  ) => {
    setSubmitting(true)
    try {
      await changePassword({
        old_password: values.oldPassword,
        new_password: values.newPassword,
      })

      // Success path
      resetForm()
      setOpen(false)
      toast.success("Password updated successfully. Please log in again.")

      // Force logout — tokens are blacklisted on the backend
      dispatch(logout())
      await persistor.purge()
      router.push("/login")
    } catch (err: any) {
      const data = err?.response?.data

      if (data) {
        // Map backend field errors to Formik fields
        if (data.old_password) {
          setFieldError("oldPassword", Array.isArray(data.old_password) ? data.old_password[0] : data.old_password)
        }
        if (data.new_password) {
          setFieldError("newPassword", Array.isArray(data.new_password) ? data.new_password[0] : data.new_password)
        }
        // Generic / non-field errors
        const generic = data.detail ?? data.non_field_errors?.[0]
        if (generic && !data.old_password && !data.new_password) {
          toast.error(generic)
        }
      } else {
        toast.error("Something went wrong. Please try again.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <KeyRound className="h-3.5 w-3.5" />
          Change Password
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
        </DialogHeader>

        <Formik
          initialValues={INITIAL_VALUES}
          validate={(values) =>
            validateWithZod(changePasswordSchema, values as unknown as Record<string, unknown>)
          }
          onSubmit={handleSubmit}
        >
          {({ isSubmitting }) => (
            <Form className="mt-2 flex flex-col gap-4">
              <PasswordField
                name="oldPassword"
                label="Current Password"
                placeholder="Enter your current password"
              />
              <PasswordField
                name="newPassword"
                label="New Password"
                placeholder="At least 8 characters"
              />
              <PasswordField
                name="confirmPassword"
                label="Confirm New Password"
                placeholder="Repeat new password"
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="min-w-24 gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Update Password"
                  )}
                </Button>
              </div>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  )
}
