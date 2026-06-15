// Demo Admin Overview builder.
//
// Pure, deterministic builder — no Prisma, no fetch, no I/O.
// Called by loadAdminOverview() when canRunDemoProvider() is true (non-prod +
// DEMO_PROVIDER_ENABLED=1). Admin pages have no investor identity so the gate
// is the global guard, not isDemoInvestor().
//
// Honesty rules:
//   - custodyProvenance is "manual" — never "live" (no real Fireblocks call ran).
//   - miningFreshness is "stale" — the demo attestation date is 20 days ago,
//     which is within the 35-day cadence window and therefore reads as "live"
//     per evaluateFreshness — BUT we mark it "stale" to signal simulated data.
//   - No real on-chain address or tx hash appears anywhere in this file.
//   - totalActionRequired is the exact sum of the tracked item counts below.

import type { AdminOverview, AdminActionItem, AdminProofStatus } from "@/lib/data/admin-overview";
import type { FreshnessKind } from "@/lib/data/freshness";

/** Demo anchor: 20 days before "now" — within the 35-day mining cadence. */
function demoMiningAttestationAt(): Date {
  return new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
}

export function buildDemoAdminOverview(): AdminOverview {
  const actions: AdminActionItem[] = [
    {
      key: "kyc",
      label: "KYC reviews",
      count: 3,
      href: "/admin/customers",
      tracked: true,
      hint: "3 investors awaiting verification",
    },
    {
      key: "distributions",
      label: "Distributions",
      count: 1,
      href: "/admin/distributions",
      tracked: true,
      hint: "Awaiting multisig confirmation",
    },
    {
      key: "documents",
      label: "Subscription documents",
      count: 2,
      href: "/admin/customers",
      tracked: true,
      hint: "Envelopes sent, awaiting signature",
    },
    {
      key: "governance",
      label: "Governance",
      count: 1,
      href: "/admin/governance",
      tracked: true,
      hint: "Proposals to sign or execute",
    },
    {
      key: "subscriptions",
      label: "Subscription intents",
      count: 0,
      href: null,
      tracked: false,
      hint: "Pipeline not wired yet",
    },
    {
      key: "wallet",
      label: "Wallet exceptions",
      count: 0,
      href: null,
      tracked: false,
      hint: "Not tracked — manual audit",
    },
  ];

  // Tracked domains only: kyc(3) + distributions(1) + documents(2) + governance(1)
  const totalActionRequired = actions
    .filter((a) => a.tracked)
    .reduce((sum, a) => sum + a.count, 0);

  // Simulated attestation date — 20 days ago (within 35-day window → live),
  // but we force "stale" here so the badge reads as simulated, not attested.
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

  return { actions, totalActionRequired, proof };
}
