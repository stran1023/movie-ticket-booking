"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Film, Eye, EyeOff } from "lucide-react";
import { Formik, Form, Field } from "formik";
import { registerSchema, validateWithZod } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AddressPicker } from "@/components/address-picker";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const API = (process.env.NEXT_PUBLIC_API_BASE ?? "").trim();

/**
 * Apply backend validation errors to Formik fields.
 * - Supports DRF-style error payload: { field: ["msg1", "msg2"], non_field_errors: [...] }
 * - Maps backend snake_case keys to frontend camelCase fields.
 */
async function applyServerErrors(
  res: Response,
  setFieldError: (name: string, msg: string) => void,
) {
  try {
    const data = await res.json();

    if (typeof data === "object" && data) {
      let hasFieldError = false;

      const map: Record<string, string> = {
        username: "username",
        password: "password",
        confirm_password: "confirmPassword",
        full_name: "fullName",
        date_of_birth: "dateOfBirth",
        gender: "gender",
        email: "email",
        identity_card: "identityCard",
        phone_number: "phoneNumber",
        province: "province",
        ward: "ward",
        street_address: "streetAddress",
      };

      for (const [k, v] of Object.entries<any>(data)) {
        const messages = Array.isArray(v) ? v.join(" ") : String(v);

        if (k === "non_field_errors" || k === "detail") {
          setFieldError("username", messages);
        } else {
          hasFieldError = true;
          const target = map[k] ?? k;
          setFieldError(target, messages);
        }
      }

      if (!hasFieldError && (data.detail || data.non_field_errors)) {
        toast.error(String(data.detail || data.non_field_errors));
      }
    } else {
      setFieldError("username", "Registration failed.");
    }
  } catch {
    setFieldError("username", "Registration failed (invalid response).");
  }
}

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [provinceCode, setProvinceCode] = useState<number | undefined>(
    undefined,
  );
  const [wardCode, setWardCode] = useState<number | undefined>(undefined);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Keep returnUrl so after register -> login -> redirect back to booking flow
  const returnUrl = searchParams.get("returnUrl");

  const loginRedirectUrl = returnUrl
    ? `/login?returnUrl=${encodeURIComponent(returnUrl)}`
    : "/login";

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <Film className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-4 text-2xl font-bold text-foreground">
            Create Account
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Join CineBook and start booking movies
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <Formik
            initialValues={{
              username: "",
              password: "",
              confirmPassword: "",
              fullName: "",
              dateOfBirth: "",
              gender: "other" as "male" | "female" | "other",
              email: "",
              identityCard: "",
              phoneNumber: "",
              province: "",
              ward: "",
              streetAddress: "",
            }}
            validate={(values) => validateWithZod(registerSchema, values)}
            onSubmit={async (values, { setSubmitting, setFieldError }) => {
              setSubmitting(true);
              try {
                const url = `${API}/api/register/`;
                const payload = {
                  username: values.username,
                  password: values.password,
                  confirm_password: values.confirmPassword,
                  full_name: values.fullName,
                  date_of_birth: values.dateOfBirth ? values.dateOfBirth : null,
                  gender: values.gender,
                  email: values.email,
                  identity_card: values.identityCard,
                  phone_number: values.phoneNumber,
                  province: values.province || "",
                  ward: values.ward || "",
                  street_address: values.streetAddress || "",
                };

                const res = await fetch(url, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                });

                if (!res.ok) {
                  await applyServerErrors(res, setFieldError);
                  return;
                }

                toast.success("Account created successfully! Please login.");
                router.push(loginRedirectUrl);
              } catch {
                setFieldError("username", "Network error. Please try again.");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {({ errors, touched, isSubmitting, setFieldValue, values }) => (
              <Form className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label htmlFor="username" mandatory>
                      Username
                    </Label>
                    <Field
                      as={Input}
                      id="username"
                      name="username"
                      placeholder="Choose a username"
                      className="mt-2"
                    />
                    {errors.username && touched.username && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.username}
                      </p>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <Label htmlFor="password" mandatory>
                      Password
                    </Label>

                    <p
                      id="password-help"
                      className="mt-1 text-xs text-muted-foreground"
                    >
                      Your password can't be too similar to your personal
                      information, must be at least 8 characters, can't be a
                      commonly used password, and can't be entirely numeric.
                    </p>

                    <div className="relative mt-2">
                      <Field
                        as={Input}
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Min 6 characters"
                        className="pr-10"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {errors.password && touched.password && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.password}
                      </p>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <Label htmlFor="confirmPassword" mandatory>
                      Confirm Password
                    </Label>
                    <div className="relative mt-2">
                      <Field
                        as={Input}
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Re-enter password"
                        className="pr-10"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowConfirmPassword((s) => !s)}
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                        aria-label={
                          showConfirmPassword
                            ? "Hide password"
                            : "Show password"
                        }
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {errors.confirmPassword && touched.confirmPassword && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.confirmPassword}
                      </p>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <Label htmlFor="fullName" mandatory>
                      Full Name
                    </Label>
                    <Field
                      as={Input}
                      id="fullName"
                      name="fullName"
                      placeholder="Your full name"
                      className="mt-2"
                    />
                    {errors.fullName && touched.fullName && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.fullName}
                      </p>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <Label htmlFor="dateOfBirth">Date of Birth</Label>
                    <Field
                      as={Input}
                      id="dateOfBirth"
                      name="dateOfBirth"
                      type="date"
                      className="mt-2"
                    />
                    {errors.dateOfBirth && touched.dateOfBirth && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.dateOfBirth}
                      </p>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <Label htmlFor="gender" mandatory>
                      Gender
                    </Label>
                    <div className="mt-2">
                      <Select
                        value={values.gender}
                        onValueChange={(v) => setFieldValue("gender", v)}
                      >
                        <SelectTrigger id="gender" className="w-full">
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {errors.gender && touched.gender && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.gender}
                      </p>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <Label htmlFor="email" mandatory>
                      Email
                    </Label>
                    <Field
                      as={Input}
                      id="email"
                      name="email"
                      type="email"
                      placeholder="your@email.com"
                      className="mt-2"
                    />
                    {errors.email && touched.email && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.email}
                      </p>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <Label htmlFor="phoneNumber" mandatory>
                      Phone
                    </Label>
                    <Field
                      as={Input}
                      id="phoneNumber"
                      name="phoneNumber"
                      placeholder="0912345678"
                      className="mt-2"
                    />
                    {errors.phoneNumber && touched.phoneNumber && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.phoneNumber}
                      </p>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <Label htmlFor="identityCard" mandatory>
                      Identity Card
                    </Label>
                    <Field
                      as={Input}
                      id="identityCard"
                      name="identityCard"
                      placeholder="079095001234"
                      className="mt-2"
                    />
                    {errors.identityCard && touched.identityCard && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.identityCard}
                      </p>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <div className="mt-1 flex flex-col gap-3">
                      <AddressPicker
                        provinceCode={provinceCode}
                        wardCode={wardCode}
                        onProvinceChange={(code, name) => {
                          setProvinceCode(code);
                          setFieldValue("province", name);
                          setWardCode(undefined);
                          setFieldValue("ward", "");
                        }}
                        onWardChange={(code, name) => {
                          if (code === 0) {
                            setWardCode(undefined);
                            setFieldValue("ward", "");
                          } else {
                            setWardCode(code);
                            setFieldValue("ward", name);
                          }
                        }}
                      />
                      {errors.province && touched.province && (
                        <p className="text-xs text-destructive">
                          {errors.province}
                        </p>
                      )}
                      {errors.ward && touched.ward && (
                        <p className="-mt-2 text-xs text-destructive">
                          {errors.ward}
                        </p>
                      )}
                      <Label>Street Address</Label>
                      <Input
                        name="streetAddress"
                        placeholder="House number, street name…"
                        value={values.streetAddress}
                        onChange={(e) =>
                          setFieldValue("streetAddress", e.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Creating Account..." : "Create Account"}
                </Button>
              </Form>
            )}
          </Formik>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href={
                returnUrl
                  ? `/login?returnUrl=${encodeURIComponent(returnUrl)}`
                  : "/login"
              }
              className="font-medium text-primary hover:underline"
            >
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
