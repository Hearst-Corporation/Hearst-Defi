import "server-only";

import { z } from "zod";

import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sendTrackedEmail, renderPlainHtml } from "@/lib/email/send";
import { resolveCtaUrl } from "@/lib/outreach/cta-url";
import { logEmailActivity } from "@/lib/hubspot/sync-prospect";
import { isSuppressed } from "@/lib/outreach/suppression";
import { containsForbidden } from "@/lib/agents/forbidden-words";
import { recordAdminAudit } from "@/lib/admin/audit";
import { OUTREACH_EVENTS } from "@/lib/outreach/events";
import type { OutreachCampaignSendPayload } from "@/lib/outreach/events";

/**
 * Outreach campaign send — fan-out consumer.
 *
 * Triggered by the `outreach.campaign.send` event (emitted by the admin
 * "send campaign" Server Action). For the named campaign it loads every
 * OutreachEmail with status `approved` and, per row:
 *   1. sends via `sendTrackedEmail` (Resend) tagged { campaignId, emailId }
 *   2. marks the row `sent` (+ sentAt + resendEmailId from the send result)
 *   3. best-effort logs a "sent" activity to HubSpot
 *
 * Each row is processed in its own `step.run` so an Inngest retry replays
 * already-completed sends from the step cache (no duplicate emails). A single
 * row failure marks that row `failed` and the fan-out continues. Once the loop
 * finishes the campaign is flipped to `sent`.
 */
export const OUTREACH_SEND_ID = "outreach-send" as const;

// ---------------------------------------------------------------------------
// Payload schema — fail fast on a malformed event before touching the DB.
// ---------------------------------------------------------------------------

const OutreachCampaignSendPayloadSchema = z.object({
  campaignId: z.string().min(1),
  requestedBy: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Handler (exported for testing)
// ---------------------------------------------------------------------------

export interface OutreachSendStep {
  run<T>(name: string, fn: () => T | Promise<T>): Promise<T>;
}

export interface OutreachSendHandlerArgs {
  step: OutreachSendStep;
  event: { data: OutreachCampaignSendPayload };
}

export async function outreachSendHandler({
  step,
  event,
}: OutreachSendHandlerArgs): Promise<
  | { sent: number; failed: number; total: number }
  | { skipped: true; reason: string }
> {
  // ── Validate event.data with Zod before any work ──────────────────────────
  const parseResult = OutreachCampaignSendPayloadSchema.safeParse(event.data);
  if (!parseResult.success) {
    const msg = parseResult.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    logger.error("[outreach-send] invalid event payload", {
      issues: msg,
      raw: event.data,
    });
    throw new Error(`[outreach-send] malformed payload — ${msg}`);
  }
  const { campaignId, requestedBy } = parseResult.data;

  // ── 1. Load approved emails — one durable step, JSON-serialisable result ───
  const approved = await step.run("load-approved-emails", async () => {
    const rows = await prisma.outreachEmail.findMany({
      where: { campaignId, status: "approved" },
      select: {
        id: true,
        toEmail: true,
        subject: true,
        body: true,
        prospectId: true,
      },
      // Deterministic order → stable step indices on retry.
      orderBy: { id: "asc" },
    });
    return rows;
  });

  if (approved.length === 0) {
    logger.info("[outreach-send] no approved emails — nothing to send", {
      campaignId,
    });
    return { skipped: true, reason: "no_approved_emails" };
  }

  // ── 2. Per-email send — each row in its own memoised step ─────────────────
  // Best-effort: one failure marks that row `failed` and the loop continues.
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < approved.length; i++) {
    const email = approved[i]!;
    const outcome = await step.run(`send-email-${i}`, async () => {
      try {
        // Compliance gate: a recipient may have opted out AFTER this email was
        // approved. Never send to a suppressed address — skip it (not a failure).
        if (await isSuppressed(email.toEmail)) {
          await prisma.outreachEmail.update({
            where: { id: email.id },
            data: { status: "failed" },
          });
          logger.info("[outreach-send] skipped suppressed recipient", {
            campaignId,
            emailId: email.id,
          });
          return { ok: false as const, suppressed: true };
        }

        // Compliance gate (non-negotiable #5): an email is approved as a draft,
        // but a hand-edit after approval (updateEmail re-guards, yet a direct
        // DB edit or an older row would not) could slip an unconditional claim
        // through. Re-check forbidden words at send time — parity with
        // outreach-auto-send / sendDirectEmail. A hit blocks ONLY this row
        // (marked failed, reason logged); the fan-out continues for the rest.
        const forbidden = containsForbidden(`${email.subject}\n${email.body}`);
        if (forbidden) {
          await prisma.outreachEmail.update({
            where: { id: email.id },
            data: { status: "failed" },
          });
          logger.error("[outreach-send] blocked forbidden-words at send time", {
            campaignId,
            emailId: email.id,
            found: forbidden.found,
          });
          // Audit the compliance block so a blocked send is never silent. The
          // payload carries the matched terms + channel — never the email body.
          // Best-effort (matches the existing fan-out posture): an audit failure
          // must NOT turn a blocked email into a sent one — the row already has
          // status "failed" and we have returned before any send.
          try {
            await recordAdminAudit({
              actorWallet: requestedBy,
              action: "outreach.blockedSend",
              entityType: "OutreachEmail",
              entityId: email.id,
              after: {
                reason: "forbidden_words",
                channel: "campaign_fanout",
                campaignId,
                prospectId: email.prospectId ?? null,
                found: forbidden.found,
              },
            });
          } catch (auditErr) {
            logger.error("[outreach-send] failed to audit blocked send", {
              campaignId,
              emailId: email.id,
              error:
                auditErr instanceof Error ? auditErr.message : String(auditErr),
            });
          }
          return { ok: false as const, blocked: true };
        }

        const result = await sendTrackedEmail({
          to: email.toEmail,
          subject: email.subject,
          html: renderPlainHtml(email.body, email.toEmail, {
            url: resolveCtaUrl(),
            label: "Apply for access",
          }),
          tags: { campaignId, emailId: email.id },
        });

        await prisma.outreachEmail.update({
          where: { id: email.id },
          data: {
            status: "sent",
            sentAt: new Date(),
            resendEmailId: result.id,
          },
        });

        // Best-effort HubSpot activity — never blocks or fails the send.
        // `logEmailActivity` is already best-effort (swallows its own errors)
        // and is keyed by prospectId, so only fire it for cold-path rows.
        if (email.prospectId) {
          await logEmailActivity({
            prospectId: email.prospectId,
            type: "sent",
            subject: email.subject,
          });
        }

        return { ok: true as const, resendEmailId: result.id };
      } catch (err) {
        // Mark this row failed and keep going — do not throw (would abort fan-out).
        await prisma.outreachEmail
          .update({
            where: { id: email.id },
            data: { status: "failed" },
          })
          .catch((markErr: unknown) => {
            logger.error("[outreach-send] failed to mark email failed", {
              campaignId,
              emailId: email.id,
              error:
                markErr instanceof Error ? markErr.message : String(markErr),
            });
          });

        logger.error("[outreach-send] email send failed", {
          campaignId,
          emailId: email.id,
          error: err instanceof Error ? err.message : String(err),
        });

        return { ok: false as const };
      }
    });

    if (outcome.ok) {
      sent += 1;
    } else {
      failed += 1;
    }
  }

  // ── 3. Flip the campaign to sent once the fan-out completes ───────────────
  await step.run("mark-campaign-sent", () =>
    prisma.outreachCampaign.update({
      where: { id: campaignId },
      data: { status: "sent", sentAt: new Date() },
    }),
  );

  logger.info("[outreach-send] campaign send complete", {
    campaignId,
    total: approved.length,
    sent,
    failed,
  });

  return { sent, failed, total: approved.length };
}

// ---------------------------------------------------------------------------
// Inngest function registration
// ---------------------------------------------------------------------------

export const outreachSend = inngest.createFunction(
  {
    id: OUTREACH_SEND_ID,
    concurrency: { limit: 3 },
    triggers: [{ event: OUTREACH_EVENTS.CAMPAIGN_SEND }],
  },
  outreachSendHandler,
);
