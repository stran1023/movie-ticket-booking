"use client";

import { useEffect, useMemo, useState } from "react";
import { Formik, Form, Field } from "formik";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";
import { ChangePasswordDialog } from "@/components/account/change-password-dialog";
import { DeleteAccountDialog } from "@/components/account/delete-account-dialog";
import { AvatarUpload } from "@/components/account/avatar-upload";
import { UserReminders } from "@/components/account/user-reminders";
import {
  getAccountProfile,
  updateAccountProfile,
  type AccountProfile,
} from "@/lib/api/account";
import { AddressPicker } from "@/components/address-picker";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { accountProfileSchema, validateWithZod } from "@/lib/validations";

function formatField(
  value: string | number | null | undefined,
  type?: "date" | "gender" | "string",
): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") return String(value);
  const s = String(value).trim();
  if (!s) return "-";

  if (type === "date") {
    // Input is "YYYY-MM-DD" or ISO date keep it readable
    const iso = s.length > 10 ? s.split("T")[0] : s;
    return iso || "-";
  }
  if (type === "gender") {
    // "male" | "female" | "other" -> "Male" | ...
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  return s;
}

export default function AccountInfoPage() {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Local codes drive the AddressPicker while editing (not sent to backend)
  const [provinceCode, setProvinceCode] = useState<number | undefined>(
    undefined,
  );
  const [wardCode, setWardCode] = useState<number | undefined>(undefined);

  // Fetch profile once (client-side authedFetch is used inside getAccountProfile)
  useEffect(() => {
    let cancelled = false;
    const loadAsync = async () => {
      try {
        const data = await getAccountProfile();
        if (!cancelled) {
          setProfile(data);
          setErrorMessage(null);
        }
      } catch {
        if (!cancelled) setErrorMessage("Failed to load account information.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadAsync();
    return () => {
      cancelled = true;
    };
  }, []);

  const fields = useMemo(
    () => [
      {
        label: "Username",
        key: "username",
        editable: false as const,
        render: (p: AccountProfile) => formatField(p.username),
      },
      {
        label: "Full Name",
        key: "fullName",
        editable: true as const,
        render: (p: AccountProfile) => formatField(p.fullName),
      },
      {
        label: "Email",
        key: "email",
        editable: true as const,
        render: (p: AccountProfile) => formatField(p.email),
      },
      {
        label: "Phone",
        key: "phoneNumber",
        editable: true as const,
        render: (p: AccountProfile) => formatField(p.phoneNumber),
      },
      {
        label: "Date of Birth",
        key: "dateOfBirth",
        editable: false as const,
        render: (p: AccountProfile) => formatField(p.dateOfBirth, "date"),
      },
      {
        label: "Gender",
        key: "gender",
        editable: true as const,
        render: (p: AccountProfile) => formatField(p.gender, "gender"),
      },
      {
        label: "Identity Card",
        key: "identityCard",
        editable: false as const,
        render: (p: AccountProfile) => formatField(p.identityCard),
      },
      {
        label: "Province / City",
        key: "province",
        editable: true as const,
        render: (p: AccountProfile) => formatField(p.province),
      },
      {
        label: "Ward",
        key: "ward",
        editable: true as const,
        render: (p: AccountProfile) => formatField(p.ward),
      },
      {
        label: "Street Address",
        key: "streetAddress",
        editable: true as const,
        render: (p: AccountProfile) => formatField(p.streetAddress),
      },
      {
        label: "Member Since",
        key: "memberSince",
        editable: false as const,
        render: (p: AccountProfile) => formatField(p.memberSince, "date"),
      },
    ],
    [],
  );

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center">
        <p className="text-muted-foreground">Loading account information...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center">
        <p className="text-muted-foreground">
          {errorMessage ?? "No profile data found."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <AvatarUpload />

      <Separator className="my-4" />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Account Information
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            View and manage your personal details
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ChangePasswordDialog />
          {!editing && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                setEditing(true);
                // Reset picker codes to undefined so AddressPicker starts fresh
                // (province/ward names are already in Formik initialValues)
                setProvinceCode(undefined);
                setWardCode(undefined);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          )}
        </div>
      </div>

      <Separator className="my-4" />

      {editing ? (
        <Formik
          initialValues={{
            fullName: profile.fullName ?? "",
            email: profile.email ?? "",
            phoneNumber: profile.phoneNumber ?? "",
            gender: (profile.gender ?? "other") as "male" | "female" | "other",
            province: profile.province ?? "",
            ward: profile.ward ?? "",
            streetAddress: profile.streetAddress ?? "",
          }}
          enableReinitialize
          onSubmit={async (values, { setSubmitting }) => {
            setSubmitting(true);
            try {
              // PATCH only allowed fields
              const updated = await updateAccountProfile(values);
              setProfile(updated);
              setEditing(false);
              toast.success("Profile updated successfully!");
            } catch {
              toast.error("Failed to update profile.");
            } finally {
              setSubmitting(false);
            }
          }}
          validate={(values) => validateWithZod(accountProfileSchema, values)}
        >
          {({ isSubmitting, values, setFieldValue, errors, touched }) => (
            <Form className="space-y-4">
              {/* Full Name */}
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                <Label
                  className="w-32 shrink-0 text-sm text-muted-foreground"
                  mandatory
                >
                  Full Name
                </Label>
                <Field as={Input} name="fullName" className="max-w-md" />
              </div>
              {errors.fullName && touched.fullName && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.fullName}
                </p>
              )}
              {/* Email */}
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                <Label
                  className="w-32 shrink-0 text-sm text-muted-foreground"
                  mandatory
                >
                  Email
                </Label>
                <Field
                  as={Input}
                  name="email"
                  type="email"
                  className="max-w-md"
                />
              </div>
              {errors.email && touched.email && (
                <p className="mt-1 text-xs text-destructive">{errors.email}</p>
              )}
              {/* Phone Number */}
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                <Label
                  className="w-32 shrink-0 text-sm text-muted-foreground"
                  mandatory
                >
                  Phone
                </Label>
                <Field as={Input} name="phoneNumber" className="max-w-md" />
              </div>
              {errors.phoneNumber && touched.phoneNumber && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.phoneNumber}
                </p>
              )}
              {/* Gender */}
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-4">
                <Label
                  className="w-32 shrink-0 pt-2 text-sm text-muted-foreground"
                  mandatory
                >
                  Gender
                </Label>
                <RadioGroup
                  value={values.gender}
                  onValueChange={(v) => setFieldValue("gender", v)}
                  className="flex gap-4 pt-1"
                >
                  {(["male", "female", "other"] as const).map((option) => (
                    <div key={option} className="flex items-center gap-1.5">
                      <RadioGroupItem value={option} id={`gender-${option}`} />
                      <Label
                        htmlFor={`gender-${option}`}
                        className="text-sm font-normal capitalize"
                      >
                        {option}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
              {errors.gender && touched.gender && (
                <p className="mt-1 text-xs text-destructive">{errors.gender}</p>
              )}
              {/* Address — Province + Ward picker then Street */}
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
                <span className="w-32 shrink-0 pt-1 text-sm text-muted-foreground">
                  Address
                </span>
                <div className="flex max-w-md flex-1 flex-col gap-3">
                  <AddressPicker
                    provinceCode={provinceCode}
                    wardCode={wardCode}
                    provinceName={values.province}
                    wardName={values.ward}
                    onProvinceChange={(code, name) => {
                      setProvinceCode(code);
                      setFieldValue("province", name);
                    }}
                    onWardChange={(code, name) => {
                      if (code === 0) {
                        // Emitted by AddressPicker on province reset
                        setWardCode(undefined);
                        setFieldValue("ward", "");
                      } else {
                        setWardCode(code);
                        setFieldValue("ward", name);
                      }
                    }}
                  />
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
              {errors.province && touched.province && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.province}
                </p>
              )}
              {errors.ward && touched.ward && (
                <p className="mt-1 text-xs text-destructive">{errors.ward}</p>
              )}
              {errors.streetAddress && touched.streetAddress && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.streetAddress}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  size="sm"
                  className="gap-2"
                  disabled={isSubmitting}
                >
                  <Save className="h-3.5 w-3.5" />
                  Save Changes
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => setEditing(false)}
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </Button>
              </div>
            </Form>
          )}
        </Formik>
      ) : (
        <div className="space-y-4">
          {fields.map((f) => (
            <div
              key={f.key}
              className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4"
            >
              <span className="w-32 shrink-0 text-sm text-muted-foreground">
                {f.label}
              </span>
              <span className="text-sm font-medium text-foreground">
                {f.render(profile)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Danger Zone */}
      <Separator className="my-6" />
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
        <h3 className="text-sm font-semibold text-destructive">Danger Zone</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Permanently deactivate your account. This action cannot be undone.
        </p>
        <div className="mt-3">
          <DeleteAccountDialog />
        </div>
      </div>
    </div>
  );
}
