import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z
  .object({
    username: z.string().min(3, "Username must be at least 3 characters"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .refine((v) => !/^\d+$/.test(v), {
        message: "Password can't be entirely numeric",
      }),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    fullName: z.string().min(1, "Full name is required"),
    dateOfBirth: z.string().min(1, "Date of birth is required"),
    gender: z.enum(["male", "female", "other"], {
      errorMap: () => ({ message: "Please select your sex" }),
    }),
    email: z.string().email("Invalid email address"),
    identityCard: z
      .string()
      .min(9, "Identity card must be at least 9 characters"),
    phoneNumber: z
      .string()
      .regex(/^[0-9]{10,11}$/, "Phone number must be 10-11 digits"),
    province: z.string().min(1, "Province is required"),
    ward: z.string().min(1, "Ward is required"),
    streetAddress: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const customerInfoSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z
    .string()
    .regex(/^[0-9]{10,11}$/, "Phone number must be 10-11 digits"),
  identityCard: z
    .string()
    .min(9, "Identity card must be at least 9 characters"),
});

export const memberLookupSchema = z.object({
  searchTerm: z.string().min(1, "Please enter member ID, card, or phone"),
});

export const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const accountProfileSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email address"),
  phoneNumber: z
    .string()
    .regex(/^[0-9]{10,11}$/, "Phone number must be 10-11 digits"),
  gender: z.enum(["male", "female", "other"], {
    errorMap: () => ({ message: "Please select your gender" }),
  }),
  province: z.string().optional(),
  ward: z.string().optional(),
  streetAddress: z.string().optional(),
});

export function validateWithZod<T>(
  schema: z.ZodType<T>,
  values: Record<string, unknown>,
): Record<string, string> {
  const result = schema.safeParse(values);
  if (result.success) return {};

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join(".");
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  }
  return errors;
}
