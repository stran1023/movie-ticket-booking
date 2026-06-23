import apiClient from "@/lib/api/client";

/**
 * Activate a newly registered account.
 * Called automatically on the /verify-email page after the user clicks
 * the link sent to their email.
 */
export async function verifyEmail(uid: string, token: string): Promise<void> {
  await apiClient.post("/verify-email/", { uid, token });
}

/**
 * Request a password-reset email.
 * The backend ALWAYS returns 200 regardless of whether the email exists
 * (enumeration protection), so callers should treat both success and
 * most errors the same way: show a generic confirmation message.
 */
export async function forgotPassword(email: string): Promise<void> {
  await apiClient.post("/forgot-password/", { email });
}

/**
 * Confirm a password reset using the uid/token from the email link and
 * set the new password.
 *
 * On validation failure the backend returns:
 *   { new_password: string[] }  — Django password-validator messages
 *   { detail: string }          — invalid / expired token
 */
export async function resetPassword(
  uid: string,
  token: string,
  new_password: string,
): Promise<void> {
  await apiClient.post("/reset-password-confirm/", { uid, token, new_password });
}
