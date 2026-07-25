"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { requireAdmin } from "@/lib/auth/require-admin";
import { recordAdminAudit } from "@/lib/admin/audit";
import {
  upsertQualification,
  applyCalibrationToUser,
} from "@/lib/agents/qualification";
import type { QualificationAnswers } from "@/lib/agents/calibration";
import { writeMemoryFacts, setMemoryActive, deleteMemoryFact } from "@/lib/agents/memory";
import { mintActivationToken } from "@/lib/auth/send-welcome-email";

// ---------------------------------------------------------------------------
// Qualification (Typeform answers) — manual edit
// ---------------------------------------------------------------------------

const opt = <const T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.enum(values), z.literal(""), z.null()])
    .optional()
    .transform((v): T[number] | null => (v ? (v as T[number]) : null));

const QualInput = z.object({
  userId: z.string().min(1),
  email: z.string().email().or(z.literal("")).optional(),
  platformType: opt(["crypto", "exchange", "wealth", "custody"]),
  aum: opt(["lt_10m", "10_50m", "50_250m", "250m_plus", "unsure"]),
  fundsUsage: opt(["idle", "mix", "earning"]),
  yieldStatus: opt(["live", "in_progress", "not_yet"]),
  yieldType: opt(["low_risk", "balanced", "growth", "unsure"]),
  vaultSize: opt(["100_500k", "500k_1m", "1_5m", "5m_plus", "unsure"]),
  timeline: opt(["asap", "1_3m", "3_6m", "exploring"]),
});

function revalidate(investorId: string) {
  revalidatePath(`/admin/customers/${investorId}`);
}

async function investorUserId(investorId: string): Promise<string> {
  const row = await prisma.investor.findUnique({
    where: { id: investorId },
    select: { userId: true },
  });
  if (!row) throw new Error("Investor not found");
  return row.userId;
}

async function assertMemoryOwned(userId: string, memoryId: string): Promise<void> {
  const row = await prisma.agentMemory.findUnique({
    where: { id: memoryId },
    select: { userId: true },
  });
  if (!row || row.userId !== userId) throw new Error("Memory not found");
}

/**
 * Manually upsert a customer's qualification answers (admin override of, or
 * substitute for, the Typeform submission), then recalibrate the agent so the
 * persona reflects the edit immediately.
 */
export async function saveQualification(
  investorId: string,
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  const parsed = QualInput.safeParse({
    userId: formData.get("userId"),
    email: formData.get("email") ?? undefined,
    platformType: formData.get("platformType") ?? undefined,
    aum: formData.get("aum") ?? undefined,
    fundsUsage: formData.get("fundsUsage") ?? undefined,
    yieldStatus: formData.get("yieldStatus") ?? undefined,
    yieldType: formData.get("yieldType") ?? undefined,
    vaultSize: formData.get("vaultSize") ?? undefined,
    timeline: formData.get("timeline") ?? undefined,
  });
  if (!parsed.success) throw new Error("Invalid qualification input");

  const { userId, email, ...answers } = parsed.data;
  const qualification: QualificationAnswers = {
    platformType:
      answers.platformType as QualificationAnswers["platformType"],
    aum: answers.aum as QualificationAnswers["aum"],
    fundsUsage: answers.fundsUsage as QualificationAnswers["fundsUsage"],
    yieldStatus: answers.yieldStatus as QualificationAnswers["yieldStatus"],
    yieldType: answers.yieldType as QualificationAnswers["yieldType"],
    vaultSize: answers.vaultSize as QualificationAnswers["vaultSize"],
    timeline: answers.timeline as QualificationAnswers["timeline"],
  };

  await upsertQualification({
    userId,
    email: email && email.length > 0 ? email : null,
    source: "manual",
    ...qualification,
  });

  // Reflect the edit into the live persona right away.
  await applyCalibrationToUser(userId);

  revalidate(investorId);
}

/** Recompute and apply the persona from the stored qualification answers. */
export async function recalibrateAgent(
  investorId: string,
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) throw new Error("Missing userId");
  const result = await applyCalibrationToUser(userId);
  if (result === null) {
    throw new Error("No qualification profile to calibrate from");
  }
  revalidate(investorId);
}

// ---------------------------------------------------------------------------
// Resend / regenerate account activation link
// ---------------------------------------------------------------------------

export type ActivationLinkResult =
  | { ok: true; activationUrl: string }
  | { ok: false; error: string };

/**
 * Recovers the welcome-email dead-end: an auto-created (Typeform/apply) or
 * admin-provisioned investor has an unusable random password and can only get
 * in via the activation link. If the welcome email never arrived (Resend down /
 * key missing / lost), there was no UI to recover — the row existed but the
 * person could never log in.
 *
 * This mints a FRESH 7-day activation token and returns the /reset-password URL
 * for the admin to deliver manually. It does NOT send an email itself, so it is
 * safe regardless of email-provider state.
 */
export async function generateActivationLink(
  investorId: string,
): Promise<ActivationLinkResult> {
  const admin = await requireAdmin();
  if (!investorId) return { ok: false, error: "Missing investor id" };

  const investor = await prisma.investor.findUnique({
    where: { id: investorId },
    select: { userId: true },
  });
  if (!investor) return { ok: false, error: "Investor not found" };

  // Zod canon carries the production-host default — same value as the old
  // inline fallback (raw-env purge 2026-07-26, behaviour unchanged).
  const appUrl = env.NEXT_PUBLIC_APP_URL;
  const { activationUrl } = await mintActivationToken({
    userId: investor.userId,
    appUrl,
  });

  await recordAdminAudit({
    actorWallet: admin.walletAddress ?? admin.userId,
    action: "investor.generateActivationLink",
    entityType: "Investor",
    entityId: investorId,
    before: null,
    after: { activationTokenMinted: true },
  });

  return { ok: true, activationUrl };
}

// ---------------------------------------------------------------------------
// Agent assignment + overrides
// ---------------------------------------------------------------------------

/** Assign (or clear) the AgentTemplate the customer's cockpit-chat inherits. */
export async function assignTemplate(
  investorId: string,
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const rawTemplate = String(formData.get("templateId") ?? "");
  const templateId = rawTemplate.length > 0 ? rawTemplate : null;
  if (!userId) throw new Error("Missing userId");

  await prisma.userAgentProfile.upsert({
    where: { userId_agentName: { userId, agentName: "cockpit-chat" } },
    create: { userId, agentName: "cockpit-chat", templateId },
    update: { templateId },
  });

  revalidate(investorId);
}

// ---------------------------------------------------------------------------
// Memory curation
// ---------------------------------------------------------------------------

const MemoryInput = z.object({
  userId: z.string().min(1),
  content: z.string().trim().min(3).max(280),
  kind: z.enum(["fact", "preference", "goal", "constraint"]).default("fact"),
});

export async function addMemory(
  investorId: string,
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const parsed = MemoryInput.safeParse({
    userId: formData.get("userId"),
    content: formData.get("content"),
    kind: formData.get("kind") ?? "fact",
  });
  if (!parsed.success) throw new Error("Invalid memory input");

  const created = await writeMemoryFacts({
    userId: parsed.data.userId,
    agentName: "cockpit-chat",
    source: "manual",
    facts: [{ content: parsed.data.content, kind: parsed.data.kind }],
  });
  if (created.length === 0) {
    throw new Error("Memory rejected (duplicate or forbidden words)");
  }

  revalidate(investorId);
}

export async function toggleMemory(
  investorId: string,
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) throw new Error("Missing memory id");
  const userId = await investorUserId(investorId);
  await assertMemoryOwned(userId, id);
  await setMemoryActive(id, active);
  revalidate(investorId);
}

export async function removeMemory(
  investorId: string,
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing memory id");
  const userId = await investorUserId(investorId);
  await assertMemoryOwned(userId, id);
  await deleteMemoryFact(id);
  revalidate(investorId);
}
