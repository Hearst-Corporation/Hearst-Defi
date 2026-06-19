"use server";

import { after } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import {
  createInvestorFromWebhook,
  upsertQualification,
  applyCalibrationToUser,
} from "@/lib/agents/qualification";
import { sendWelcomeEmail } from "@/lib/auth/send-welcome-email";
import { upsertHubSpotContact } from "@/lib/hubspot/sync-qualification";
import {
  AUM_VALUES,
  FUNDS_USAGE_VALUES,
  PLATFORM_TYPE_VALUES,
  TIMELINE_VALUES,
  VAULT_SIZE_VALUES,
  YIELD_STATUS_VALUES,
  YIELD_TYPE_VALUES,
} from "@/lib/qualification/options";

const Input = z.object({
  email: z.string().trim().email().max(200),
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(40).optional(),
  platformType: z.enum(PLATFORM_TYPE_VALUES).optional(),
  aum: z.enum(AUM_VALUES).optional(),
  fundsUsage: z.enum(FUNDS_USAGE_VALUES).optional(),
  yieldStatus: z.enum(YIELD_STATUS_VALUES).optional(),
  yieldType: z.enum(YIELD_TYPE_VALUES).optional(),
  vaultSize: z.enum(VAULT_SIZE_VALUES).optional(),
  timeline: z.enum(TIMELINE_VALUES).optional(),
});

export type ApplyResult =
  | { ok: true }
  | { ok: false; error: string; field?: string };

const opt = (v: FormDataEntryValue | null): string | undefined => {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length > 0 ? s : undefined;
};

export async function submitApplication(
  formData: FormData,
): Promise<ApplyResult> {
  const parsed = Input.safeParse({
    email: formData.get("email"),
    firstName: opt(formData.get("firstName")),
    lastName: opt(formData.get("lastName")),
    phone: opt(formData.get("phone")),
    platformType: opt(formData.get("platformType")),
    aum: opt(formData.get("aum")),
    fundsUsage: opt(formData.get("fundsUsage")),
    yieldStatus: opt(formData.get("yieldStatus")),
    yieldType: opt(formData.get("yieldType")),
    vaultSize: opt(formData.get("vaultSize")),
    timeline: opt(formData.get("timeline")),
  });

  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0]?.toString();
    return { ok: false, error: "Invalid input — check the email address.", field };
  }

  const input = parsed.data;
  const email = input.email.toLowerCase();

  // Find or auto-create investor account.
  let userId: string;
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    userId = existing.id;
  } else {
    const newUser = await createInvestorFromWebhook(email);
    if (!newUser) {
      return { ok: false, error: "Could not create account. Please try again." };
    }
    userId = newUser.userId;
  }

  // Upsert qualification answers.
  const qualification = await upsertQualification({
    userId,
    email,
    source: "self",
    firstName: input.firstName ?? null,
    lastName: input.lastName ?? null,
    phone: input.phone ?? null,
    website: null,
    platformType: input.platformType ?? null,
    aum: input.aum ?? null,
    fundsUsage: input.fundsUsage ?? null,
    yieldStatus: input.yieldStatus ?? null,
    yieldType: input.yieldType ?? null,
    vaultSize: input.vaultSize ?? null,
    timeline: input.timeline ?? null,
  });

  // Calibrate agent persona (best-effort).
  try {
    await applyCalibrationToUser(userId);
  } catch { /* non-fatal */ }

  // Send welcome email + HubSpot sync in background (non-blocking).
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://connect.hearst.app";
  after(async () => {
    try {
      await sendWelcomeEmail({
        userId,
        email,
        firstName: input.firstName ?? null,
        appUrl,
      });
    } catch { /* non-fatal */ }

    if (process.env.HUBSPOT_API_KEY) {
      try {
        await upsertHubSpotContact(userId, qualification);
      } catch { /* non-fatal */ }
    }
  });

  return { ok: true };
}
