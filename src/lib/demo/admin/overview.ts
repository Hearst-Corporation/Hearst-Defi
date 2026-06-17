// Demo Admin Overview builder.
//
// Pure, deterministic builder — no Prisma, no fetch, no I/O.
// Called by loadAdminOverview() when canRunDemoProvider() is true (non-prod +
// DEMO_PROVIDER_ENABLED=1). Admin pages have no investor identity so the gate
// is the global guard, not isDemoInvestor().
//
// Honesty rules:
//   - custodyProvenance is "manual" — never "live" (no real Fireblocks call ran).
//   - miningFreshness is "stale" — simulated attestation, not attested live.
//   - No real on-chain address or tx hash appears anywhere in this file.

import type { AdminOverview, AdminProofStatus } from "@/lib/data/admin-overview";
import type { FreshnessKind } from "@/lib/data/freshness";

/** Demo anchor: 20 days before "now" — within the 35-day mining cadence. */
function demoMiningAttestationAt(): Date {
  return new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
}

export function buildDemoAdminOverview(): AdminOverview {
  const lastMiningAttestationAt = demoMiningAttestationAt();
  const miningFreshness: FreshnessKind = "stale";

  const proof: AdminProofStatus = {
    lastMiningAttestationAt,
    miningFreshness,
    attestationsCount: 5,
    proofsTotal: 12,
    custodyConfigured: true,
    custodyProvenance: "manual",
    custodyReservesUsdc: 25_000_000,
  };

  return { proof };
}
