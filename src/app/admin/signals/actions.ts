"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/require-admin";
import { recordAdminAudit } from "@/lib/admin/audit";
import { prisma } from "@/lib/db";
import { writeRebalanceEvent } from "@/lib/chain/event-logger";
import { logger } from "@/lib/logger";
import { assertRateLimit } from "@/lib/rate-limit";

/** Admin signal actions rate limit: 20 requests / 60s / admin. */
const SIGNAL_RATE_MAX = 20;
const SIGNAL_RATE_WINDOW_MS = 60_000;

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const ApproveSchema = z.object({
  eventId: z.string().min(1),
});

const RejectSchema = z.object({
  eventId: z.string().min(1),
  reason: z.string().min(1).max(500),
});

const ExecuteSchema = z.object({
  eventId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Multisig threshold — default 2 distinct signers required
// ---------------------------------------------------------------------------

const REQUIRED_SIGNERS = 2;

/**
 * Maximum CAS retry attempts for the approvedBy optimistic-concurrency loop.
 * Each attempt re-reads the row fresh and re-tries the snapshot CAS. If all
 * attempts exhaust without winning the race, an observable error is thrown so
 * no signer is ever silently dropped (closes P3).
 */
const MAX_ATTEMPTS = 4;

// ---------------------------------------------------------------------------
// approveRebalance
// ---------------------------------------------------------------------------

export async function approveRebalance(eventId: string): Promise<void> {
  const admin = await requireAdmin();

  // Signer identity is derived server-side from the authenticated admin — NEVER
  // a client-supplied value. walletAddress is null for admins (no Investor row),
  // so this collapses to admin.userId. The quorum counts DISTINCT AUTHENTICATED
  // ADMINS, mirroring signApproval() in src/app/admin/vaults/actions.ts.
  const signerKey = admin.walletAddress ?? admin.userId;

  try {
    await assertRateLimit(
      `admin:signals:${admin.userId}`,
      SIGNAL_RATE_MAX,
      SIGNAL_RATE_WINDOW_MS,
    );
  } catch {
    throw new Error("Too many requests");
  }

  const parsed = ApproveSchema.safeParse({ eventId });
  if (!parsed.success) {
    throw new Error(`Invalid input: ${parsed.error.message}`);
  }

  try {
    // -------------------------------------------------------------------------
    // Optimistic-concurrency CAS loop (P2 + P3 fix).
    //
    // WHY no $transaction: the CAS guard now includes BOTH status:"pending" AND
    // the exact approvedBy snapshot, so the updateMany itself is the atomic
    // guard. Any concurrent write (status flip OR competing append) changes at
    // least one of those columns, yielding count===0 → retry on the next
    // attempt with a fresh read. No interactive tx needed.
    //
    // P2 closed: two concurrent partial-append callers that both read
    //   approvedBy=["X"] will produce the same where-clause snapshot. Only one
    //   updateMany can match (the other sees a changed approvedBy) → no
    //   lost-update clobber on Postgres READ COMMITTED.
    //
    // P3 closed: count===0 no longer silently drops the signer — it loops and
    //   retries. If all MAX_ATTEMPTS exhaust, an observable error is thrown.
    //   Audit + logger.info are emitted on every successful count===1 write,
    //   regardless of whether it is a partial approval or the threshold flip.
    // -------------------------------------------------------------------------

    let won = false;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      // Step A: fresh read.
      const event = await prisma.rebalanceEvent.findUnique({
        where: { id: eventId },
      });
      if (!event) throw new Error("Not found");
      if (event.status !== "pending") {
        throw new Error(
          `Cannot approve a signal with status "${event.status}". Expected "pending".`,
        );
      }

      // Step B: parse current signers.
      let currentSigners: string[];
      try {
        currentSigners = JSON.parse(event.approvedBy ?? "[]") as string[];
      } catch {
        throw new Error("Invalid approvedBy format");
      }

      // Idempotent: if this admin already signed, nothing to do.
      if (currentSigners.includes(signerKey)) {
        logger.info("[signals] signer already present — idempotent", {
          eventId,
          signerKey,
        });
        won = true; // treat as success — no retry needed
        break;
      }

      // Step C: compute new state.
      const updatedSigners = [...currentSigners, signerKey];
      const thresholdReached = updatedSigners.length >= REQUIRED_SIGNERS;
      const now = new Date();
      const approvedByJson = JSON.stringify(updatedSigners);

      // Step D: CAS — guard on BOTH status AND the exact prior approvedBy
      // snapshot. Any concurrent mutation (status change OR competing append)
      // changes at least one of these columns → count===0 → retry.
      const { count } = await prisma.rebalanceEvent.updateMany({
        where: {
          id: eventId,
          status: "pending",
          approvedBy: event.approvedBy ?? "[]",
        },
        data: {
          approvedBy: approvedByJson,
          ...(thresholdReached
            ? { status: "executed", executedAt: now }
            : {}),
        },
      });

      if (count === 1) {
        // Step E: SUCCESS — audit, log, optionally fire on-chain write.
        const auditAction: "rebalance.auto_executed" | "rebalance.approve.partial" =
          thresholdReached ? "rebalance.auto_executed" : "rebalance.approve.partial";

        await recordAdminAudit({
          actorWallet: admin.walletAddress ?? admin.userId,
          action: auditAction,
          entityType: "RebalanceEvent",
          entityId: eventId,
          before: { status: event.status, approvedBy: event.approvedBy },
          after: {
            status: thresholdReached ? "executed" : "pending",
            approvedBy: approvedByJson,
          },
        });

        // Fire on-chain log only when THIS call flipped to executed
        // (double-execute guarantee: only the call that wins count===1 at
        // threshold fires writeRebalanceEvent — the concurrent loser gets
        // count===0 and retries or throws, never reaching this branch).
        if (thresholdReached) {
          void writeRebalanceEvent({
            eventId,
            ruleId: event.ruleId,
            payloadCid: "",
          }).catch(() => {});
        }

        logger.info("[signals] approve", {
          eventId,
          signerKey,
          signersCount: updatedSigners.length,
          thresholdReached,
          attempt,
        });

        won = true;
        break;
      }

      // Step F: count===0 — a concurrent writer mutated the row; loop with a
      // fresh read on the next attempt. Nothing is logged or audited for this
      // failed attempt (no silent drop — if we eventually win on a later
      // attempt the audit fires then; if we exhaust all attempts we throw).
    }

    if (!won) {
      throw new Error(
        "Approval conflict — please retry (concurrent update detected after max attempts)",
      );
    }

    revalidatePath("/admin/signals");
    revalidatePath("/admin/proof-center");
  } catch (err) {
    logger.error("approveRebalance failed", { eventId }, err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// rejectRebalance
// ---------------------------------------------------------------------------

export async function rejectRebalance(
  eventId: string,
  reason: string,
): Promise<void> {
  const admin = await requireAdmin();

  try {
    await assertRateLimit(
      `admin:signals:${admin.userId}`,
      SIGNAL_RATE_MAX,
      SIGNAL_RATE_WINDOW_MS,
    );
  } catch {
    throw new Error("Too many requests");
  }

  const parsed = RejectSchema.safeParse({ eventId, reason });
  if (!parsed.success) {
    throw new Error(`Invalid input: ${parsed.error.message}`);
  }

  try {
    const event = await prisma.rebalanceEvent.findUnique({
      where: { id: eventId },
    });
    if (!event) throw new Error("Not found");
    if (event.status !== "pending" && event.status !== "approved") {
      throw new Error(
        `Cannot reject a signal with status "${event.status}".`,
      );
    }

    const before = { status: event.status };

    const updated = await prisma.rebalanceEvent.update({
      where: { id: eventId },
      data: {
        status: "cancelled",
        // Store the rejection reason in triggerText suffix (no dedicated col at MVP)
        triggerText: `${event.triggerText} [REJECTED: ${reason}]`,
      },
    });

    await recordAdminAudit({
      actorWallet: admin.walletAddress ?? admin.userId,
      action: "rebalance.rejected",
      entityType: "RebalanceEvent",
      entityId: eventId,
      before,
      after: { status: updated.status, reason },
    });

    logger.info("[signals] reject", { eventId, reason });

    revalidatePath("/admin/signals");
    revalidatePath("/admin/proof-center");
  } catch (err) {
    logger.error("rejectRebalance failed", { eventId }, err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// executeRebalance
// ---------------------------------------------------------------------------

export async function executeRebalance(eventId: string): Promise<void> {
  const admin = await requireAdmin();

  try {
    await assertRateLimit(
      `admin:signals:${admin.userId}`,
      SIGNAL_RATE_MAX,
      SIGNAL_RATE_WINDOW_MS,
    );
  } catch {
    throw new Error("Too many requests");
  }

  const parsed = ExecuteSchema.safeParse({ eventId });
  if (!parsed.success) {
    throw new Error(`Invalid input: ${parsed.error.message}`);
  }

  try {
    const event = await prisma.rebalanceEvent.findUnique({
      where: { id: eventId },
    });
    if (!event) throw new Error("Not found");
    if (event.status !== "approved") {
      throw new Error(
        `Cannot execute a signal with status "${event.status}". Expected "approved".`,
      );
    }

    const before = { status: event.status };
    const now = new Date();

    const updated = await prisma.rebalanceEvent.update({
      where: { id: eventId },
      data: {
        status: "executed",
        executedAt: now,
      },
    });

    await recordAdminAudit({
      actorWallet: admin.walletAddress ?? admin.userId,
      action: "rebalance.executed",
      entityType: "RebalanceEvent",
      entityId: eventId,
      before,
      after: { status: updated.status, executedAt: now },
    });

    // Attempt to write the executed rebalance to the EventLogger on-chain.
    // Silently skips if chain is not configured or signing key is absent.
    void writeRebalanceEvent({
      eventId,
      ruleId: event.ruleId,
      payloadCid: "",
    }).catch(() => {
      // writeRebalanceEvent never throws, but if somehow it does, we don't
      // want it to fail the Server Action.
    });

    logger.info("[signals] execute", { eventId, executedAt: now });

    revalidatePath("/admin/signals");
    revalidatePath("/admin/proof-center");
  } catch (err) {
    logger.error("executeRebalance failed", { eventId }, err);
    throw err;
  }
}
