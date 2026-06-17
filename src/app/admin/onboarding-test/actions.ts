"use server";

import { z } from "zod";
import { after } from "next/server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  createInvestorFromWebhook,
  upsertQualification,
  applyCalibrationToUser,
} from "@/lib/agents/qualification";
import { sendWelcomeEmail } from "@/lib/auth/send-welcome-email";
import { upsertHubSpotContact } from "@/lib/hubspot/sync-qualification";

/**
 * Manual onboarding simulator — reproduces EXACTLY what the Typeform webhook
 * does, but from a hand-filled admin form. Lets you test the full flow end to
 * end (DB user + qualification + calibration + welcome email + HubSpot contact)
 * without wiring a real Typeform submission.
 *
 * Admin-only — Server Actions are a public RPC surface.
 */

const Input = z.object({
  email: z.string().trim().email().max(200),
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(40).optional(),
  website: z.string().trim().max(200).optional(),
  platformType: z.enum(["crypto", "exchange", "wealth", "custody"]).optional(),
  aum: z.enum(["lt_10m", "10_50m", "50_250m", "250m_plus", "unsure"]).optional(),
  fundsUsage: z.enum(["idle", "mix", "earning"]).optional(),
  yieldStatus: z.enum(["live", "in_progress", "not_yet"]).optional(),
  yieldType: z.enum(["low_risk", "balanced", "growth", "unsure"]).optional(),
  vaultSize: z.enum(["100_500k", "500k_1m", "1_5m", "5m_plus", "unsure"]).optional(),
  timeline: z.enum(["asap", "1_3m", "3_6m", "exploring"]).optional(),
  sendEmail: z.boolean().optional(),
  syncHubspot: z.boolean().optional(),
});

export interface OnboardingTestResult {
  ok: boolean;
  userId?: string;
  investorId?: string;
  email?: string;
  created?: boolean; // true if a new user was created, false if email already existed
  calibrated?: boolean;
  emailSent?: boolean;
  hubspotSynced?: boolean;
  hubspotContactId?: string;
  error?: string;
  steps: string[];
}

const opt = (v: FormDataEntryValue | null): string | undefined => {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length > 0 ? s : undefined;
};

export async function simulateTypeformSubmission(
  formData: FormData,
): Promise<OnboardingTestResult> {
  const steps: string[] = [];
  try {
    await requireAdmin();

    const parsed = Input.safeParse({
      email: formData.get("email"),
      firstName: opt(formData.get("firstName")),
      lastName: opt(formData.get("lastName")),
      phone: opt(formData.get("phone")),
      website: opt(formData.get("website")),
      platformType: opt(formData.get("platformType")),
      aum: opt(formData.get("aum")),
      fundsUsage: opt(formData.get("fundsUsage")),
      yieldStatus: opt(formData.get("yieldStatus")),
      yieldType: opt(formData.get("yieldType")),
      vaultSize: opt(formData.get("vaultSize")),
      timeline: opt(formData.get("timeline")),
      sendEmail: formData.get("sendEmail") === "on",
      syncHubspot: formData.get("syncHubspot") === "on",
    });

    if (!parsed.success) {
      return { ok: false, error: "Invalid input — check the email.", steps };
    }
    const input = parsed.data;
    const email = input.email.toLowerCase();

    // 1. Find or auto-create the user (mirrors the webhook).
    let userId: string | null = null;
    let created = false;
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      userId = existing.id;
      steps.push(`User already existed (${email}) → reusing`);
    } else {
      const newUser = await createInvestorFromWebhook(email);
      if (!newUser) {
        return { ok: false, error: "Could not create user", steps };
      }
      userId = newUser.userId;
      created = true;
      steps.push(`✅ Created User + Investor (${email})`);
    }

    // 2. Upsert the qualification profile with the answers.
    const qualification = await upsertQualification({
      userId,
      email,
      source: "manual",
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      phone: input.phone ?? null,
      website: input.website ?? null,
      platformType: input.platformType ?? null,
      aum: input.aum ?? null,
      fundsUsage: input.fundsUsage ?? null,
      yieldStatus: input.yieldStatus ?? null,
      yieldType: input.yieldType ?? null,
      vaultSize: input.vaultSize ?? null,
      timeline: input.timeline ?? null,
    });
    steps.push("✅ Saved QualificationProfile (answers)");

    // 3. Calibrate the agent persona from the answers.
    let calibrated = false;
    try {
      await applyCalibrationToUser(userId);
      calibrated = true;
      steps.push("✅ Calibrated cockpit-chat agent from answers");
    } catch {
      steps.push("⚠️ Calibration skipped (error)");
    }

    // 4. Welcome / activation email (best-effort, non-blocking).
    let emailSent = false;
    if (input.sendEmail) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:4105";
      after(() =>
        sendWelcomeEmail({
          userId: userId!,
          email,
          firstName: input.firstName ?? null,
          appUrl,
        }).catch(() => {}),
      );
      emailSent = true;
      steps.push("✅ Welcome email queued (Resend)");
    }

    // 5. HubSpot contact sync (awaited here so the UI can show the result).
    let hubspotSynced = false;
    let hubspotContactId: string | undefined;
    if (input.syncHubspot) {
      if (!process.env.HUBSPOT_API_KEY) {
        steps.push("⚠️ HubSpot skipped — HUBSPOT_API_KEY not set");
      } else {
        try {
          await upsertHubSpotContact(userId, qualification);
          // Read back the contact id from the sync log for the link.
          const sync = await prisma.hubSpotSync.findFirst({
            where: { userId, kind: "contact_upsert" },
            orderBy: { syncedAt: "desc" },
            select: { hubspotObjectId: true },
          });
          hubspotContactId = sync?.hubspotObjectId ?? undefined;
          hubspotSynced = true;
          steps.push("✅ HubSpot contact upserted");
        } catch (err) {
          steps.push(
            `❌ HubSpot sync failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    return {
      ok: true,
      userId,
      investorId: undefined,
      email,
      created,
      calibrated,
      emailSent,
      hubspotSynced,
      hubspotContactId,
      steps,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      steps,
    };
  }
}
