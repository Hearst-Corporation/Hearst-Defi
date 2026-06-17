"use server";

import { requireAdmin } from "@/lib/auth/require-admin";
import {
  generateTotpEnrolment,
  confirmTotpEnrolment,
  type TotpEnrolmentPayload,
} from "@/lib/auth/totp";
import { revalidatePath } from "next/cache";

/**
 * Start TOTP enrolment: generates a new secret + QR and returns it to the UI.
 * Nothing is persisted yet — confirmation happens in `confirmEnrolment`.
 */
export async function startEnrolment(): Promise<TotpEnrolmentPayload & { error?: never }> {
  const { userId } = await requireAdmin();
  return generateTotpEnrolment(userId);
}

/**
 * Confirm TOTP enrolment with the first code from the authenticator app.
 * Persists the encrypted secret + totpEnabledAt on success.
 */
export async function confirmEnrolment(
  input: FormData | { secretBase32?: unknown; code?: unknown },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userId } = await requireAdmin();

  const raw = input instanceof FormData
    ? { secretBase32: input.get("secretBase32"), code: input.get("code") }
    : input;

  if (typeof raw.secretBase32 !== "string" || !raw.secretBase32) {
    return { ok: false, error: "Missing secret." };
  }
  if (typeof raw.code !== "string" || !/^\d{6}$/.test(raw.code)) {
    return { ok: false, error: "Enter the 6-digit code from your authenticator app." };
  }

  const result = await confirmTotpEnrolment(userId, raw.secretBase32, raw.code);
  if (result.ok) {
    revalidatePath("/admin/security");
  }
  return result;
}

