"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Film, Eye, EyeOff } from "lucide-react";
import { Formik, Form, Field } from "formik";
import apiClient from "@/lib/api/client";
import {
  type UserRole,
  setLoggedIn,
  setAccessToken,
} from "@/lib/store/slices/authSlice";
import { useAppDispatch } from "@/lib/store/hooks";
import { loginSchema, validateWithZod } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { mapServerUserToMemberProfile } from "@/lib/mappers/user-mapper";

/**
 * Security: only allow internal returnUrl to prevent open redirect.
 */
function getSafeReturnUrl(returnUrl: string | null): string {
  if (!returnUrl) return "/";
  // allow only internal relative paths
  if (returnUrl.startsWith("/")) return returnUrl;
  return "/";
}

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);

  const returnUrl = getSafeReturnUrl(searchParams.get("returnUrl"));

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Film className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-4 text-2xl font-bold text-foreground">
            Welcome Back
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to your CineBook account
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <Formik
            initialValues={{ username: "", password: "" }}
            validate={(values) => validateWithZod(loginSchema, values)}
            onSubmit={async (values, { setSubmitting, setFieldError }) => {
              setSubmitting(true);
              setSubmitting(true);

              try {
                // 1) Login -> get access token
                const loginRes = await apiClient.post("/login/", {
                  username: values.username,
                  password: values.password,
                });

                const access: string | undefined = loginRes?.data?.access;
                if (!access) {
                  setFieldError("username", "Login failed (missing token).");
                  return;
                }

                // Save token in store (assume apiClient interceptor uses it)
                dispatch(setAccessToken(access));

                // 2) Fetch current user profile
                const meRes = await apiClient.get("/me/");
                const userDto = meRes.data;

                const profile = mapServerUserToMemberProfile(userDto);

                let role: UserRole = "member";
                
                dispatch(setLoggedIn({ role, profile }));
                dispatch(setLoggedIn({ role, profile }));

                toast.success("Logged in successfully!");

                /**
                 * IMPORTANT:
                 * Do NOT dispatch booking nextStep() here.
                 * Booking flow should decide step based on state in BookingPage/Step components.
                 */
                router.push(returnUrl);
              } catch (e: any) {
                const status = e?.response?.status;
                const detail = e?.response?.data?.detail;

                // Common cases
                if (status === 401) {
                  setFieldError("username", "Username or password is invalid");
                } else if (status === 423) {
                  // in case backend uses 423 Locked
                  setFieldError(
                    "username",
                    detail ||
                      "Account has been locked. Please contact support.",
                  );
                } else if (typeof detail === "string") {
                  // show server message if exists
                  toast.error(detail);
                } else {
                  toast.error("Login failed");
                  toast.error("Login failed");
                }
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {({ errors, touched, isSubmitting }) => (
              <Form className="space-y-4">
                <div>
                  <Label htmlFor="username" mandatory>Username</Label>
                  <Field
                    as={Input}
                    id="username"
                    name="username"
                    placeholder="Enter your username"
                    className="mt-2"
                  />
                  {errors.username && touched.username && (
                    <p className="mt-2 text-xs text-destructive">
                      {errors.username}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="password" mandatory>Password</Label>
                  <div className="relative mt-1">
                    <Field
                      as={Input}
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      className="pr-10"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
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
                  {isSubmitting ? "Signing in..." : "Sign In"}
                </Button>
              </Form>
            )}
          </Formik>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {"Don't have an account? "}
            <Link
              href={
                returnUrl
                  ? `/register?returnUrl=${encodeURIComponent(returnUrl)}`
                  : "/register"
              }
              className="font-medium text-primary hover:underline"
            >
              Register
            </Link>
          </p>

          <div className="mt-4 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            <p className="font-medium">Demo credentials:</p>
            <p>Use credentials provided by your backend environment</p>
          </div>
        </div>
      </div>
    </div>
  );
}
