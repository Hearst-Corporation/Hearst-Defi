"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/require-admin";
import { recordAdminAudit } from "@/lib/admin/audit";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { assertRateLimit } from "@/lib/rate-limit";

/** Admin distribution actions rate limit: 10 requests / 60s / admin. */
const DIST_RATE_MAX = 10;
const DIST_RATE_WINDOW_MS = 60_000;

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const PeriodSchema = z.string().regex(/^\d{4}-\d{2}$/, {
  message: "Period must be in YYYY-MM format, e.g. 2026-05",
});

const VaultRefSchema = z.string().min(1, "Vault is required");

const ComputeSchema = z.object({
  period: PeriodSchema,
  totalUsdc: z.number().positive(),
  vaultRef: VaultRefSchema,
});

const ConfirmSchema = z.object({
  period: PeriodSchema,
  signerWallet: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid Ethereum address"),
  totalUsdc: z.number().positive(),
  vaultRef: VaultRefSchema,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DistributionRecipient {
  investorId: string;
  walletAddress: string;
  sharesPct: number;
  payoutUsdc: number;
}

export interface ComputeDistributionResult {
  period: string;
  totalUsdc: number;
  vaultRef: string;
  recipients: DistributionRecipient[];
}

// ---------------------------------------------------------------------------
// Multisig threshold
// ---------------------------------------------------------------------------

const REQUIRED_SIGNERS = 2;

// Pending confirmations are now persisted in the DistributionApproval table
// (replaced the in-memory Map). This survives server restarts and works
// across multiple instances. See prisma/schema.prisma for the model.

// ---------------------------------------------------------------------------
// computeDistribution — pure dry-run, no DB writes
// ---------------------------------------------------------------------------

export async function computeDistribution(
  period: string,
  totalUsdc: number,
  vaultRef: string,
): Promise<ComputeDistributionResult> {
  const admin = await requireAdmin();

  try {
    await assertRateLimit(
      `admin:distributions:${admin.userId}`,
      DIST_RATE_MAX,
      DIST_RATE_WINDOW_MS,
    );
  } catch {
    throw new Error("Too many requests");
  }

  const parsed = ComputeSchema.safeParse({ period, totalUsdc, vaultRef });
  if (!parsed.success) {
    throw new Error(`Invalid input: ${parsed.error.message}`);
  }

  const activePositions = await prisma.position.findMany({
    where: { status: "active" },
    include: { investor: { select: { id: true, walletAddress: true } } },
  });

  if (activePositions.length === 0) {
    return { period, totalUsdc, vaultRef, recipients: [] };
  }

  // Sum total principal across all active positions
  const totalPrincipal = activePositions.reduce(
    (acc, p) => acc + p.principalUsdc.toNumber(),
    0,
  );

  if (totalPrincipal === 0) {
    return { period, totalUsdc, vaultRef, recipients: [] };
  }

  const recipients: DistributionRecipient[] = activePositions.map((pos) => {
    const principal = pos.principalUsdc.toNumber();
    const sharesPct = (principal / totalPrincipal) * 100;
    const payoutUsdc = (principal / totalPrincipal) * totalUsdc;
    return {
      investorId: pos.investorId,
      // walletAddress is nullable now (set only when the investor connects a
      // wallet for payment). Empty string = no wallet on file yet.
      walletAddress: pos.investor.walletAddress ?? "",
      sharesPct: Math.round(sharesPct * 10000) / 10000,
      payoutUsdc: Math.round(payoutUsdc * 100) / 100,
    };
  });

  logger.info("[distributions] compute dry-run", {
    period,
    totalUsdc,
    vaultRef,
    recipientsCount: recipients.length,
    totalPrincipal,
  });

  return { period, totalUsdc, vaultRef, recipients };
}

// ---------------------------------------------------------------------------
// confirmDistribution — multisig, creates Distribution + InvestorTransaction rows
// ---------------------------------------------------------------------------

export async function confirmDistribution(
  period: string,
  signerWallet: string,
  totalUsdc: number,
  vaultRef: string,
): Promise<{ confirmed: boolean; signersCount: number; required: number }> {
  const admin = await requireAdmin();

  try {
    await assertRateLimit(
      `admin:distributions:${admin.userId}`,
      DIST_RATE_MAX,
      DIST_RATE_WINDOW_MS,
    );
  } catch {
    throw new Error("Too many requests");
  }

  const parsed = ConfirmSchema.safeParse({ period, signerWallet, totalUsdc, vaultRef });
  if (!parsed.success) {
    throw new Error(`Invalid input: ${parsed.error.message}`);
  }

  // Fast/legacy guard: a Distribution may already exist for this (period,
  // vaultRef). This is a best-effort short-circuit — the authoritative defense
  // against the TOCTOU race is the @@unique([period, vaultRef]) constraint
  // enforced inside the transaction below (P0-3). The period-only check also
  // backstops legacy rows where vaultRef is null.
  const existing = await prisma.distribution.findFirst({
    where: { period, OR: [{ vaultRef }, { vaultRef: null }] },
  });
  if (existing) {
    throw new Error(
      `Distribution for period "${period}" has already been confirmed.`,
    );
  }

  // Accumulate signer — amount is locked in by the first signer.
  // Persisted in DistributionApproval table for resilience across restarts.
  const approvals = await prisma.distributionApproval.findMany({
    where: { period },
  });

  if (approvals.length === 0) {
    // First signer: create approval and lock in the reference amount
    await prisma.distributionApproval.create({
      data: { period, signerWallet, totalUsdc },
    });
  } else {
    // Subsequent signer: reject if the submitted amount differs from reference
    const reference = approvals[0]!.totalUsdc;
    if (totalUsdc !== reference.toNumber()) {
      throw new Error(
        `Distribution amount mismatch for period "${period}": ` +
          `first signer approved $${reference}, this signer submitted $${totalUsdc}. ` +
          `All signers must approve the same amount.`,
      );
    }
    // Idempotent create — @@unique([period, signerWallet]) prevents duplicates
    await prisma.distributionApproval
      .create({
        data: { period, signerWallet, totalUsdc: reference },
      })
      .catch(() => {
        /* already approved by this signer, ignore */
      });
  }

  // Re-count approvals for this period
  const signersCount = await prisma.distributionApproval.count({
    where: { period },
  });
  // Use the locked-in reference amount from the first approval
  const lockedUsdc = approvals[0]?.totalUsdc.toNumber() ?? totalUsdc;

  logger.info("[distributions] confirm partial", {
    period,
    signerWallet,
    signersCount,
    required: REQUIRED_SIGNERS,
  });

  if (signersCount < REQUIRED_SIGNERS) {
    return { confirmed: false, signersCount, required: REQUIRED_SIGNERS };
  }

  // Threshold reached — execute using the REFERENCE amount (first signer's)
  const computed = await computeDistribution(period, lockedUsdc, vaultRef);

  try {
    await prisma.$transaction(async (tx) => {
      const distribution = await tx.distribution.create({
        data: {
          distributedAt: new Date(),
          amountUsdc: computed.totalUsdc,
          recipientsCount: computed.recipients.length,
          period,
          vaultRef: computed.vaultRef,
        },
      });

      // Create one InvestorTransaction per recipient — single batch, no N+1.
      // Fetch all active positions for the affected investors in one query, then
      // build a Map so each recipient gets the correct positionId (or null when
      // no active position exists, matching the original per-row behaviour).
      const investorIds = computed.recipients.map((r) => r.investorId);

      const activePositions = await tx.position.findMany({
        where: { investorId: { in: investorIds }, status: "active" },
        select: { id: true, investorId: true },
      });

      // When multiple active positions exist per investor (shouldn't happen at
      // MVP but defensive), keep the first one found — same as findFirst would.
      const positionByInvestor = new Map<string, string>();
      for (const pos of activePositions) {
        if (!positionByInvestor.has(pos.investorId)) {
          positionByInvestor.set(pos.investorId, pos.id);
        }
      }

      const now = new Date();
      await tx.investorTransaction.createMany({
        data: computed.recipients.map((r) => ({
          investorId: r.investorId,
          positionId: positionByInvestor.get(r.investorId) ?? null,
          type: "distribution",
          amountUsdc: r.payoutUsdc,
          occurredAt: now,
        })),
      });

      await recordAdminAudit({
        actorWallet: admin.walletAddress ?? admin.userId,
        action: "distribution.confirmed",
        entityType: "Distribution",
        entityId: distribution.id,
        before: null,
        after: {
          period,
          totalUsdc: computed.totalUsdc,
          recipientsCount: computed.recipients.length,
          signersCount,
          vaultRef: computed.vaultRef,
        },
      });

      // Clear the pending approvals for this period
      await tx.distributionApproval.deleteMany({ where: { period } });
    });

    logger.info("[distributions] confirmed", {
      period,
      totalUsdc: computed.totalUsdc,
      recipientsCount: computed.recipients.length,
    });

    revalidatePath("/admin/distributions");
    revalidatePath("/admin/proof-center");

    return { confirmed: true, signersCount, required: REQUIRED_SIGNERS };
  } catch (err) {
    // P0-3: lost the TOCTOU race — a concurrent confirmation already created the
    // Distribution for this (period, vaultRef) and the unique constraint fired.
    // Surface it as already-confirmed rather than a 500, and never double-pay.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      logger.warn("[distributions] duplicate confirm blocked by unique constraint", {
        period,
        vaultRef,
      });
      throw new Error(
        `Distribution for period "${period}" has already been confirmed.`,
      );
    }
    logger.error("confirmDistribution failed", { period }, err);
    throw err;
  }
}
