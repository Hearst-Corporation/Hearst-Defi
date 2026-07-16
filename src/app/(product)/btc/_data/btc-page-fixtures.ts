// src/app/(product)/btc/_data/btc-page-fixtures.ts
//
// Fixtures for the page-scoped EXTRA blocks (see btc-page-types.ts). Mirrors
// the shape/conventions of `features/investor-ui/fixtures/factories.ts`
// (fixtureBlock/fixtureUnresolved) without importing it directly, since that
// module is internal to A5's fixtures directory — this file builds the same
// envelope locally to stay decoupled while the contract is still page-scoped.

import { resolved, type ResolvedViewModel } from "@/features/investor-ui/types/common";
import type {
  BtcCustodyViewModel,
  BtcEventViewModel,
  BtcPageExtraViewModel,
  BtcProductionViewModel,
  BtcProofRefViewModel,
  BtcTakeProfitLadderViewModel,
  BtcTrajectoryViewModel,
} from "./btc-page-types";

const GENERATED_AT = "2026-07-01T12:00:00.000Z";

function fixtureBlock<T>(
  value: T,
  overrides: Partial<Omit<ResolvedViewModel<T>, "status" | "value">> = {},
): ResolvedViewModel<T> {
  return resolved("FIXTURE", value, {
    provenance: "fixture",
    freshness: "fixture data — not live",
    generatedAt: GENERATED_AT,
    error: null,
    ...overrides,
  });
}

function fixtureUnresolved<T>(
  status: Exclude<ResolvedViewModel<T>["status"], "LIVE" | "FIXTURE">,
  overrides: Partial<Omit<ResolvedViewModel<T>, "status" | "value">> = {},
): ResolvedViewModel<T> {
  return resolved<T>(status, null, {
    provenance: "fixture",
    freshness: "fixture data — not live",
    generatedAt: GENERATED_AT,
    error: null,
    ...overrides,
  });
}

const AI_EXPERTS_CONTEXTUAL = [
  {
    id: "btc-reserve-analyst",
    name: "BTC Reserve Analyst",
    focus: "Reserve sizing & accumulation pace",
    summary:
      "Tracks the B2 BTC Pouch against the 24-month accumulation term and flags pace deviations — advisory only, no autonomous action.",
  },
  {
    id: "take-profit-monitor",
    name: "Take-Profit Monitor",
    focus: "Ladder tier proximity",
    summary:
      "Watches spot BTC against the note's take-profit ladder triggers and surfaces proximity to the next tier.",
  },
  {
    id: "custody-attestation-reviewer",
    name: "Custody Attestation Reviewer",
    focus: "Proof-of-reserve cadence",
    summary:
      "Confirms the custody attestation cadence stays current and cross-checks it against the Proof Center log.",
  },
];

const PRODUCTION_MONTHLY = [
  { period: "2026-01", sats: 41_200_000, cumSats: 41_200_000 },
  { period: "2026-02", sats: 44_800_000, cumSats: 86_000_000 },
  { period: "2026-03", sats: 47_100_000, cumSats: 133_100_000 },
  { period: "2026-04", sats: 45_900_000, cumSats: 179_000_000 },
  { period: "2026-05", sats: 49_300_000, cumSats: 228_300_000 },
  { period: "2026-06", sats: 51_700_000, cumSats: 280_000_000 },
].map((row) => ({
  period: row.period,
  satsEarned: String(row.sats),
  cumulativeSatsEarned: String(row.cumSats),
}));

const TRAJECTORY_BANDS = Array.from({ length: 7 }, (_, i) => {
  const m = i * 4; // months 0..24
  const p50 = 100 + m * 0.55;
  return {
    m,
    p5: p50 - 6 - i * 0.6,
    p50,
    p95: p50 + 6 + i * 0.6,
  };
});

export const btcPageExtraCompleteFixture: BtcPageExtraViewModel = {
  production: fixtureBlock<BtcProductionViewModel>({
    monthly: PRODUCTION_MONTHLY,
    cumulativeSatsEarned: "280000000",
    cumulativeBtcEarned: "2.80000000",
  }),
  trajectory: fixtureBlock<BtcTrajectoryViewModel>({
    narrative:
      "The note has accumulated BTC for 6 of its 24 months. Mining settlements have been credited to the B2 reserve every month on schedule, with no curtailment events.",
    monthsElapsed: 6,
    monthsTotal: 24,
    projectedRangeLowPct: 9.4,
    projectedRangeHighPct: 12.8,
    methodologyVersion: "v3.0",
    disclaimer:
      "Estimated range of accumulated BTC at maturity, not a fixed return and not guaranteed. Methodology v3.0.",
    bands: TRAJECTORY_BANDS,
  }),
  takeProfitLadder: fixtureBlock<BtcTakeProfitLadderViewModel>({
    tiers: [
      { tier: 1, triggerMultiple: 1.3, sellPortionBps: 2500, status: "triggered", triggeredAt: "2026-05-14T09:20:00.000Z" },
      { tier: 2, triggerMultiple: 1.6, sellPortionBps: 2500, status: "armed", triggeredAt: null },
      { tier: 3, triggerMultiple: 2.0, sellPortionBps: 2500, status: "pending", triggeredAt: null },
      { tier: 4, triggerMultiple: 2.5, sellPortionBps: 2500, status: "pending", triggeredAt: null },
    ],
  }),
  custody: fixtureBlock<BtcCustodyViewModel>({
    provider: "fireblocks",
    vaultAccountId: "86",
    proofOfReserveAttestedAt: "2026-06-30T00:00:00.000Z",
    withdrawalPolicy: "Multisig, 2-of-3 signers, 60-day soft lock-up (contractual, not enforced on-chain).",
  }),
  events: fixtureBlock<readonly BtcEventViewModel[]>([
    {
      type: "mining_settlement",
      label: "Mining settlement credited to B2 reserve",
      occurredAt: "2026-06-30T00:00:00.000Z",
      detail: "51.7M sats credited from June fleet production.",
      txHash: "0x8f2a...c19e",
      proofHref: "/proof-center",
    },
    {
      type: "take_profit_execution",
      label: "Take-profit tier 1 triggered",
      occurredAt: "2026-05-14T09:20:00.000Z",
      detail: "BTC spot crossed avg entry x1.30 — 25% tactical portion executed.",
      txHash: "0x1d90...44ab",
      proofHref: "/proof-center",
    },
    {
      type: "proof_of_reserve",
      label: "Proof-of-reserve attestation published",
      occurredAt: "2026-06-30T00:00:00.000Z",
      detail: "Fireblocks vault account 86 attested against on-chain custody ledger.",
      txHash: null,
      proofHref: "/proof-center",
    },
    {
      type: "custody_attestation",
      label: "Custody attestation refreshed",
      occurredAt: "2026-06-01T00:00:00.000Z",
      detail: "Quarterly custody attestation cycle completed, no exceptions.",
      txHash: null,
      proofHref: "/proof-center",
    },
  ]),
  proofs: fixtureBlock<readonly BtcProofRefViewModel[]>([
    { label: "Proof-of-reserve attestation", href: "/proof-center", kind: "por" },
    { label: "Mining settlement attestation", href: "/proof-center", kind: "mining-attestation" },
    { label: "Custody attestation", href: "/proof-center", kind: "custody-attestation" },
    { label: "Full event log", href: "/proof-center/full", kind: "event-log" },
  ]),
  aiExperts: AI_EXPERTS_CONTEXTUAL,
};

export const btcPageExtraNotConfiguredFixture: BtcPageExtraViewModel = {
  production: fixtureUnresolved<BtcProductionViewModel>("NOT_CONFIGURED", {
    freshness: "PermissionedDynaVault v2.1 not deployed",
  }),
  trajectory: fixtureUnresolved<BtcTrajectoryViewModel>("NOT_CONFIGURED", {
    freshness: "PermissionedDynaVault v2.1 not deployed",
  }),
  takeProfitLadder: fixtureUnresolved<BtcTakeProfitLadderViewModel>("NOT_CONFIGURED", {
    freshness: "PermissionedDynaVault v2.1 not deployed",
  }),
  custody: fixtureUnresolved<BtcCustodyViewModel>("NOT_CONFIGURED", {
    freshness: "Custody provider not yet linked",
  }),
  events: fixtureUnresolved<readonly BtcEventViewModel[]>("NOT_CONFIGURED", {
    freshness: "PermissionedDynaVault v2.1 not deployed",
  }),
  proofs: fixtureUnresolved<readonly BtcProofRefViewModel[]>("NOT_CONFIGURED", {
    freshness: "PermissionedDynaVault v2.1 not deployed",
  }),
  aiExperts: AI_EXPERTS_CONTEXTUAL,
};

export const btcPageExtraStaleFixture: BtcPageExtraViewModel = {
  ...btcPageExtraCompleteFixture,
  production: {
    ...btcPageExtraCompleteFixture.production,
    status: "STALE",
    freshness: "last indexed 6 days ago",
  },
  trajectory: {
    ...btcPageExtraCompleteFixture.trajectory,
    status: "STALE",
    freshness: "last indexed 6 days ago",
  },
  events: {
    ...btcPageExtraCompleteFixture.events,
    status: "STALE",
    freshness: "last indexed 6 days ago",
  },
};

export const btcPageExtraPartialFixture: BtcPageExtraViewModel = {
  ...btcPageExtraCompleteFixture,
  custody: fixtureUnresolved<BtcCustodyViewModel>("PARTIAL", {
    freshness: "Custody provider linked, attestation pending",
  }),
  takeProfitLadder: fixtureUnresolved<BtcTakeProfitLadderViewModel>("UNAVAILABLE", {
    freshness: "Ladder indexer temporarily unavailable",
  }),
};
