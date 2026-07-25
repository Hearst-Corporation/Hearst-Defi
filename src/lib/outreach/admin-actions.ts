"use server";

import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { recordAdminAudit } from "@/lib/admin/audit";
import { upsertProspectContact } from "@/lib/hubspot/sync-prospect";
import {
  draftColdEmail,
  draftNewsletter,
  type OutreachAudience,
  type OutreachLanguage,
} from "@/lib/agents/outreach-writer";
import { assertSendCopyCompliant } from "@/lib/outreach/send-compliance";
import { sendTrackedEmail, renderPlainHtml } from "@/lib/email/send";
import { inngest } from "@/lib/inngest/client";
import { OUTREACH_EVENTS } from "@/lib/outreach/events";
import {
  serializeList,
  parseIcpFilters,
  runSourcingForIcp,
} from "@/lib/outreach/icp";
import { isTier } from "@/lib/outreach/tier";
import { isSuppressed } from "@/lib/outreach/suppression";
import { resolveCtaUrl } from "@/lib/outreach/cta-url";

/**
 * Admin server actions for cold-outreach + newsletter (chat tools + legacy RPC).
 *
 * Every action is admin-only: Server Actions are a public RPC surface, so
 * `requireAdmin()` is re-asserted at the top of each one. Mutations validate
 * input with zod and write an `adminAudit` row.
 *
 * HubSpot sync is always BEST-EFFORT — it must never fail an outreach mutation.
 * The qualification-funnel CTA injected into every cold email is resolved by
 * `resolveCtaUrl()` (src/lib/outreach/cta-url.ts) — it defaults to the in-app
 * `/apply` route on NEXT_PUBLIC_APP_URL, so a local override retargets it away
 * from the production host. Despite the legacy `typeformUrl` field name, this is
 * the app's own funnel, not a Typeform.
 */

// recordAudit removed — now using shared recordAdminAudit from @/lib/admin/audit

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

  await recordAdminAudit({
    actorWallet: admin.walletAddress ?? admin.userId,
    action: "outreach.addProspect",
    entityType: "OutreachProspect",
    entityId: prospect.id,
    before: null,
    after: { email },
  });

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
    return { added: 0, skipped };
  }

  await prisma.outreachProspect.createMany({
    data: fresh.map((email) => ({
      email,
      source: "import",
      createdBy: admin.userId,
    })),
  });

  await recordAdminAudit({
    actorWallet: admin.walletAddress ?? admin.userId,
    action: "outreach.importProspects",
    entityType: "OutreachProspect",
    entityId: "bulk",
    before: null,
    after: { imported: fresh.length, skipped },
  });

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

  // Guard the operator-authored brief against forbidden vocabulary AND a
  // single-point APY before it is ever handed to the drafting agent.
  if (parsed.data.bodyTemplate) {
    assertSendCopyCompliant(parsed.data.bodyTemplate);
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

  await recordAdminAudit({
    actorWallet: admin.walletAddress ?? admin.userId,
    action: "outreach.createCampaign",
    entityType: "OutreachCampaign",
    entityId: campaign.id,
    before: null,
    after: { name: campaign.name, kind: campaign.kind },
  });

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

  await recordAdminAudit({
    actorWallet: admin.walletAddress ?? admin.userId,
    action: "outreach.approveEmail",
    entityType: "OutreachEmail",
    entityId: emailId,
    before: { status: existing.status },
    after: { status: "approved" },
  });

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
  // re-run the send-copy guard (forbidden words + APY-range) on the human text.
  assertSendCopyCompliant(parsed.data.subject, parsed.data.body);

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

  await recordAdminAudit({
    actorWallet: admin.walletAddress ?? admin.userId,
    action: "outreach.updateEmail",
    entityType: "OutreachEmail",
    entityId: parsed.data.emailId,
    before: { subject: existing.subject },
    after: { subject: parsed.data.subject },
  });

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

  // Guard: never flip to "sending" (nor emit the fan-out event) when there are
  // no approved emails. Otherwise the consumer no-ops with `no_approved_emails`
  // but the campaign is left stuck on "sending" forever (state desync). The UI
  // already gates the button on approvedCount>0, so this only bites a direct
  // action call — but Server Actions are a public RPC surface, so re-assert it.
  const approvedCount = await prisma.outreachEmail.count({
    where: { campaignId, status: "approved" },
  });
  if (approvedCount === 0) {
    throw new Error(
      "sendCampaign: no approved emails to send — approve at least one first.",
    );
  }

  await prisma.outreachCampaign.update({
    where: { id: campaignId },
    data: { status: "sending" },
  });

  await recordAdminAudit({
    actorWallet: requestedBy,
    action: "outreach.sendCampaign",
    entityType: "OutreachCampaign",
    entityId: campaignId,
    before: { status: existing.status },
    after: { status: "sending" },
  });

  // Hand the actual per-recipient delivery to Inngest (the function fans out
  // over the campaign's approved emails).
  await inngest.send({
    name: OUTREACH_EVENTS.CAMPAIGN_SEND,
    data: { campaignId, requestedBy },
  });

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
      assertSendCopyCompliant(subject, body);
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
        icpId: true,
      },
    });

    // One grouped ICP query — not one per prospect.
    const icpIds = [...new Set(
      prospects.map((p) => p.icpId).filter((id): id is string => id !== null),
    )];
    const icpRows = icpIds.length > 0
      ? await prisma.outreachICP.findMany({
          where: { id: { in: icpIds } },
          select: { id: true, persona: true, language: true },
        })
      : [];
    const icpMap = new Map(icpRows.map((r) => [r.id, r]));

    for (const prospect of prospects) {
      const icp = prospect.icpId !== null ? icpMap.get(prospect.icpId) : undefined;
      const audience: OutreachAudience =
        icp?.persona === "distributor" ? "distributor" : "subscriber";
      const language: OutreachLanguage =
        icp?.language === "fr" ? "fr" : "en";

      const { subject, body } = await draftColdEmail({
        prospect,
        brief: campaign.bodyTemplate,
        typeformUrl: resolveCtaUrl(),
        audience,
        language,
      });
      assertSendCopyCompliant(subject, body);
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

  await recordAdminAudit({
    actorWallet: admin.walletAddress ?? admin.userId,
    action: "outreach.draftAllCampaignEmails",
    entityType: "OutreachCampaign",
    entityId: campaign.id,
    before: null,
    after: { drafted, kind: campaign.kind },
  });

  return { drafted };
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
    typeformUrl: resolveCtaUrl(),
  });
  assertSendCopyCompliant(subject, body);
  return { subject, body };
}

export interface DraftForProspectResult {
  emailId: string;
  toEmail: string;
  subject: string;
}

/**
 * Drafts a distributor cold email for an existing prospect (by id) and PERSISTS
 * it as a `draftedByAgent` OutreachEmail under the shared "Direct sends"
 * campaign — so the unified-chat `outreach_draft_email` tool produces a draft
 * the auto-send run can later pick up (source → draft → send, all from one
 * chat). NOTHING is sent here; the body is forbidden-words guarded before it is
 * stored. Returns the created draft id for the chat to reference.
 */
export async function draftEmailForProspect(
  prospectId: string,
): Promise<DraftForProspectResult> {
  const admin = await requireAdmin();
  if (!prospectId) throw new Error("draftEmailForProspect: missing prospectId");

  const prospect = await prisma.outreachProspect.findUnique({
    where: { id: prospectId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      company: true,
    },
  });
  if (!prospect) throw new Error("draftEmailForProspect: prospect not found");

  const { subject, body } = await draftColdEmail({
    prospect: {
      email: prospect.email,
      firstName: prospect.firstName,
      lastName: prospect.lastName,
      company: prospect.company,
    },
    typeformUrl: resolveCtaUrl(),
    audience: "distributor",
  });
  // Non-negotiables #5 + #1 — never persist a draft carrying a forbidden claim
  // or a single-point APY.
  assertSendCopyCompliant(subject, body);

  const campaignId = await getDirectCampaignId(admin.userId);
  const email = await prisma.outreachEmail.create({
    data: {
      campaignId,
      prospectId: prospect.id,
      toEmail: prospect.email,
      subject,
      body,
      status: "draft",
      draftedByAgent: true,
    },
    select: { id: true },
  });

  await recordAdminAudit({
    actorWallet: admin.walletAddress ?? admin.userId,
    action: "outreach.draftEmailForProspect",
    entityType: "OutreachEmail",
    entityId: email.id,
    before: null,
    after: { prospectId: prospect.id, toEmail: prospect.email },
  });

  return { emailId: email.id, toEmail: prospect.email, subject };
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
    assertSendCopyCompliant(parsed.data.subject, parsed.data.body);
  } catch {
    return {
      ok: false,
      error:
        "Blocked: contains a forbidden word (guarantee/promise/risk-free…) " +
        'or a single-point APY (write a range like "8-15%", never "11%").',
    };
  }

  const toEmail = parsed.data.to.toLowerCase();

  // Compliance gate: never send to an opted-out / suppressed address, even on a
  // one-off direct send.
  if (await isSuppressed(toEmail)) {
    return {
      ok: false,
      error: "Blocked: this address has unsubscribed / is on the suppression list.",
    };
  }

  const createdBy = admin.walletAddress ?? admin.userId;
  const campaignId = await getDirectCampaignId(createdBy);

  // Record the email in a pre-dispatch state ("approved": validated +
  // suppression-checked, not yet sent), then dispatch, and only stamp "sent" +
  // sentAt AFTER Resend confirms. This mirrors the campaign fan-out ordering
  // (outreach-send.ts) so a crash between create and dispatch can never leave a
  // row falsely marked "sent" — the worst case is an honest "approved" row that
  // never went out, not a phantom send.
  const email = await prisma.outreachEmail.create({
    data: {
      campaignId,
      toEmail,
      subject: parsed.data.subject,
      body: parsed.data.body,
      status: "approved",
      draftedByAgent: false,
    },
    select: { id: true },
  });

  let resendEmailId: string | undefined;
  try {
    const sent = await sendTrackedEmail({
      to: toEmail,
      subject: parsed.data.subject,
      html: renderPlainHtml(parsed.data.body, toEmail, {
        url: resolveCtaUrl(),
        label: "Apply for access",
      }),
      tags: { campaignId, emailId: email.id },
    });
    resendEmailId = sent.id;
    await prisma.outreachEmail.update({
      where: { id: email.id },
      data: { status: "sent", sentAt: new Date(), resendEmailId: sent.id },
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

  await recordAdminAudit({
    actorWallet: createdBy,
    action: "outreach.sendDirectEmail",
    entityType: "OutreachEmail",
    entityId: email.id,
    before: null,
    after: { to: toEmail, subject: parsed.data.subject },
  });

  return { ok: true, resendEmailId };
}

// ===========================================================================
// LEAD-GEN ENGINE — ICP definition, sourcing, tier control
//
// Chat-tool + HITL outreach mutations (no admin UI surface). Sourcing is
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

  await recordAdminAudit({
    actorWallet: admin.walletAddress ?? admin.userId,
    action: "outreach.createIcp",
    entityType: "OutreachICP",
    entityId: icp.id,
    before: null,
    after: { name: parsed.data.name, persona: parsed.data.persona },
  });

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
        linkedinUrl: c.linkedinUrl,
        companyDomain: c.companyDomain,
        industry: c.industry,
        emailStatus: c.emailStatus,
        apolloData: c.apolloData,
        qualScore: c.qualScore,
        tier: c.tier,
        icpId: icp.id,
        createdBy: admin.userId,
      },
    });
    if (c.tier) byTier[c.tier] += 1;
  }

  await recordAdminAudit({
    actorWallet: admin.walletAddress ?? admin.userId,
    action: "outreach.runSourcing",
    entityType: "OutreachICP",
    entityId: icp.id,
    before: null,
    after: {
      sourced: fresh.length,
      isMock,
      byTier,
      enrichFailed: stats.enrichFailed,
      dedupSkipped: stats.dedupSkipped,
    },
  });

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

  await recordAdminAudit({
    actorWallet: admin.walletAddress ?? admin.userId,
    action: "outreach.overrideTier",
    entityType: "OutreachProspect",
    entityId: prospectId,
    before: { tier: existing.tier },
    after: { tier },
  });

}
