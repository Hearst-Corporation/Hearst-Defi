import "server-only";

import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { recordAdminAudit } from "@/lib/admin/audit";
import { env } from "@/lib/env";
import { sendTrackedEmail, renderPlainHtml } from "@/lib/email/send";
import { resolveCtaUrl } from "@/lib/outreach/cta-url";
import { logEmailActivity } from "@/lib/hubspot/sync-prospect";
import { isSuppressed } from "@/lib/outreach/suppression";
import { containsForbidden } from "@/lib/agents/forbidden-words";
import { isTier, type Tier } from "@/lib/outreach/tier";
import {
  decideAutoSend,
  remainingDailyBudget,
  compareQueue,
  type Autonomy,
} from "@/lib/outreach/send-policy";

/**
 * Outreach AUTONOMOUS send — the tiered, governed first-touch sender (ADR-016).
 *
 * Runs on a cron. For the current `OUTREACH_AUTONOMY` level it:
 *   1. Computes today's remaining budget (warm-up cap − already auto-sent today).
 *   2. Pulls draft cold emails whose prospect tier is eligible for an auto first
 *      touch (Tier B/C at SEND+; Tier A is NEVER auto-sent — drafted only).
 *   3. Orders them Prime > Warm > Cold (Prime is excluded from auto-send but the
 *      comparator is shared), oldest-contacted first.
 *   4. Sends up to the budget, re-checking suppression at send time, stamping
 *      `tierAtSend` + `autonomyAtSend`, and writing an audit row.
 *
 * SUGGEST (the default) → the budget gate short-circuits and nothing is sent.
 * Every send still carries the unsubscribe link + forbidden-words guard (done in
 * the drafting agent and re-asserted here defensively).
 */

export const OUTREACH_AUTO_SEND_ID = "outreach-auto-send" as const;
/** Hourly — the daily cap + warm-up curve govern volume, not the cron cadence. */
export const OUTREACH_AUTO_SEND_CRON = "0 * * * *" as const;

/** Statuses that count as "an auto email left the building today". */
const SENT_TODAY_STATUSES = ["sent", "delivered", "opened", "clicked"] as const;

export interface OutreachAutoSendStep {
  run<T>(name: string, fn: () => T | Promise<T>): Promise<T>;
}

export interface OutreachAutoSendArgs {
  step: OutreachAutoSendStep;
  /** Injectable "now" for deterministic tests; defaults to a real Date. */
  now?: Date;
}

/** Start-of-UTC-day for `d`, as a Date. */
function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Days since the engine's first-ever auto send (the warm-up clock). Returns 0
 * when there is no prior auto send (day one). Bounded at 0.
 */
function dayIndexSince(firstSentAt: Date | null, now: Date): number {
  if (!firstSentAt) return 0;
  const ms = startOfUtcDay(now).getTime() - startOfUtcDay(firstSentAt).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export async function outreachAutoSendHandler({
  step,
  now = new Date(),
}: OutreachAutoSendArgs): Promise<{
  autonomy: Autonomy;
  budget: number;
  sent: number;
  suppressed: number;
  failed: number;
  skippedIneligible: number;
}> {
  const autonomy = env.OUTREACH_AUTONOMY as Autonomy;

  // ── 0. SUGGEST → nothing auto-sends. Short-circuit before any DB work. ─────
  if (autonomy === "SUGGEST") {
    return {
      autonomy,
      budget: 0,
      sent: 0,
      suppressed: 0,
      failed: 0,
      skippedIneligible: 0,
    };
  }

  // ── 1. Budget for today (warm-up cap − already auto-sent today) ───────────
  const budget = await step.run("compute-budget", async () => {
    const dayStart = startOfUtcDay(now);

    // First-ever auto send anchors the warm-up clock.
    const firstAuto = await prisma.outreachEmail.findFirst({
      where: { autonomyAtSend: { not: null }, sentAt: { not: null } },
      orderBy: { sentAt: "asc" },
      select: { sentAt: true },
    });

    const sentToday = await prisma.outreachEmail.count({
      where: {
        autonomyAtSend: { not: null },
        sentAt: { gte: dayStart },
        status: { in: [...SENT_TODAY_STATUSES] },
      },
    });

    const dayIndex = dayIndexSince(firstAuto?.sentAt ?? null, now);
    return remainingDailyBudget(env.OUTREACH_DAILY_SEND_CAP, dayIndex, sentToday);
  });

  if (budget <= 0) {
    logger.info("[outreach-auto-send] no budget left today", { autonomy });
    return { autonomy, budget: 0, sent: 0, suppressed: 0, failed: 0, skippedIneligible: 0 };
  }

  // ── 2. Candidate drafts (cold path, drafted by agent, not yet sent) ───────
  const candidates = await step.run("load-candidates", async () => {
    const rows = await prisma.outreachEmail.findMany({
      where: {
        status: "draft",
        draftedByAgent: true,
        prospectId: { not: null },
      },
      select: {
        id: true,
        toEmail: true,
        subject: true,
        body: true,
        prospectId: true,
        prospect: { select: { tier: true, lastContactedAt: true } },
      },
      // Cap the working set generously above the budget; final order applies below.
      take: Math.min(500, budget * 10),
    });
    return rows;
  });

  // ── 3. Filter to auto-eligible (decideAutoSend) + order by queue policy ────
  let skippedIneligible = 0;
  const eligible = candidates
    .map((row) => {
      const tierRaw = row.prospect?.tier ?? null;
      if (!isTier(tierRaw)) {
        skippedIneligible += 1;
        return null;
      }
      const tier: Tier = tierRaw;
      const decision = decideAutoSend(tier, autonomy, "first_touch");
      if (!decision.autoSend) {
        skippedIneligible += 1;
        return null;
      }
      return {
        emailId: row.id,
        toEmail: row.toEmail,
        subject: row.subject,
        body: row.body,
        prospectId: row.prospectId,
        tier,
        lastContactedMs: row.prospect?.lastContactedAt
          ? row.prospect.lastContactedAt.getTime()
          : null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => compareQueue(a, b))
    .slice(0, budget);

  // ── 4. Send each, re-checking suppression at send time ────────────────────
  let sent = 0;
  let suppressed = 0;
  let failed = 0;

  for (let i = 0; i < eligible.length; i++) {
    const item = eligible[i]!;
    const outcome = await step.run(`auto-send-${item.emailId}`, async () => {
      // Compliance gate — opt-out may have landed after drafting.
      if (await isSuppressed(item.toEmail)) {
        await prisma.outreachEmail.update({
          where: { id: item.emailId },
          data: { status: "failed" },
        });
        return "suppressed" as const;
      }

      // Compliance gate (non-negotiable #5): the drafting agent already guards,
      // but never auto-send a forbidden-word body even if a draft was hand-edited.
      // Use containsForbidden (no throw) so a block is an explicit, audited
      // outcome distinct from a Resend failure — parity with outreach-send /
      // outreach-followups. The row is marked "failed", the block is audited
      // (channel "auto_send"), and nothing is sent.
      const forbidden = containsForbidden(`${item.subject}\n${item.body}`);
      if (forbidden) {
        await prisma.outreachEmail
          .update({ where: { id: item.emailId }, data: { status: "failed" } })
          .catch(() => {});
        logger.error("[outreach-auto-send] blocked forbidden-words", {
          emailId: item.emailId,
          found: forbidden.found,
        });
        // Best-effort audit — runs AFTER the no-send decision, so an audit
        // failure can never turn a blocked email into a sent one.
        try {
          await recordAdminAudit({
            actorWallet: "system:outreach-auto-send",
            action: "outreach.blockedSend",
            entityType: "OutreachEmail",
            entityId: item.emailId,
            after: {
              reason: "forbidden_words",
              channel: "auto_send",
              prospectId: item.prospectId ?? null,
              tier: item.tier,
              autonomy,
              found: forbidden.found,
            },
          });
        } catch (auditErr) {
          logger.error("[outreach-auto-send] failed to audit blocked send", {
            emailId: item.emailId,
            error: auditErr instanceof Error ? auditErr.message : String(auditErr),
          });
        }
        return "blocked" as const;
      }

      try {
        const result = await sendTrackedEmail({
          to: item.toEmail,
          subject: item.subject,
          html: renderPlainHtml(item.body, item.toEmail, {
            url: resolveCtaUrl(),
            label: "Apply for access",
          }),
          tags: { emailId: item.emailId, auto: "1" },
        });

        await prisma.$transaction(async (tx) => {
          await tx.outreachEmail.update({
            where: { id: item.emailId },
            data: {
              status: "sent",
              sentAt: now,
              resendEmailId: result.id,
              tierAtSend: item.tier,
              autonomyAtSend: autonomy,
            },
          });
          await tx.outreachProspect.update({
            where: { id: item.prospectId! },
            data: { status: "contacted", lastContactedAt: now, sequenceStep: 1 },
          });
          await recordAdminAudit({
            actorWallet: "system:outreach-auto-send",
            action: "outreach.autoSend",
            entityType: "OutreachEmail",
            entityId: item.emailId,
            after: {
              tier: item.tier,
              autonomy,
              to: item.toEmail,
            },
          }, tx);
        });

        // Best-effort HubSpot activity — never blocks the send.
        if (item.prospectId) {
          await logEmailActivity({
            prospectId: item.prospectId,
            type: "sent",
            subject: item.subject,
          });
        }
        return "sent" as const;
      } catch (err) {
        await prisma.outreachEmail
          .update({ where: { id: item.emailId }, data: { status: "failed" } })
          .catch(() => {});
        logger.error("[outreach-auto-send] send failed", {
          emailId: item.emailId,
          error: err instanceof Error ? err.message : String(err),
        });
        return "failed" as const;
      }
    });

    if (outcome === "sent") sent += 1;
    else if (outcome === "suppressed") suppressed += 1;
    else failed += 1;
  }

  logger.info("[outreach-auto-send] complete", {
    autonomy,
    budget,
    sent,
    suppressed,
    failed,
    skippedIneligible,
  });

  return { autonomy, budget, sent, suppressed, failed, skippedIneligible };
}

export const outreachAutoSend = inngest.createFunction(
  {
    id: OUTREACH_AUTO_SEND_ID,
    concurrency: { limit: 1 },
    triggers: [{ cron: OUTREACH_AUTO_SEND_CRON }],
  },
  outreachAutoSendHandler,
);
