"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { upsertProspectContact } from "@/lib/hubspot/sync-prospect";
import { draftColdEmail, draftNewsletter } from "@/lib/agents/outreach-writer";
import { assertNoForbiddenWords } from "@/lib/agents/validators";
import { inngest } from "@/lib/inngest/client";
import { OUTREACH_EVENTS } from "@/lib/outreach/events";

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
  process.env.NEXT_PUBLIC_TYPEFORM_URL ??
  "https://form.typeform.com/to/NXUw7yzJ";

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

export async function draftCampaignEmails(formData: FormData): Promise<void> {
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

export async function convertProspect(formData: FormData): Promise<void> {
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
