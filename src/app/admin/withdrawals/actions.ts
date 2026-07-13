"use server";

/**
 * /admin/withdrawals — admin review server actions.
 *
 * The custody-release side of the withdrawal state machine (see
 * `src/app/(product)/withdrawals/actions.ts` for the request-only investor
 * side). Mirrors `src/app/admin/distributions/actions.ts::confirmDistribution`'s
 * multisig-accumulation pattern:
 *   - signerKey is derived server-side from the authenticated admin
 *     (`admin.walletAddress ?? admin.userId`) — NEVER from client input.
 *   - `WithdrawalApproval` rows accumulate idempotently, keyed by
 *     `(withdrawalId, signerWallet)`.
 *   - The state transition only executes inside `prisma.$transaction` once
 *     quorum (`Withdrawal.requiredSigners`) is reached.
 *   - Every transition is recorded via `recordAdminAudit`.
 *
 * State machine:
 *   pending  --[quorum "approve" signatures reached]--> approved
 *   pending  --[a single "reject" from ANY signer]-----> rejected   (not
 *            subject to quorum — one rejection is enough; a conservative
 *            custodial posture)
 *   approved --[markWithdrawalCompleted with a REAL, non-placeholder txHash,
 *            entered by a human operator after an out-of-band custody
 *            release]--------------------------------------------> completed
 *
 * No Inngest job, no cron, no automatic settlement anywhere. This module
 * contains no wallet/chain client call — `markWithdrawalCompleted` only
 * RECORDS a tx hash that already happened off-platform.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/require-admin";
import { recordAdminAudit } from "@/lib/admin/audit";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { assertRateLimit } from "@/lib/rate-limit";
import { isPlaceholderTxHash } from "@/lib/chain/explorer";

/** Admin withdrawal-review rate limit: 20 requests / 60s / admin. */
const WITHDRAWAL_ADMIN_RATE_MAX = 20;
const WITHDRAWAL_ADMIN_RATE_WINDOW_MS = 60_000;

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const DecisionSchema = z.enum(["approve", "reject"]);

const ApproveWithdrawalSchema = z.object({
  withdrawalId: z.string().trim().min(1),
  decision: DecisionSchema,
  reason: z.string().trim().max(1000).optional(),
});

const MarkCompletedSchema = z.object({
  withdrawalId: z.string().trim().min(1),
  txHash: z
    .string()
    .trim()
    .min(1, "A transaction hash is required.")
    .regex(/^0x[0-9a-fA-F]{8,}$/, "Transaction hash does not look like a real hash."),
});

// ---------------------------------------------------------------------------
// approveWithdrawal — multisig quorum for "approve", single-signer for "reject"
// ---------------------------------------------------------------------------

export interface ApproveWithdrawalResult {
  status: "pending" | "approved" | "rejected";
  approvalsCount: number;
  required: number;
}

export async function approveWithdrawal(
  withdrawalId: string,
  decision: "approve" | "reject",
  reason?: string,
): Promise<ApproveWithdrawalResult> {
  const admin = await requireAdmin();

  // Identity binding — the signer key is derived server-side from the
  // authenticated admin, NEVER from a client-supplied parameter. Mirrors
  // confirmDistribution exactly.
  const signerKey = admin.walletAddress ?? admin.userId;

  try {
    await assertRateLimit(
      `admin:withdrawals:${admin.userId}`,
      WITHDRAWAL_ADMIN_RATE_MAX,
      WITHDRAWAL_ADMIN_RATE_WINDOW_MS,
    );
  } catch {
    throw new Error("Too many requests");
  }

  const parsed = ApproveWithdrawalSchema.safeParse({ withdrawalId, decision, reason });
  if (!parsed.success) {
    throw new Error(`Invalid input: ${parsed.error.message}`);
  }

  const withdrawal = await prisma.withdrawal.findUnique({
    where: { id: parsed.data.withdrawalId },
  });
  if (!withdrawal) {
    throw new Error("Withdrawal request not found.");
  }
  if (withdrawal.status !== "pending") {
    throw new Error(
      `Withdrawal is "${withdrawal.status}" — only a "pending" request can be reviewed.`,
    );
  }

  // A single rejection from any signer is enough — reject is NOT subject to
  // quorum (conservative custodial posture: one signer can veto a payout,
  // only a full quorum can approve one).
  if (parsed.data.decision === "reject") {
    await prisma.$transaction(async (tx) => {
      await tx.withdrawalApproval
        .create({
          data: {
            withdrawalId: withdrawal.id,
            signerWallet: signerKey,
            decision: "reject",
            reason: parsed.data.reason ?? null,
          },
        })
        .catch(() => {
          /* already recorded by this signer, ignore */
        });

      await tx.withdrawal.update({
        where: { id: withdrawal.id, status: "pending" },
        data: {
          status: "rejected",
          decidedAt: new Date(),
          decidedBy: signerKey,
          rejectionReason: parsed.data.reason ?? "Rejected by reviewer.",
        },
      });

      await recordAdminAudit(
        {
          actorWallet: signerKey,
          action: "withdrawal.rejected",
          entityType: "Withdrawal",
          entityId: withdrawal.id,
          before: { status: withdrawal.status },
          after: { status: "rejected", reason: parsed.data.reason ?? null },
        },
        tx,
      );
    });

    logger.info("[withdrawals] rejected", { withdrawalId: withdrawal.id, signerWallet: signerKey });
    revalidatePath("/admin/withdrawals");
    revalidatePath("/withdrawals");

    return { status: "rejected", approvalsCount: 0, required: withdrawal.requiredSigners };
  }

  // "approve" path — accumulate signer, idempotent create keyed by
  // (withdrawalId, signerWallet), execute the transition only on quorum.
  await prisma.withdrawalApproval
    .create({
      data: {
        withdrawalId: withdrawal.id,
        signerWallet: signerKey,
        decision: "approve",
        reason: parsed.data.reason ?? null,
      },
    })
    .catch(() => {
      /* already approved by this signer, ignore */
    });

  const approvalsCount = await prisma.withdrawalApproval.count({
    where: { withdrawalId: withdrawal.id, decision: "approve" },
  });

  logger.info("[withdrawals] approve partial", {
    withdrawalId: withdrawal.id,
    signerWallet: signerKey,
    approvalsCount,
    required: withdrawal.requiredSigners,
  });

  if (approvalsCount < withdrawal.requiredSigners) {
    return { status: "pending", approvalsCount, required: withdrawal.requiredSigners };
  }

  // Quorum reached — execute the state transition atomically.
  await prisma.$transaction(async (tx) => {
    const fresh = await tx.withdrawal.findUnique({ where: { id: withdrawal.id } });
    if (!fresh || fresh.status !== "pending") {
      // Lost a race (already transitioned by a concurrent quorum-reaching call).
      return;
    }

    await tx.withdrawal.update({
      where: { id: withdrawal.id, status: "pending" },
      data: {
        status: "approved",
        decidedAt: new Date(),
        decidedBy: signerKey,
      },
    });

    await recordAdminAudit(
      {
        actorWallet: signerKey,
        action: "withdrawal.approved",
        entityType: "Withdrawal",
        entityId: withdrawal.id,
        before: { status: "pending" },
        after: { status: "approved", approvalsCount, required: withdrawal.requiredSigners },
      },
      tx,
    );
  });

  logger.info("[withdrawals] approved (quorum reached)", {
    withdrawalId: withdrawal.id,
    approvalsCount,
    required: withdrawal.requiredSigners,
  });

  revalidatePath("/admin/withdrawals");
  revalidatePath("/withdrawals");

  return { status: "approved", approvalsCount, required: withdrawal.requiredSigners };
}

// ---------------------------------------------------------------------------
// markWithdrawalCompleted — the ONLY path that ever marks a withdrawal settled
// ---------------------------------------------------------------------------

export interface MarkWithdrawalCompletedResult {
  withdrawalId: string;
  status: "completed";
  txHash: string;
}

/**
 * Records a REAL transaction hash for an already-`approved` withdrawal, after
 * an out-of-band custody release performed by an operator. This function
 * NEVER initiates a transfer, NEVER calls a wallet/chain client, and NEVER
 * accepts a placeholder/fabricated hash — it only records what a human has
 * already confirmed happened off-platform.
 */
export async function markWithdrawalCompleted(
  withdrawalId: string,
  txHash: string,
): Promise<MarkWithdrawalCompletedResult> {
  const admin = await requireAdmin();
  const signerKey = admin.walletAddress ?? admin.userId;

  try {
    await assertRateLimit(
      `admin:withdrawals:${admin.userId}`,
      WITHDRAWAL_ADMIN_RATE_MAX,
      WITHDRAWAL_ADMIN_RATE_WINDOW_MS,
    );
  } catch {
    throw new Error("Too many requests");
  }

  const parsed = MarkCompletedSchema.safeParse({ withdrawalId, txHash });
  if (!parsed.success) {
    throw new Error(`Invalid input: ${parsed.error.message}`);
  }

  if (isPlaceholderTxHash(parsed.data.txHash)) {
    throw new Error(
      "This looks like a placeholder/fabricated transaction hash. Enter the real hash from the custody release.",
    );
  }

  const withdrawal = await prisma.withdrawal.findUnique({
    where: { id: parsed.data.withdrawalId },
  });
  if (!withdrawal) {
    throw new Error("Withdrawal request not found.");
  }
  if (withdrawal.status !== "approved") {
    throw new Error(
      `Withdrawal is "${withdrawal.status}" — only an "approved" request can be marked completed.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    const updateResult = await tx.withdrawal.updateMany({
      where: { id: withdrawal.id, status: "approved" },
      data: {
        status: "completed",
        completedAt: new Date(),
        txHash: parsed.data.txHash,
      },
    });

    if (updateResult.count === 0) {
      throw new Error("Withdrawal was already completed or is no longer approved.");
    }

    await recordAdminAudit(
      {
        actorWallet: signerKey,
        action: "withdrawal.completed",
        entityType: "Withdrawal",
        entityId: withdrawal.id,
        before: { status: "approved" },
        after: { status: "completed", txHash: parsed.data.txHash },
      },
      tx,
    );
  });

  logger.info("[withdrawals] completed", {
    withdrawalId: withdrawal.id,
    txHash: parsed.data.txHash,
    signerWallet: signerKey,
  });

  revalidatePath("/admin/withdrawals");
  revalidatePath("/withdrawals");

  return { withdrawalId: withdrawal.id, status: "completed", txHash: parsed.data.txHash };
}
