// src/app/(product)/btc/_data/btc-page-fixtures.ts
//
// Fixtures for the page-scoped EXTRA blocks (see btc-page-types.ts). Mirrors
// the shape/conventions of `features/investor-ui/fixtures/factories.ts`
// (fixtureBlock/fixtureUnresolved) without importing it directly, since that
// module is internal to A5's fixtures directory — this file builds the same
// envelope locally to stay decoupled while the contract is still page-scoped.
//
// PROMPT 236 — BTC-only accumulation ledger. No trajectory / p5-p50-p95 bands /
// take-profit ladder here: those were retired from the investor surface. The
// blocks below feed: attributed BTC (hero), production (accumulation chart +
// sources), the BTC movement ledger (events), custody + proofs.

import { resolved, type ResolvedViewModel } from "@/features/investor-ui/types/common";
import type {
  BtcAttributionViewModel,
  BtcCustodyViewModel,
  BtcEventViewModel,
  BtcPageExtraViewModel,
  BtcProductionViewModel,
  BtcProofRefViewModel,
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

export const btcPageExtraCompleteFixture: BtcPageExtraViewModel = {
  attribution: fixtureBlock<BtcAttributionViewModel>({
    // Investor's economic BTC share — a per-holder position (like a portfolio
    // balance), not a fleet metric. Simulated until the vault ships.
    attributedBtcSats: "18420500", // 0.184205 BTC
    attributedBtcUsd: "18421",
    lastVerifiedAt: "2026-07-01T00:00:00.000Z",
  }),
  production: fixtureBlock<BtcProductionViewModel>({
    monthly: PRODUCTION_MONTHLY,
    cumulativeSatsEarned: "280000000",
    cumulativeBtcEarned: "2.80000000",
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
      deltaSats: "51700000",
      source: "Mining",
      status: "verified",
      detail: "June fleet production settled into the BTC reserve pouch.",
      txHash: "0x8f2a...c19e",
      proofHref: "/proof-center",
    },
    {
      type: "btc_purchase",
      label: "Reserve acquisition settled",
      occurredAt: "2026-06-28T00:00:00.000Z",
      deltaSats: "9100000",
      source: "Bitcoin Reserve",
      status: "verified",
      detail: "B2 pouch topped up from operating liquidity, per the reserve policy.",
      txHash: "0x1d90...44ab",
      proofHref: "/proof-center",
    },
    {
      type: "operational_conversion",
      label: "Operational conversion",
      occurredAt: "2026-06-15T00:00:00.000Z",
      deltaSats: "-3200000",
      source: "Operations",
      status: "confirmed",
      detail: "Portion converted to cover the monthly electricity settlement.",
      txHash: "0x77c3...9f10",
      proofHref: "/proof-center",
    },
    {
      type: "proof_of_reserve",
      label: "Proof-of-reserve attestation published",
      occurredAt: "2026-06-30T00:00:00.000Z",
      deltaSats: null,
      source: "Custody",
      status: "verified",
      detail: "Fireblocks vault account 86 attested against on-chain custody ledger.",
      txHash: null,
      proofHref: "/proof-center",
    },
    {
      type: "custody_attestation",
      label: "Custody attestation refreshed",
      occurredAt: "2026-06-01T00:00:00.000Z",
      deltaSats: null,
      source: "Custody",
      status: "verified",
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
  attribution: fixtureUnresolved<BtcAttributionViewModel>("NOT_CONFIGURED", {
    freshness: "PermissionedDynaVault v2.1 not deployed",
  }),
  production: fixtureUnresolved<BtcProductionViewModel>("NOT_CONFIGURED", {
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
  attribution: {
    ...btcPageExtraCompleteFixture.attribution,
    status: "STALE",
    freshness: "last indexed 6 days ago",
  },
  production: {
    ...btcPageExtraCompleteFixture.production,
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
};
