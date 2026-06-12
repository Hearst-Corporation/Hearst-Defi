import "server-only";

import { prisma } from "@/lib/db";
import {
  recommendDistributionAction,
  type DistributionRecommendation,
} from "@/lib/engine/distribution-policy";

/**
 * Distribution snapshot consumed by the Investor Memo PDF.
 *
 * Mirrors the `Distribution` Prisma model with two refinements:
 *   - `period` is forced to "YYYY-MM" (the DB column allows any string but
 *     the seed and the agent contract both standardise on the calendar form).
 *   - `status` is derived because the schema does not yet expose it (a
 *     `Distribution` row with `txHash` null is treated as "scheduled",
 *     otherwise "paid"; the "pending" branch is reserved for in-flight wires
 *     once the rebalancer learns to emit pending rows).
 */
export interface DistributionSnapshot {
  /** Calendar month, "YYYY-MM" (e.g. "2026-05"). */
  period: string;
  /** Distribution amount in USDC (no decimals — schema is Float). */
  amount_usdc: number;
  /** Wire timestamp. `null` when the distribution is scheduled but not yet paid. */
  paid_at: Date | null;
  /** Lifecycle state. Derived from the row, not stored verbatim. */
  status: "paid" | "scheduled" | "pending";
  /**
   * True when this snapshot is the synthesised fallback (no Distribution row in
   * the DB) sized at a default % of AUM — NOT a committed or executed payout.
   * Consumers MUST badge it `estimated` and label it indicative (B4).
   */
  synthesized?: boolean;
  /**
   * Coverage-aware distribution recommendation (P0 Coverage Engine). Optional
   * and non-breaking: consumers that don't read it are unaffected. Until the
   * mining-attestation coverage source is wired (P1), the coverage ratio is
   * unknown, so this resolves to the "pending → suspend" recommendation — an
   * honest signal that the amount above is NOT yet coverage-validated, never a
   * fabricated coverage figure.
   */
  coverage?: DistributionRecommendation;
}

/**
 * Coverage recommendation for a (possibly unknown) coverage ratio. No live
 * coverage source exists yet (P1), so callers pass `null` → pending/suspend.
 */
function coverageFor(ratio: number | null): DistributionRecommendation {
  return recommendDistributionAction(ratio);
}

/**
 * Returns the most recent distribution row from the DB, or `null` when none
 * exists. Callers render an empty/awaiting state — no synthesised amounts.
 */
export async function loadLatestDistribution(): Promise<DistributionSnapshot | null> {
  const row = await prisma.distribution.findFirst({
    orderBy: { distributedAt: "desc" },
  });

  if (!row) {
    return null;
  }

  return rowToSnapshot({ ...row, amountUsdc: row.amountUsdc.toNumber() });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface DistributionRow {
  distributedAt: Date;
  amountUsdc: number;
  period: string;
  txHash: string | null;
}

function rowToSnapshot(row: DistributionRow): DistributionSnapshot {
  const status: DistributionSnapshot["status"] = row.txHash ? "paid" : "scheduled";
  return {
    period: row.period,
    amount_usdc: row.amountUsdc,
    paid_at: status === "paid" ? row.distributedAt : null,
    status,
    coverage: coverageFor(null),
  };
}
