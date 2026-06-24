"use server";

import { z } from "zod";
import { redirect } from "next/navigation";

import { consumeResetToken } from "@/lib/auth/password-reset";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { resolvePostLoginRedirect } from "@/lib/onboarding/post-login-redirect";

const schema = z.object({
  token: z.string().min(1, "Missing reset token."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(128, "Password is too long."),
});

export type ResetPasswordResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Set the new password AND sign the user in, then redirect straight into the
 * onboarding funnel (never back to /login).
 *
 * For a freshly-provisioned investor who clicks the welcome/activation email,
 * the old flow was: set password → "Go to sign in" → re-type credentials →
 * dashboard. That double step is removed: consuming the token now returns the
 * userId, we open a real `hc_session` here (same primitives as `login`), and
 * `resolvePostLoginRedirect` lands them on the platform (`/portfolio`) or their
 * deep link. Onboarding (accreditation → KYC → wallet) is NOT a post-login gate
 * anymore — it lives inside the platform and only gates investing.
 *
 * `redirect()` is called OUTSIDE the validation branch — it throws a
 * NEXT_REDIRECT control-flow signal that must propagate to the client so the
 * browser navigates without a manual sign-in.
 */
export async function resetPassword(
  input: FormData | { token?: unknown; password?: unknown },
): Promise<ResetPasswordResult> {
  const raw = input instanceof FormData
    ? { token: input.get("token"), password: input.get("password") }
    : { token: input.token, password: input.password };

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Invalid input." };
  }

  const { token, password } = parsed.data;
  const result = await consumeResetToken(token, password);

  if (!result.ok) {
    const messages: Record<string, string> = {
      not_found: "This reset link is invalid.",
      expired: "This reset link has expired. Please request a new one.",
      already_used: "This reset link has already been used. Please request a new one.",
      weak_password: "Password must be at least 8 characters.",
    };
    return {
      ok: false,
      error: messages[result.reason] ?? "An unexpected error occurred.",
    };
  }

  // Password set — open a session and route into onboarding. The transaction in
  // consumeResetToken already revoked any stale sessions, so this is the only
  // live session afterwards.
  const { token: sessionToken, expiresAt } = await createSession(result.userId);
  await setSessionCookie(sessionToken, expiresAt);

  // Outside try/catch: redirect throws NEXT_REDIRECT which must propagate.
  redirect(await resolvePostLoginRedirect(result.userId));
}
