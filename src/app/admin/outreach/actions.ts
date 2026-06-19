"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { upsertProspectContact } from "@/lib/hubspot/sync-prospect";
import { draftColdEmail, draftNewsletter } from "@/lib/agents/outreach-writer";
import { assertNoForbiddenWords } from "@/lib/agents/validators";
import { sendTrackedEmail, renderPlainHtml } from "@/lib/email/send";
import { inngest } from "@/lib/inngest/client";
import { OUTREACH_EVENTS } from "@/lib/outreach/events";
import {
  serializeList,
  parseIcpFilters,
  runSourcingForIcp,
} from "@/lib/outreach/icp";
import { isTier } from "@/lib/outreach/tier";

/**
 * Admin Server Actions for the cold-outreach + newsletter console
 * (`/admin/outreach`).
 *
 * Every action is admin-only: Server Actions are a public RPC surface, so
 * `requireAdmin()` is re-asserted at the top of each one (the `/admin` layout
 * guard alone is not sufficient). Mutations validate input with zod, write an
 * `adminAudit` row, and `revalidatePath("/admin/outreach")`.
 *
 * HubSpot sync is always BEST-EFFORT — it must never fail an outreach mutation.
 * The Typeform qualification URL injected into every cold email defaults to the
 * production form when `NEXT_PUBLIC_TYPEFORM_URL` is unset.
 */

const REVALIDATE_PATH = "/admin/outreach";
const TYPEFORM_URL =
  process.env.NEXT_PUBLIC_QUALIFICATION_FORM_URL ??
  process.env.NEXT_PUBLIC_TYPEFORM_URL ??
  `${process.env.NEXT_PUBLIC_APP_URL ?? "https://connect.hearst.app"}/apply`;

/** Records an admin audit row using the canonical field shape. */
async function recordAudit(
  actorWallet: string,
  action: string,
  entityType: string,
  entityId: string,
  before: unknown,
  after: unknown,
): Promise<void> {
  await prisma.adminAudit.create({
    data: {
      actorWallet,
      action,
      entityType,
      entityId,
      diff: JSON.stringify({ before, after }),
      ip: null,
      userAgent: null,
    },
  });
}

// ---------------------------------------------------------------------------
// addProspect — create a single prospect
// ---------------------------------------------------------------------------

const AddProspectInput = z.object({
  email: z.string().trim().email().max(200),
  firstName: z.string().trim().max(120).optional(),
  lastName: z.string().trim().max(120).optional(),
  company: z.string().trim().max(160).optional(),
  title: z.string().trim().max(160).optional(),
});

/** Coerces an optional FormData text field to a trimmed string or undefined. */
function optText(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function addProspect(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const parsed = AddProspectInput.safeParse({
    email: formData.get("email"),
    firstName: optText(formData.get("firstName")),
    lastName: optText(formData.get("lastName")),
    company: optText(formData.get("company")),
    title: optText(formData.get("title")),
  });
  if (!parsed.success) throw new Error("addProspect: invalid input");

  const email = parsed.data.email.toLowerCase();

  const existing = await prisma.outreachProspect.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) throw new Error("A prospect with this email already exists");

  const prospect = await prisma.outreachProspect.create({
    data: {
      email,
      firstName: parsed.data.firstName ?? null,
      lastName: parsed.data.lastName ?? null,
      company: parsed.data.company ?? null,
      title: parsed.data.title ?? null,
      source: "manual",
      createdBy: admin.userId,
    },
  });

  await recordAudit(
    admin.walletAddress ?? admin.userId,
    "outreach.addProspect",
    "OutreachProspect",
    prospect.id,
    null,
    { email },
  );

  // Best-effort HubSpot upsert — never blocks prospect creation.
  try {
    await upsertProspectContact({
      id: prospect.id,
      email: prospect.email,
      firstName: prospect.firstName,
      lastName: prospect.lastName,
      company: prospect.company,
      title: prospect.title,
    });
  } catch {
    /* best-effort */
  }

  revalidatePath(REVALIDATE_PATH);
}

// ---------------------------------------------------------------------------
// importProspects — bulk paste a list of emails
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Parses + normalises a newline/comma separated email blob into a unique set. */
function parseEmailList(raw: string): string[] {
  const seen = new Set<string>();
  for (const token of raw.split(/[\s,;]+/)) {
    const email = token.trim().toLowerCase();
    if (email.length === 0) continue;
    if (!EMAIL_RE.test(email)) continue;
    seen.add(email);
  }
  return [...seen];
}

export async function importProspects(
  formData: FormData,
): Promise<{ added: number; skipped: number }> {
  const admin = await requireAdmin();

  // The form field is named "raw"; support both "raw" and "emails" for
  // back-compat with any direct FormData callers.
  const raw = formData.get("raw") ?? formData.get("emails");
  if (typeof raw !== "string") throw new Error("importProspects: invalid input");

  const candidates = parseEmailList(raw);
  if (candidates.length === 0) {
    revalidatePath(REVALIDATE_PATH);
    return { added: 0, skipped: 0 };
  }

  // Skip emails that already exist — createMany has no portable skipDuplicates
  // on SQLite, so we filter against the DB first.
  const existing = await prisma.outreachProspect.findMany({
    where: { email: { in: candidates } },
    select: { email: true },
  });
  const existingSet = new Set(existing.map((p) => p.email));
  const fresh = candidates.filter((email) => !existingSet.has(email));
  const skipped = candidates.length - fresh.length;

  if (fresh.length === 0) {
    revalidatePath(REVALIDATE_PATH);
    return { added: 0, skipped };
  }

  await prisma.outreachProspect.createMany({
    data: fresh.map((email) => ({
      email,
      source: "import",
      createdBy: admin.userId,
    })),
  });

  await recordAudit(
    admin.walletAddress ?? admin.userId,
    "outreach.importProspects",
    "OutreachProspect",
    "bulk",
    null,
    { imported: fresh.length, skipped },
  );

  // Best-effort HubSpot upsert for each freshly created prospect.
  const created = await prisma.outreachProspect.findMany({
    where: { email: { in: fresh } },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      company: true,
      title: true,
    },
  });
  for (const prospect of created) {
    try {
      await upsertProspectContact(prospect);
    } catch {
      /* best-effort */
    }
  }

  revalidatePath(REVALIDATE_PATH);
  return { added: fresh.length, skipped };
}

// ---------------------------------------------------------------------------
// createCampaign — new draft campaign
// ---------------------------------------------------------------------------

const CreateCampaignInput = z.object({
  name: z.string().trim().min(1).max(160),
  kind: z.enum(["cold", "newsletter"]).default("cold"),
  bodyTemplate: z.string().trim().max(8000).optional(),
  includeTypeform: z.boolean().default(true),
});

export async function createCampaign(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const parsed = CreateCampaignInput.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind") ?? "cold",
    bodyTemplate: optText(formData.get("bodyTemplate")),
    includeTypeform: formData.get("includeTypeform") != null,
  });
  if (!parsed.success) throw new Error("createCampaign: invalid input");

  // Guard the operator-authored brief against forbidden vocabulary before it is
  // ever handed to the drafting agent.
  if (parsed.data.bodyTemplate) {
    assertNoForbiddenWords(parsed.data.bodyTemplate);
  }

  const campaign = await prisma.outreachCampaign.create({
    data: {
      name: parsed.data.name,
      kind: parsed.data.kind,
      status: "draft",
      bodyTemplate: parsed.data.bodyTemplate ?? null,
      includeTypeform: parsed.data.includeTypeform,
      createdBy: admin.userId,
    },
  });

  await recordAudit(
    admin.walletAddress ?? admin.userId,
    "outreach.createCampaign",
    "OutreachCampaign",
    campaign.id,
    null,
    { name: campaign.name, kind: campaign.kind },
  );

  revalidatePath(REVALIDATE_PATH);
  redirect(`${REVALIDATE_PATH}/${campaign.id}`);
}

// ---------------------------------------------------------------------------
// draftCampaignEmails — agent-draft one email per recipient
// ---------------------------------------------------------------------------

const CommaIdList = z
  .string()
  .transform((s) =>
    s
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0),
  )
  .pipe(z.array(z.string().min(1)).min(1));

async function draftCampaignEmails(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const campaignId = formData.get("campaignId");
  if (typeof campaignId !== "string" || campaignId.length === 0) {
    throw new Error("draftCampaignEmails: missing campaignId");
  }

  const idsRaw = formData.get("prospectIds");
  const parsedIds = CommaIdList.safeParse(
    typeof idsRaw === "string" ? idsRaw : "",
  );
  if (!parsedIds.success) {
    throw new Error("draftCampaignEmails: no recipients selected");
  }
  const recipientIds = parsedIds.data;

  const campaign = await prisma.outreachCampaign.findUnique({
    where: { id: campaignId },
    select: { id: true, kind: true, bodyTemplate: true, includeTypeform: true },
  });
  if (!campaign) throw new Error("draftCampaignEmails: campaign not found");

  let drafted = 0;

  if (campaign.kind === "newsletter") {
    // Newsletter path: recipients are existing User ids.
    const users = await prisma.user.findMany({
      where: { id: { in: recipientIds } },
      select: { id: true, email: true },
    });
    for (const user of users) {
      const { subject, body } = await draftNewsletter({
        userId: user.id,
        brief: campaign.bodyTemplate,
      });
      assertNoForbiddenWords(`${subject}\n${body}`);
      await prisma.outreachEmail.create({
        data: {
          campaignId: campaign.id,
          userId: user.id,
          toEmail: user.email,
          subject,
          body,
          status: "draft",
          draftedByAgent: true,
        },
      });
      drafted += 1;
    }
  } else {
    // Cold path: recipients are OutreachProspect ids.
    const prospects = await prisma.outreachProspect.findMany({
      where: { id: { in: recipientIds } },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        company: true,
        title: true,
      },
    });
    for (const prospect of prospects) {
      const { subject, body } = await draftColdEmail({
        prospect,
        brief: campaign.bodyTemplate,
        // The cold-email CTA always links the qualification form (required by
        // the agent input). `includeTypeform` is recorded on the campaign for
        // the audit trail; the canonical URL is always supplied here.
        typeformUrl: TYPEFORM_URL,
      });
      assertNoForbiddenWords(`${subject}\n${body}`);
      await prisma.outreachEmail.create({
        data: {
          campaignId: campaign.id,
          prospectId: prospect.id,
          toEmail: prospect.email,
          subject,
          body,
          status: "draft",
          draftedByAgent: true,
        },
      });
      drafted += 1;
    }
  }

  await recordAudit(
    admin.walletAddress ?? admin.userId,
    "outreach.draftCampaignEmails",
    "OutreachCampaign",
    campaign.id,
    null,
    { drafted, kind: campaign.kind },
  );

  revalidatePath(`${REVALIDATE_PATH}/${campaign.id}`);
}

// ---------------------------------------------------------------------------
// approveEmail / updateEmail — review a draft
// ---------------------------------------------------------------------------

export async function approveEmail(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const emailId = formData.get("emailId");
  if (typeof emailId !== "string" || emailId.length === 0) {
    throw new Error("approveEmail: missing emailId");
  }

  const existing = await prisma.outreachEmail.findUnique({
    where: { id: emailId },
    select: { id: true, status: true, campaignId: true },
  });
  if (!existing) throw new Error("approveEmail: email not found");

  await prisma.outreachEmail.update({
    where: { id: emailId },
    data: { status: "approved", approvedAt: new Date() },
  });

  await recordAudit(
    admin.walletAddress ?? admin.userId,
    "outreach.approveEmail",
    "OutreachEmail",
    emailId,
    { status: existing.status },
    { status: "approved" },
  );

  revalidatePath(`${REVALIDATE_PATH}/${existing.campaignId}`);
}

const UpdateEmailInput = z.object({
  emailId: z.string().min(1),
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(12000),
});

export async function updateEmail(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const parsed = UpdateEmailInput.safeParse({
    emailId: formData.get("emailId"),
    subject: formData.get("subject"),
    body: formData.get("body"),
  });
  if (!parsed.success) throw new Error("updateEmail: invalid input");

  // An edited draft is still operator-facing copy headed to a real recipient —
  // re-run the forbidden-words guard on the human-supplied text.
  assertNoForbiddenWords(`${parsed.data.subject}\n${parsed.data.body}`);

  const existing = await prisma.outreachEmail.findUnique({
    where: { id: parsed.data.emailId },
    select: { id: true, status: true, subject: true, campaignId: true },
  });
  if (!existing) throw new Error("updateEmail: email not found");
  if (existing.status !== "draft") {
    throw new Error("updateEmail: only draft emails can be edited");
  }

  await prisma.outreachEmail.update({
    where: { id: parsed.data.emailId },
    data: { subject: parsed.data.subject, body: parsed.data.body },
  });

  await recordAudit(
    admin.walletAddress ?? admin.userId,
    "outreach.updateEmail",
    "OutreachEmail",
    parsed.data.emailId,
    { subject: existing.subject },
    { subject: parsed.data.subject },
  );

  revalidatePath(`${REVALIDATE_PATH}/${existing.campaignId}`);
}

// ---------------------------------------------------------------------------
// sendCampaign — flip to sending + emit the Inngest fan-out event
// ---------------------------------------------------------------------------

export async function sendCampaign(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const campaignId = formData.get("campaignId");
  if (typeof campaignId !== "string" || campaignId.length === 0) {
    throw new Error("sendCampaign: missing campaignId");
  }

  const existing = await prisma.outreachCampaign.findUnique({
    where: { id: campaignId },
    select: { id: true, status: true },
  });
  if (!existing) throw new Error("sendCampaign: campaign not found");

  const requestedBy = admin.walletAddress ?? admin.userId;

  await prisma.outreachCampaign.update({
    where: { id: campaignId },
    data: { status: "sending" },
  });

  await recordAudit(
    requestedBy,
    "outreach.sendCampaign",
    "OutreachCampaign",
    campaignId,
    { status: existing.status },
    { status: "sending" },
  );

  // Hand the actual per-recipient delivery to Inngest (the function fans out
  // over the campaign's approved emails).
  await inngest.send({
    name: OUTREACH_EVENTS.CAMPAIGN_SEND,
    data: { campaignId, requestedBy },
  });

  revalidatePath(`${REVALIDATE_PATH}/${campaignId}`);
}

// ---------------------------------------------------------------------------
// draftAllCampaignEmails — draft for ALL un-drafted recipients (button CTA)
// ---------------------------------------------------------------------------

/**
 * Convenience action called by DraftCampaignButton — selects every prospect
 * (cold) or user (newsletter) that does not yet have a draft for this campaign,
 * then delegates to the same drafting logic. Returns the number of emails
 * drafted so the caller can display a toast.
 */
export async function draftAllCampaignEmails(
  campaignId: string,
): Promise<{ drafted: number }> {
  const admin = await requireAdmin();

  if (!campaignId || campaignId.length === 0) {
    throw new Error("draftAllCampaignEmails: missing campaignId");
  }

  const campaign = await prisma.outreachCampaign.findUnique({
    where: { id: campaignId },
    select: { id: true, kind: true, bodyTemplate: true, includeTypeform: true },
  });
  if (!campaign) throw new Error("draftAllCampaignEmails: campaign not found");

  // Exclude recipients that already have a draft to avoid duplicates.
  const existingEmails = await prisma.outreachEmail.findMany({
    where: { campaignId },
    select: { prospectId: true, userId: true },
  });
  const draftedProspectIds = new Set(
    existingEmails
      .map((e) => e.prospectId)
      .filter((id): id is string => id !== null),
  );
  const draftedUserIds = new Set(
    existingEmails
      .map((e) => e.userId)
      .filter((id): id is string => id !== null),
  );

  let drafted = 0;

  if (campaign.kind === "newsletter") {
    const users = await prisma.user.findMany({
      where: { id: { notIn: [...draftedUserIds] } },
      select: { id: true, email: true },
    });
    for (const user of users) {
      const { subject, body } = await draftNewsletter({
        userId: user.id,
        brief: campaign.bodyTemplate,
      });
      assertNoForbiddenWords(`${subject}\n${body}`);
      await prisma.outreachEmail.create({
        data: {
          campaignId: campaign.id,
          userId: user.id,
          toEmail: user.email,
          subject,
          body,
          status: "draft",
          draftedByAgent: true,
        },
      });
      drafted += 1;
    }
  } else {
    const prospects = await prisma.outreachProspect.findMany({
      where: { id: { notIn: [...draftedProspectIds] } },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        company: true,
        title: true,
      },
    });
    for (const prospect of prospects) {
      const { subject, body } = await draftColdEmail({
        prospect,
        brief: campaign.bodyTemplate,
        typeformUrl: TYPEFORM_URL,
      });
      assertNoForbiddenWords(`${subject}\n${body}`);
      await prisma.outreachEmail.create({
        data: {
          campaignId: campaign.id,
          prospectId: prospect.id,
          toEmail: prospect.email,
          subject,
          body,
          status: "draft",
          draftedByAgent: true,
        },
      });
      drafted += 1;
    }
  }

  await recordAudit(
    admin.walletAddress ?? admin.userId,
    "outreach.draftAllCampaignEmails",
    "OutreachCampaign",
    campaign.id,
    null,
    { drafted, kind: campaign.kind },
  );

  revalidatePath(`${REVALIDATE_PATH}/${campaign.id}`);
  return { drafted };
}

// ---------------------------------------------------------------------------
// convertProspect — mark a prospect as converted
// ---------------------------------------------------------------------------

async function convertProspect(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const prospectId = formData.get("prospectId");
  if (typeof prospectId !== "string" || prospectId.length === 0) {
    throw new Error("convertProspect: missing prospectId");
  }

  const existing = await prisma.outreachProspect.findUnique({
    where: { id: prospectId },
    select: { id: true, status: true },
  });
  if (!existing) throw new Error("convertProspect: prospect not found");

  // We only flip the prospect status here. Actual account provisioning reuses
  // createInvestorFromWebhook() in the onboarding flow — not duplicated here.
  await prisma.outreachProspect.update({
    where: { id: prospectId },
    data: { status: "converted" },
  });

  await recordAudit(
    admin.walletAddress ?? admin.userId,
    "outreach.convertProspect",
    "OutreachProspect",
    prospectId,
    { status: existing.status },
    { status: "converted" },
  );

  revalidatePath(REVALIDATE_PATH);
}

// ---------------------------------------------------------------------------
// Direct one-off send — compose + send a single email independently of any
// campaign. The email is still recorded as an OutreachEmail (under a reusable
// "Direct sends" campaign) so it shows up in tracking + stats like the rest.
// ---------------------------------------------------------------------------

const DIRECT_CAMPAIGN_NAME = "Direct sends" as const;

/** Returns the id of the shared "Direct sends" campaign, creating it once. */
async function getDirectCampaignId(createdBy: string): Promise<string> {
  const existing = await prisma.outreachCampaign.findFirst({
    where: { name: DIRECT_CAMPAIGN_NAME, kind: "direct" },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.outreachCampaign.create({
    data: {
      name: DIRECT_CAMPAIGN_NAME,
      kind: "direct",
      status: "sent",
      includeTypeform: false,
      createdBy,
    },
    select: { id: true },
  });
  return created.id;
}

const DirectDraftInput = z.object({
  to: z.string().trim().email().max(200),
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  company: z.string().trim().max(160).optional(),
  brief: z.string().trim().max(2000).optional(),
});

/**
 * Drafts a one-off email with the agent (cold-email persona, Typeform CTA),
 * WITHOUT sending. Returns { subject, body } for the operator to edit + send.
 */
export async function draftDirectEmail(
  formData: FormData,
): Promise<{ subject: string; body: string }> {
  await requireAdmin();

  const parsed = DirectDraftInput.safeParse({
    to: formData.get("to"),
    firstName: optText(formData.get("firstName")),
    lastName: optText(formData.get("lastName")),
    company: optText(formData.get("company")),
    brief: optText(formData.get("brief")),
  });
  if (!parsed.success) throw new Error("draftDirectEmail: invalid input");

  const { subject, body } = await draftColdEmail({
    prospect: {
      email: parsed.data.to,
      firstName: parsed.data.firstName ?? null,
      lastName: parsed.data.lastName ?? null,
      company: parsed.data.company ?? null,
    },
    brief: parsed.data.brief ?? null,
    typeformUrl: TYPEFORM_URL,
  });
  assertNoForbiddenWords(`${subject}\n${body}`);
  return { subject, body };
}

const DirectSendInput = z.object({
  to: z.string().trim().email().max(200),
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(20000),
});

export interface DirectSendResult {
  ok: boolean;
  resendEmailId?: string;
  error?: string;
}

/**
 * Sends a single email immediately (no campaign fan-out, no approval gate).
 * The body is forbidden-words checked, sent via Resend with tracking tags, and
 * recorded as an OutreachEmail under the shared "Direct sends" campaign so it
 * appears in stats and receives Resend webhook events like everything else.
 */
export async function sendDirectEmail(
  formData: FormData,
): Promise<DirectSendResult> {
  const admin = await requireAdmin();

  const parsed = DirectSendInput.safeParse({
    to: formData.get("to"),
    subject: formData.get("subject"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input — check recipient, subject, body." };
  }

  try {
    assertNoForbiddenWords(`${parsed.data.subject}\n${parsed.data.body}`);
  } catch {
    return {
      ok: false,
      error: "Blocked: contains a forbidden word (guarantee/promise/risk-free…).",
    };
  }

  const toEmail = parsed.data.to.toLowerCase();
  const createdBy = admin.walletAddress ?? admin.userId;
  const campaignId = await getDirectCampaignId(createdBy);

  // Record the email first (status sent), then dispatch.
  const email = await prisma.outreachEmail.create({
    data: {
      campaignId,
      toEmail,
      subject: parsed.data.subject,
      body: parsed.data.body,
      status: "sent",
      draftedByAgent: false,
      sentAt: new Date(),
    },
    select: { id: true },
  });

  let resendEmailId: string | undefined;
  try {
    const sent = await sendTrackedEmail({
      to: toEmail,
      subject: parsed.data.subject,
      html: renderPlainHtml(parsed.data.body),
      tags: { campaignId, emailId: email.id },
    });
    resendEmailId = sent.id;
    await prisma.outreachEmail.update({
      where: { id: email.id },
      data: { resendEmailId: sent.id },
    });
  } catch (err) {
    await prisma.outreachEmail.update({
      where: { id: email.id },
      data: { status: "failed" },
    });
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Send failed",
    };
  }

  await recordAudit(
    createdBy,
    "outreach.sendDirectEmail",
    "OutreachEmail",
    email.id,
    null,
    { to: toEmail, subject: parsed.data.subject },
  );

  revalidatePath(REVALIDATE_PATH);
  return { ok: true, resendEmailId };
}

// ===========================================================================
// LEAD-GEN ENGINE — ICP definition, sourcing, tier control
//
// These power the agentic prospecting surface on /admin/outreach. Sourcing is
// currently MOCK (no Apollo credit spent — see src/lib/outreach/icp.ts); the
// Palier-1 Apollo pipeline plugs into runSourcingForIcp without changing these
// actions. Nothing here sends an email — sourced leads land as `new` prospects
// for review, tiered by the scorer.
// ===========================================================================

const CreateIcpInput = z.object({
  name: z.string().trim().min(1).max(160),
  persona: z.enum(["distributor", "subscriber", "treasury"]).default("distributor"),
  titles: z.string().trim().max(2000).optional(),
  locations: z.string().trim().max(2000).optional(),
  industries: z.string().trim().max(2000).optional(),
  language: z.enum(["en", "fr"]).default("en"),
});

/** Splits a comma/newline separated free-text field into a trimmed string[]. */
function splitFreeText(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Creates an Ideal Customer Profile — the persona definition the sourcer queries
 * Apollo with. Tier thresholds default to the agreed 85/60/40 model. Returns the
 * new ICP id so the caller can immediately trigger sourcing.
 */
export async function createIcp(formData: FormData): Promise<{ id: string }> {
  const admin = await requireAdmin();

  const parsed = CreateIcpInput.safeParse({
    name: formData.get("name"),
    persona: formData.get("persona") ?? "distributor",
    titles: optText(formData.get("titles")),
    locations: optText(formData.get("locations")),
    industries: optText(formData.get("industries")),
    language: formData.get("language") ?? "en",
  });
  if (!parsed.success) throw new Error("createIcp: invalid input");

  const icp = await prisma.outreachICP.create({
    data: {
      name: parsed.data.name,
      persona: parsed.data.persona,
      titles: serializeList(splitFreeText(parsed.data.titles)),
      locations: serializeList(splitFreeText(parsed.data.locations)),
      industries: serializeList(splitFreeText(parsed.data.industries)),
      language: parsed.data.language,
      createdBy: admin.userId,
    },
    select: { id: true },
  });

  await recordAudit(
    admin.walletAddress ?? admin.userId,
    "outreach.createIcp",
    "OutreachICP",
    icp.id,
    null,
    { name: parsed.data.name, persona: parsed.data.persona },
  );

  revalidatePath(REVALIDATE_PATH);
  return { id: icp.id };
}

export interface RunSourcingActionResult {
  sourced: number;
  skipped: number;
  isMock: boolean;
  byTier: { A: number; B: number; C: number };
  /** Number of enrich calls that failed (quota / key issues). */
  enrichFailed: number;
  /** Candidates skipped pre-enrich because their apolloId was already in DB. */
  dedupSkipped: number;
}

/**
 * Runs the sourcer for an ICP: finds candidates, scores them, assigns a tier,
 * dedupes against existing prospects + the suppression list, and persists the
 * survivors as `new` prospects (source `apollo`). MOCK today (no credit spent).
 * Never sends — sourced leads await drafting/review.
 */
export async function runSourcing(
  icpId: string,
  count = 12,
): Promise<RunSourcingActionResult> {
  const admin = await requireAdmin();
  if (!icpId) throw new Error("runSourcing: missing icpId");

  // P1-2: Refuse to run in production without a real Apollo key. The mock
  // generates *.example addresses that would pollute the prod prospect table.
  if (process.env.NODE_ENV === "production" && !process.env.APOLLO_API_KEY) {
    throw new Error(
      "runSourcing: APOLLO_API_KEY required in production — refusing to source mock leads",
    );
  }

  const icp = await prisma.outreachICP.findUnique({ where: { id: icpId } });
  if (!icp) throw new Error("runSourcing: ICP not found");

  const filters = parseIcpFilters(icp);

  // P1-1: Pre-enrich dedup hook — look up which apolloIds are already in DB
  // BEFORE the credit-consuming enrich call happens.
  const alreadyKnownApolloIds = async (ids: string[]): Promise<Set<string>> => {
    const found = await prisma.outreachProspect.findMany({
      where: { apolloId: { in: ids } },
      select: { apolloId: true },
    });
    return new Set(found.map((r) => r.apolloId).filter((id): id is string => id !== null));
  };

  const { candidates, isMock, stats } = await runSourcingForIcp(
    icp.name,
    filters,
    { tierAMin: icp.tierAMin, tierBMin: icp.tierBMin, tierCMin: icp.tierCMin },
    Math.min(Math.max(count, 1), 50),
    { alreadyKnownApolloIds },
  );

  const emails = candidates.map((c) => c.email.toLowerCase());

  // Dedupe: skip emails already in the directory or on the suppression list.
  // (This second pass catches email collisions and suppression-list entries —
  // the apolloId dedup above already handled re-runs of known leads.)
  const [existing, suppressed] = await Promise.all([
    prisma.outreachProspect.findMany({
      where: { email: { in: emails } },
      select: { email: true },
    }),
    prisma.outreachSuppression.findMany({
      where: { email: { in: emails } },
      select: { email: true },
    }),
  ]);
  const blocked = new Set([
    ...existing.map((e) => e.email),
    ...suppressed.map((s) => s.email ?? ""),
  ]);

  const fresh = candidates.filter((c) => !blocked.has(c.email.toLowerCase()));
  const byTier = { A: 0, B: 0, C: 0 };

  for (const c of fresh) {
    await prisma.outreachProspect.create({
      data: {
        email: c.email.toLowerCase(),
        firstName: c.firstName,
        lastName: c.lastName,
        company: c.company,
        title: c.title,
        source: "apollo",
        apolloId: c.apolloId,
        qualScore: c.qualScore,
        tier: c.tier,
        icpId: icp.id,
        createdBy: admin.userId,
      },
    });
    if (c.tier) byTier[c.tier] += 1;
  }

  await recordAudit(
    admin.walletAddress ?? admin.userId,
    "outreach.runSourcing",
    "OutreachICP",
    icp.id,
    null,
    {
      sourced: fresh.length,
      isMock,
      byTier,
      enrichFailed: stats.enrichFailed,
      dedupSkipped: stats.dedupSkipped,
    },
  );

  revalidatePath(REVALIDATE_PATH);
  return {
    sourced: fresh.length,
    skipped: candidates.length - fresh.length,
    isMock,
    byTier,
    enrichFailed: stats.enrichFailed,
    dedupSkipped: stats.dedupSkipped,
  };
}

/**
 * Manually overrides a prospect's tier (operator judgement beats the score).
 * e.g. bump a promising Cold lead to Prime so the agent never auto-sends it.
 */
export async function overrideTier(
  prospectId: string,
  tier: string,
): Promise<void> {
  const admin = await requireAdmin();
  if (!prospectId) throw new Error("overrideTier: missing prospectId");
  if (!isTier(tier)) throw new Error("overrideTier: invalid tier");

  const existing = await prisma.outreachProspect.findUnique({
    where: { id: prospectId },
    select: { id: true, tier: true },
  });
  if (!existing) throw new Error("overrideTier: prospect not found");

  await prisma.outreachProspect.update({
    where: { id: prospectId },
    data: { tier },
  });

  await recordAudit(
    admin.walletAddress ?? admin.userId,
    "outreach.overrideTier",
    "OutreachProspect",
    prospectId,
    { tier: existing.tier },
    { tier },
  );

  revalidatePath(REVALIDATE_PATH);
}
