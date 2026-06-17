import "server-only";

import { prisma } from "@/lib/db";
import { loadCustody } from "@/lib/data/custody";
import { evaluateFreshness, type FreshnessKind } from "@/lib/data/freshness";
import { canRunDemoProvider } from "@/lib/demo/guard";
import { buildDemoAdminOverview } from "@/lib/demo/admin/overview";

// ---------------------------------------------------------------------------
// Admin dashboard proof + custody overlay.
//
// Read-only aggregation for `src/app/admin/dashboard/page.tsx` (proof KPI,
// capital custody). Governance/KYC action counts lived here historically for
// a removed honesty banner — they now surface only via cockpit.actionQueue.
// ---------------------------------------------------------------------------

/**
 * A mining attestation is "current" within ~35 days (monthly cadence). Past
 * that window the latest evidence reads as stale rather than live — longer than
 * the 5-minute price SLO, so it gets its own constant here rather than abusing
 * the `STALE_THRESHOLDS` price registry.
 */
const ATTESTATION_FRESH_MS = 35 * 24 * 60 * 60 * 1000;

export interface AdminProofStatus {
  /** Most recent mining-attestation `postedAt`, or null when none exists. */
  lastMiningAttestationAt: Date | null;
  /** Freshness of the latest mining attestation (35-day cadence window). */
  miningFreshness: FreshnessKind;
  /** Total mining-attestation proofs on file. */
  attestationsCount: number;
  /** Total proofs across all types. */
  proofsTotal: number;
  /** Custody PoR scope is pinned AND funded. */
  custodyConfigured: boolean;
  /** Custody provenance from the live Fireblocks read ("live" | "manual"). */
  custodyProvenance: "live" | "manual";
  /** Total USDC reserves under custody (0 when not configured / empty). */
  custodyReservesUsdc: number;
}

export interface AdminOverview {
  proof: AdminProofStatus;
}

/**
 * Loads proof + custody status for the admin dashboard. Never throws on empty
 * data — counts degrade to 0, custody degrades to a manual snapshot.
 */
export async function loadAdminOverview(): Promise<AdminOverview> {
  if (canRunDemoProvider()) return buildDemoAdminOverview();

  const [
    latestMiningAttestation,
    attestationsCount,
    proofsTotal,
    custody,
  ] = await Promise.all([
    prisma.proof.findFirst({
      where: { proofType: "mining_attestation" },
      orderBy: { postedAt: "desc" },
      select: { postedAt: true },
    }),
    prisma.proof.count({ where: { proofType: "mining_attestation" } }),
    prisma.proof.count(),
    loadCustody(),
  ]);

  const lastMiningAttestationAt = latestMiningAttestation?.postedAt ?? null;

  const proof: AdminProofStatus = {
    lastMiningAttestationAt,
    miningFreshness: evaluateFreshness(lastMiningAttestationAt, ATTESTATION_FRESH_MS),
    attestationsCount,
    proofsTotal,
    custodyConfigured: custody.configured,
    custodyProvenance: custody.provenance,
    custodyReservesUsdc: custody.totalUsdcReserves,
  };

  return { proof };
}
