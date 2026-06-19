import "server-only";

import { z } from "zod";
import { keccak256, toBytes } from "viem";

import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { isDuplicate, markComplete } from "@/lib/idempotency";
import { writeHearstEvent } from "@/lib/chain/event-logger";
import { DISTRIBUTION_EVENTS } from "@/lib/distribution/events";
import type { DistributionExecutedPayload } from "@/lib/distribution/events";
import { buildEmailWrapper } from "@/lib/email/html-shell";
import { CONNECT_ACCENT_HEX } from "@/lib/brand-constants";

// ---------------------------------------------------------------------------
// JOB-6: Zod schema for DistributionExecutedPayload — validates at handler
// entry so a malformed event fails fast before touching emails or on-chain writes.
// ---------------------------------------------------------------------------

const DistributionExecutedPayloadSchema = z.object({
  distributionId: z.string().min(1),
  period: z.string().min(1),
  amountUsdc: z.number().finite().nonnegative(),
  ledgerEntriesCount: z.number().int().nonnegative(),
  txHash: z.string().min(1),
  executedAt: z.string().min(1),
});

/**
 * Distribution Executed — email fan-out consumer.
 *
 * Triggered by the `distribution.executed` event emitted by
 * `executeDistributionAtomically` after the DB transaction commits.
 *
 * Pipeline:
 *   1. idempotency-check  → short-circuit if this distributionId was already
 *                           processed (prevents duplicate emails on Inngest retry).
 *   2. load-recipients    → DistributionLedgerEntry[] → Position → Investor.email
 *   3. send-emails        → one Resend POST per recipient with a valid email.
 *
 * Idempotency key: "distribution-emails-${distributionId}" (LlmRun row).
 */
export const DISTRIBUTION_EXECUTED_ID = "distribution-executed" as const;

// ---------------------------------------------------------------------------
// Email sender (inlined — do NOT import sendResetEmail from password-reset.ts)
// ---------------------------------------------------------------------------

interface DistributionEmailData {
  period: string;
  amountUsdc: number;
}

async function sendDistributionEmail(
  to: string,
  data: DistributionEmailData,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  // Caller is responsible for checking the key before entering the send loop.
  // If the key is absent here it means the single guard was bypassed — throw.
  if (!apiKey) {
    throw new Error("Resend API error: RESEND_API_KEY is not set");
  }

  const formattedAmount = data.amountUsdc.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const body = JSON.stringify({
    from: "Hearst Connect <noreply@hearst.app>",
    to: [to],
    subject: `Hearst Connect — Distribution for ${data.period}`,
    html: `
      ${buildEmailWrapper(`
        <h2 style="color:${CONNECT_ACCENT_HEX};font-size:20px;margin:0 0 16px;">Distribution processed</h2>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#9ca3af;">
          Your distribution for period <strong style="color:#e5e7eb;">${data.period}</strong> has been processed.
        </p>
        <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#9ca3af;">
          Amount: <strong style="color:${CONNECT_ACCENT_HEX};">$${formattedAmount} USDC</strong>
        </p>
        <p style="margin:0;font-size:12px;color:#6b7280;">
          This is a notification only. Past distributions are not indicative of future results.
          Outputs are not guaranteed.
        </p>
      `)}
    `,
  });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    throw new Error(`Resend API error ${res.status}: ${text}`);
  }
}

// ---------------------------------------------------------------------------
// Handler (exported for testing)
// ---------------------------------------------------------------------------

export interface DistributionExecutedStep {
  run<T>(name: string, fn: () => T | Promise<T>): Promise<T>;
}

export interface DistributionExecutedHandlerArgs {
  step: DistributionExecutedStep;
  event: { data: DistributionExecutedPayload };
}

export async function distributionExecutedHandler({
  step,
  event,
}: DistributionExecutedHandlerArgs): Promise<
  | { emailsSent: number; skippedNoEmail: number }
  | { skipped: true; reason: string }
> {
  // ── JOB-6: validate event.data with Zod before any work ───────────────────
  const parseResult = DistributionExecutedPayloadSchema.safeParse(event.data);
  if (!parseResult.success) {
    const msg = parseResult.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    logger.error("[distribution-executed] invalid event payload", { issues: msg, raw: event.data });
    throw new Error(`[distribution-executed] malformed payload — ${msg}`);
  }
  const { distributionId, period, amountUsdc } = parseResult.data;
  const idempotencyKey = `distribution-emails-${distributionId}`;
  const today = new Date();

  // ── 1. Idempotency check — wrapped in step.run so Inngest memoises it ─────
  // Without step.run, a retry would re-execute isDuplicate and could write a
  // duplicate audit row (markComplete). Wrapping guarantees the result is
  // replayed from Inngest's step cache on retry.
  const alreadyRun = await step.run("idempotency-check", () =>
    isDuplicate(idempotencyKey, today),
  );
  if (alreadyRun) {
    return { skipped: true, reason: "already_run_today" };
  }

  // ── 1b. On-chain mirror — append a Distribution entry to the EventLogger ────
  // Independent idempotency key so it fires exactly once regardless of the email
  // path (which can early-return when RESEND is unset). No-op when the publisher
  // is disarmed (writeHearstEvent returns null without HEARST_PUBLISHER_PRIVATE_KEY).
  const mirrorKey = `distribution-onchain-${distributionId}`;
  const mirrorAlreadyRun = await step.run("idempotency-check-mirror", () =>
    isDuplicate(mirrorKey, today),
  );
  if (!mirrorAlreadyRun) {
    const contextHash = keccak256(
      toBytes(`distribution:${distributionId}:${period}`),
    );
    const txHash = await step.run("mirror-onchain-distribution", () =>
      writeHearstEvent({ kind: "Distribution", contextHash, payloadCid: "" }),
    );
    await step.run("mark-complete-mirror", () => markComplete(mirrorKey, today));
    logger.info("[distribution-executed] on-chain mirror", {
      distributionId,
      armed: txHash !== null,
      txHash,
    });
  }

  // ── 2. RESEND guard — checked before any work ────────────────────────────
  if (!process.env.RESEND_API_KEY) {
    logger.warn(
      "[distribution-executed] RESEND_API_KEY not set — skipping all emails",
      { distributionId },
    );
    return { skipped: true, reason: "missing_resend_api_key" };
  }

  // ── 3. Load recipients — one durable step, returns JSON-serialisable array ─
  const { recipients, skippedNoEmail } = await step.run(
    "load-recipients",
    async () => {
      const ledgerEntries = await prisma.distributionLedgerEntry.findMany({
        where: { distributionId },
        select: { positionId: true, amountUsdc: true },
      });

      // Resolve position → email, accumulate per-investor totals.
      // Key: investor email (normalised lowercase). Value: summed USDC amount.
      const investorTotals = new Map<string, number>();
      let skipped = 0;

      for (const entry of ledgerEntries) {
        const position = await prisma.position.findUnique({
          where: { id: entry.positionId },
          select: {
            investor: {
              select: { email: true },
            },
          },
        });

        const email = position?.investor?.email ?? null;

        if (!email) {
          skipped += 1;
          continue;
        }

        const entryAmount =
          typeof entry.amountUsdc === "object" && "toNumber" in entry.amountUsdc
            ? (entry.amountUsdc as { toNumber: () => number }).toNumber()
            : (entry.amountUsdc as number);

        const key = email.toLowerCase();
        investorTotals.set(key, (investorTotals.get(key) ?? 0) + entryAmount);
      }

      if (skipped > 0) {
        logger.info("[distribution-executed] skipped recipients without email", {
          distributionId,
          skippedNoEmail: skipped,
        });
      }

      // Deterministically sorted by email ascending → stable step indices on retry.
      const sorted = Array.from(investorTotals.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([email, amountUsdc]) => ({ email, amountUsdc }));

      return { recipients: sorted, skippedNoEmail: skipped };
    },
  );

  // ── 4. Per-recipient send — each step is individually memoised by Inngest ──
  // A replay after a mid-fan-out crash skips steps that already completed,
  // so no investor receives a duplicate email.
  let emailsSent = 0;
  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i]!;
    await step.run(`send-email-${i}`, () =>
      sendDistributionEmail(r.email, { period, amountUsdc: r.amountUsdc }),
    );
    emailsSent += 1;
  }

  await step.run("mark-complete", () => markComplete(idempotencyKey, today));

  logger.info("[distribution-executed] email fan-out complete", {
    distributionId,
    period,
    totalAmountUsdc: amountUsdc,
    emailsSent,
    skippedNoEmail,
  });

  return { emailsSent, skippedNoEmail };
}

// ---------------------------------------------------------------------------
// Inngest function registration
// ---------------------------------------------------------------------------

export const distributionExecuted = inngest.createFunction(
  {
    id: DISTRIBUTION_EXECUTED_ID,
    concurrency: { limit: 1 },
    triggers: [{ event: DISTRIBUTION_EVENTS.EXECUTED }],
  },
  distributionExecutedHandler,
);
