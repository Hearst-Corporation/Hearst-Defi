import "server-only";

import { prisma } from "@/lib/db";
import { inngest } from "@/lib/inngest/client";
import { logger } from "@/lib/logger";
import { DISTRIBUTION_EVENTS } from "./events";
import type { DistributionExecutedPayload } from "./events";

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface AtomicExecResult {
  tx: {
    hash: string;
    status: "pending" | "confirmed" | "failed";
  };
  ledgerEntries: { positionId: string; amount: number }[];
  pcap: { generatedAt: Date; pdfUrl: string };
  emailsQueued: number;
}

// ---------------------------------------------------------------------------
// Structured error
// ---------------------------------------------------------------------------

export class AtomicExecError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "NOT_PENDING"
      | "NO_POSITIONS"
      | "ZERO_PRINCIPAL"
      | "PERSIST_FAILED"
      | "EVENT_FAILED",
  ) {
    super(message);
    this.name = "AtomicExecError";
  }
}

// ---------------------------------------------------------------------------
// executeDistributionAtomically
// ---------------------------------------------------------------------------

/**
 * Atomic distribution execution — Carta pattern.
 *
 * A single call drives the full lifecycle:
 *   1. Pre-flight: load distribution + positions, guard against re-execution.
 *   2. Compute ledger: pro-rata split based on position principal.
 *   3. Persist ledger entries (DistributionLedgerEntry) inside a transaction.
 *   4. Persist PCAP record inside the same transaction.
 *   5. Mark Distribution as "executed" + stamp txHash + executedAt.
 *   6. Emit Inngest event → triggers email fan-out job.
 *
 * All DB writes happen inside a single Prisma $transaction so that any
 * failure rolls back every write. The Inngest send is intentionally outside
 * the transaction (Inngest is not a DB resource); if the send fails the
 * transaction has already committed, so we log and treat the error as
 * non-fatal (emails can be re-triggered manually).
 *
 * @param distributionId  Primary key of the Distribution row to execute.
 * @returns               Structured result with all artifacts.
 * @throws AtomicExecError for pre-flight failures or DB rollback.
 */
export async function executeDistributionAtomically(
  distributionId: string,
): Promise<AtomicExecResult> {
  // ── 1. Pre-flight ─────────────────────────────────────────────────────────

  // Fast-path existence check outside the transaction to surface "not found"
  // early without holding a TX slot. The definitive TOCTOU guard is the
  // compare-and-set updateMany inside the $transaction below.
  const distribution = await prisma.distribution.findUnique({
    where: { id: distributionId },
  });

  if (!distribution) {
    throw new AtomicExecError(
      `Distribution "${distributionId}" not found.`,
      "NOT_PENDING",
    );
  }

  if (distribution.status !== "pending") {
    throw new AtomicExecError(
      `Distribution "${distributionId}" is not pending (current status: "${distribution.status}"). Cannot re-execute.`,
      "NOT_PENDING",
    );
  }

  const activePositions = await prisma.position.findMany({
    where: { status: "active" },
    select: {
      id: true,
      investorId: true,
      principalUsdc: true,
    },
  });

  if (activePositions.length === 0) {
    throw new AtomicExecError(
      "No active positions found. Cannot execute distribution with zero recipients.",
      "NO_POSITIONS",
    );
  }

  const totalPrincipal = activePositions.reduce(
    (acc, p) => acc + p.principalUsdc.toNumber(),
    0,
  );

  if (totalPrincipal === 0) {
    throw new AtomicExecError(
      "Total principal across all active positions is zero. Cannot compute distribution.",
      "ZERO_PRINCIPAL",
    );
  }

  // ── 2. Compute ledger (pure, no I/O) ──────────────────────────────────────

  const totalUsdc = distribution.amountUsdc.toNumber();

  const ledgerComputed = activePositions.map((pos) => {
    const principal = pos.principalUsdc.toNumber();
    const amount =
      Math.round((principal / totalPrincipal) * totalUsdc * 100) / 100;
    return { positionId: pos.id, amount };
  });

  const txHash = `0xMOCK_${distributionId}`;
  const executedAt = new Date();

  // ── 3–5. Persist inside single transaction ────────────────────────────────

  let persistedPcapUrl = "";
  let persistedPcapAt = executedAt;

  try {
    await prisma.$transaction(async (tx) => {
      // 3. Compare-and-set: atomically flip status pending→executed.
      // If another concurrent finisher already wrote "executed", count===0 and
      // we throw NOT_PENDING before touching ledger entries or PCAP.
      const cas = await tx.distribution.updateMany({
        where: { id: distributionId, status: "pending" },
        data: { status: "executed", executedAt, txHash },
      });

      if (cas.count === 0) {
        throw new AtomicExecError(
          `Distribution "${distributionId}" was already executed by a concurrent call. CAS failed.`,
          "NOT_PENDING",
        );
      }

      // 4. Ledger entries — only reached after a successful CAS write.
      await tx.distributionLedgerEntry.createMany({
        data: ledgerComputed.map((entry) => ({
          distributionId,
          positionId: entry.positionId,
          amountUsdc: entry.amount,
        })),
      });

      // 5. PCAP record
      const pcapPdfUrl = `/pcap/${distributionId}/distribution-${distribution.period}.pdf`;
      const pcap = await tx.pcap.create({
        data: {
          distributionId,
          generatedFor: "distribution",
          pdfUrl: pcapPdfUrl,
        },
      });
      persistedPcapUrl = pcap.pdfUrl ?? pcapPdfUrl;
      persistedPcapAt = pcap.generatedAt;
    });
  } catch (err) {
    // Re-throw AtomicExecError directly (e.g. CAS NOT_PENDING thrown inside the
    // callback) so the caller sees the correct error code rather than PERSIST_FAILED.
    if (err instanceof AtomicExecError) {
      throw err;
    }
    logger.error("[atomic-exec] transaction rollback", { distributionId }, err);
    throw new AtomicExecError(
      `Atomic transaction failed and was rolled back: ${err instanceof Error ? err.message : String(err)}`,
      "PERSIST_FAILED",
    );
  }

  // ── 6. Emit Inngest event (outside transaction — non-fatal) ───────────────

  let emailsQueued = 0;

  const eventPayload: DistributionExecutedPayload = {
    distributionId,
    period: distribution.period,
    amountUsdc: totalUsdc,
    ledgerEntriesCount: ledgerComputed.length,
    txHash,
    executedAt: executedAt.toISOString(),
  };

  try {
    await inngest.send({
      name: DISTRIBUTION_EVENTS.EXECUTED,
      data: eventPayload,
    });
    // Each ledger entry recipient will receive one email — treat the send
    // as 1 queued batch event (the Inngest function fans out per recipient).
    emailsQueued = 1;
  } catch (err) {
    // Non-fatal: transaction committed, distribution is executed. Log and continue.
    logger.error(
      "[atomic-exec] inngest send failed — emails will need manual retry",
      { distributionId },
      err,
    );
  }

  logger.info("[atomic-exec] distribution executed atomically", {
    distributionId,
    period: distribution.period,
    totalUsdc,
    ledgerEntriesCount: ledgerComputed.length,
    txHash,
  });

  // ── 7. Return ─────────────────────────────────────────────────────────────

  return {
    tx: { hash: txHash, status: "pending" },
    ledgerEntries: ledgerComputed,
    pcap: { generatedAt: persistedPcapAt, pdfUrl: persistedPcapUrl },
    emailsQueued,
  };
}
