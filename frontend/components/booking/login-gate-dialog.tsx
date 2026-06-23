"use client";

import Link from "next/link";
import { Film } from "lucide-react";
import { Formik, Form, Field } from "formik";
import apiClient from "@/lib/api/client";
import { useAppDispatch } from "@/lib/store/hooks";
import { setLoggedIn, setAccessToken, type UserRole } from "@/lib/store/slices/authSlice";
import { nextStep } from "@/lib/store/slices/bookingSlice";
import { mapServerUserToMemberProfile } from "@/lib/mappers/user-mapper";
import { loginSchema, validateWithZod } from "@/lib/validations";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { toast } from "sonner";

interface LoginGateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful login. When omitted, falls back to dispatching nextStep(). */
  onSuccess?: () => void;
}

export function LoginGateDialog({ open, onOpenChange, onSuccess }: LoginGateDialogProps) {
  const dispatch = useAppDispatch();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Film className="h-6 w-6 text-primary" />
          </div>

          <DialogTitle>Login to Continue</DialogTitle>

          <DialogDescription>
            Please sign in to your account to confirm your booking. Your
            selected seats will be preserved.
          </DialogDescription>
        </DialogHeader>

        <Formik
          initialValues={{ username: "", password: "" }}
          validate={(values) => validateWithZod(loginSchema, values)}
          onSubmit={async (values, { setSubmitting, setFieldError }) => {
            setSubmitting(true);

            try {
              // LOGIN
              const loginRes = await apiClient.post("/login/", {
                username: values.username,
                password: values.password,
              });

              const access = loginRes.data.access;

              dispatch(setAccessToken(access));

              // FETCH PROFILE
              const meRes = await apiClient.get("/me/");
              const userDto = meRes.data;

              const profile = mapServerUserToMemberProfile(userDto);

              let role: UserRole = "member";

              dispatch(setLoggedIn({ role, profile }));

              toast.success("Logged in successfully!");

              onOpenChange(false);

              // Continue booking flow: use caller's callback or fall back to nextStep
              if (onSuccess) {
                onSuccess();
              } else {
                dispatch(nextStep());
              }
            } catch (e: any) {
              if (e?.response?.status === 401) {
                setFieldError("username", "Username or password is invalid");
              } else {
                toast.error("Login failed. Please try again.");
              }
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {({ errors, touched, isSubmitting }) => (
            <Form className="space-y-4 pt-2">
              <div>
                <Label htmlFor="username" mandatory>Username</Label>

                <Field
                  as={Input}
                  id="username"
                  name="username"
                  placeholder="Enter your username"
                  className="mt-3"
                />

                {errors.username && touched.username && (
                  <p className="mt-2 text-xs text-destructive">
                    {errors.username}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="password" mandatory>Password</Label>

                <Field
                  as={Input}
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Enter your password"
                  className="mt-3"
                />

                {errors.password && touched.password && (
                  <p className="mt-2 text-xs text-destructive">
                    {errors.password}
                  </p>
                )}

                <div className="mt-2 text-right">
                  <Link
                    href="/forgot-password"
                    tabIndex={-1}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Signing in..." : "Sign In & Continue"}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                {"Don't have an account? "}
                <Link
                  href="/register"
                  className="font-medium text-primary hover:underline"
                >
                  Register
                </Link>
              </p>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
}