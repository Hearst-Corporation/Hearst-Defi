import "server-only";

import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { recordAdminAudit } from "@/lib/admin/audit";
import { env } from "@/lib/env";
import { sendTrackedEmail, renderPlainHtml } from "@/lib/email/send";
import { isSuppressed } from "@/lib/outreach/suppression";
import { assertNoForbiddenWords } from "@/lib/agents/validators";
import { draftColdEmail } from "@/lib/agents/outreach-writer";
import { isTier, type Tier } from "@/lib/outreach/tier";
import { decideAutoSend, type Autonomy } from "@/lib/outreach/send-policy";
import { resolveCtaUrl } from "@/lib/outreach/cta-url";

/**
 * Outreach follow-up cadence (Palier 4 — closed loop, the NURTURE/CLOSED tail).
 *
 * Runs daily. For prospects that were contacted but have NOT replied, it sends a
 * timed follow-up and advances `sequenceStep`, then stops:
 *
 *   step 1 (first touch sent) + ≥3 days no reply → send follow-up #1, step→2
 *   step 2 (follow-up #1 sent) + ≥4 days no reply → send follow-up #2, step→3
 *   step 3+ → sequence exhausted, no more sends (stop)
 *
 * A reply (status `replied`/`qualified`/`converted`) or opt-out (`opted_out`)
 * removes the prospect from the cadence — the reply-handler owns those states.
 * Follow-ups require autonomy NURTURE+ (decideAutoSend `follow_up`); below that
 * the function is a no-op. Every send re-checks suppression and the
 * forbidden-words guard, and stamps tier/autonomy at send.
 */

export const OUTREACH_FOLLOWUPS_ID = "outreach-followups" as const;
/** Daily at 09:00 UTC — a civilised follow-up hour, volume bounded by maxPerRun. */
export const OUTREACH_FOLLOWUPS_CRON = "0 9 * * *" as const;

/** Days that must elapse at each step before the next follow-up fires. */
const STEP_DELAY_DAYS: Record<number, number> = { 1: 3, 2: 4 };
/** Last step that still sends; beyond this the sequence is exhausted. */
const MAX_STEP = 2;
/** Safety cap on follow-ups per run (deliverability). */
const MAX_PER_RUN = 100;

export interface OutreachFollowupsStep {
  run<T>(name: string, fn: () => T | Promise<T>): Promise<T>;
}

export interface OutreachFollowupsArgs {
  step: OutreachFollowupsStep;
  now?: Date;
}

/** Whole days between two instants (floored, never negative). */
function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 86_400_000));
}

export async function outreachFollowupsHandler({
  step,
  now = new Date(),
}: OutreachFollowupsArgs): Promise<{
  autonomy: Autonomy;
  due: number;
  sent: number;
  suppressed: number;
  failed: number;
}> {
  const autonomy = env.OUTREACH_AUTONOMY as Autonomy;

  // Follow-ups need NURTURE+ for ANY tier; below that, no-op.
  const nurtureOk =
    decideAutoSend("B", autonomy, "follow_up").autoSend ||
    decideAutoSend("C", autonomy, "follow_up").autoSend;
  if (!nurtureOk) {
    return { autonomy, due: 0, sent: 0, suppressed: 0, failed: 0 };
  }

  // ── 1. Prospects in an active cadence (contacted, no reply, step 1..MAX) ───
  const dueList = await step.run("load-due-followups", async () => {
    const rows = await prisma.outreachProspect.findMany({
      where: {
        status: "contacted",
        sequenceStep: { gte: 1, lte: MAX_STEP },
        lastContactedAt: { not: null },
        tier: { in: ["B", "C"] },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        company: true,
        title: true,
        tier: true,
        sequenceStep: true,
        lastContactedAt: true,
        icpId: true,
      },
      take: MAX_PER_RUN * 3,
    });

    // Keep only those whose step delay has elapsed.
    return rows.filter((r) => {
      const delay = STEP_DELAY_DAYS[r.sequenceStep];
      if (delay == null || !r.lastContactedAt) return false;
      return daysBetween(r.lastContactedAt, now) >= delay;
    });
  });

  const due = dueList.slice(0, MAX_PER_RUN);
  if (due.length === 0) {
    return { autonomy, due: 0, sent: 0, suppressed: 0, failed: 0 };
  }

  // ── 2. Resolve ICP language/persona for the due set (one grouped query) ───
  const icpIds = [
    ...new Set(due.map((p) => p.icpId).filter((id): id is string => id !== null)),
  ];
  const icpRows = icpIds.length
    ? await prisma.outreachICP.findMany({
        where: { id: { in: icpIds } },
        select: { id: true, persona: true, language: true },
      })
    : [];
  const icpMap = new Map(icpRows.map((r) => [r.id, r]));

  // Reusable "direct sends" style campaign so follow-ups appear in tracking.
  const campaignId = await step.run("ensure-followup-campaign", async () => {
    const existing = await prisma.outreachCampaign.findFirst({
      where: { name: "Follow-ups", kind: "followup" },
      select: { id: true },
    });
    if (existing) return existing.id;
    const created = await prisma.outreachCampaign.create({
      data: {
        name: "Follow-ups",
        kind: "followup",
        status: "sending",
        includeTypeform: true,
        createdBy: "system:outreach-followups",
      },
      select: { id: true },
    });
    return created.id;
  });

  // ── 3. Draft + send each follow-up ────────────────────────────────────────
  let sent = 0;
  let suppressed = 0;
  let failed = 0;

  for (const p of due) {
    const tierRaw = p.tier;
    if (!isTier(tierRaw)) continue;
    const tier: Tier = tierRaw;
    const nextStep = p.sequenceStep + 1;

    const outcome = await step.run(`followup-${p.id}-step${nextStep}`, async () => {
      if (await isSuppressed(p.email)) {
        // Drop out of cadence — stop chasing a suppressed address.
        await prisma.outreachProspect.update({
          where: { id: p.id },
          data: { status: "opted_out" },
        });
        return "suppressed" as const;
      }

      try {
        const icp = p.icpId ? icpMap.get(p.icpId) : undefined;
        const { subject, body } = await draftColdEmail({
          prospect: {
            email: p.email,
            firstName: p.firstName,
            lastName: p.lastName,
            company: p.company,
            title: p.title,
          },
          brief:
            `This is follow-up #${p.sequenceStep} to a prior unanswered outreach. ` +
            "Be brief, polite, add one new angle of value, no pressure. " +
            "Reference that you reached out before without re-pitching everything.",
          typeformUrl: resolveCtaUrl(),
          audience: icp?.persona === "distributor" ? "distributor" : "subscriber",
          language: icp?.language === "fr" ? "fr" : "en",
        });
        assertNoForbiddenWords(`${subject}\n${body}`);

        const email = await prisma.outreachEmail.create({
          data: {
            campaignId,
            prospectId: p.id,
            toEmail: p.email,
            subject,
            body,
            status: "sent",
            draftedByAgent: true,
            sentAt: now,
            tierAtSend: tier,
            autonomyAtSend: autonomy,
          },
          select: { id: true },
        });

        const result = await sendTrackedEmail({
          to: p.email,
          subject,
          html: renderPlainHtml(body, p.email, {
            url: resolveCtaUrl(),
            label: "Apply for access",
          }),
          tags: { emailId: email.id, followup: String(nextStep) },
        });

        await prisma.$transaction([
          prisma.outreachEmail.update({
            where: { id: email.id },
            data: { resendEmailId: result.id },
          }),
          prisma.outreachProspect.update({
            where: { id: p.id },
            data: { sequenceStep: nextStep, lastContactedAt: now },
          }),
          recordAdminAudit({
            actorWallet: "system:outreach-followups",
            action: "outreach.followup",
            entityType: "OutreachProspect",
            entityId: p.id,
            after: { step: nextStep, tier, autonomy },
          }, prisma),
        ]);
        return "sent" as const;
      } catch (err) {
        logger.error("[outreach-followups] send failed", {
          prospectId: p.id,
          error: err instanceof Error ? err.message : String(err),
        });
        return "failed" as const;
      }
    });

    if (outcome === "sent") sent += 1;
    else if (outcome === "suppressed") suppressed += 1;
    else failed += 1;
  }

  logger.info("[outreach-followups] complete", { autonomy, due: due.length, sent, suppressed, failed });
  return { autonomy, due: due.length, sent, suppressed, failed };
}

export const outreachFollowups = inngest.createFunction(
  {
    id: OUTREACH_FOLLOWUPS_ID,
    concurrency: { limit: 1 },
    triggers: [{ cron: OUTREACH_FOLLOWUPS_CRON }],
  },
  outreachFollowupsHandler,
);
