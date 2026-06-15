import "server-only";

import { prisma } from "@/lib/db";
import { loadCustody } from "@/lib/data/custody";
import { evaluateFreshness, type FreshnessKind } from "@/lib/data/freshness";
import { canRunDemoProvider } from "@/lib/demo/guard";
import { buildDemoAdminOverview } from "@/lib/demo/admin/overview";

// ---------------------------------------------------------------------------
// Admin command-center overview contract.
//
// Read-only aggregation for `src/app/admin/dashboard/page.tsx`. Pure Prisma
// `count`/`findFirst` reads + the existing custody loader — no schema change,
// no new endpoint, no data-contract change. Every count is a real query; when
// a domain has no data pipeline wired yet (subscriptions, wallet exceptions)
// the item is flagged `tracked: false` so the UI renders an honest empty state
// instead of a misleading "0 pending" (CLAUDE.md: never present absent data as
// real). Mirrors the Decimal→number / honest-fallback discipline of
// `src/lib/data/dashboard.ts`.
// ---------------------------------------------------------------------------

/**
 * A mining attestation is "current" within ~35 days (monthly cadence). Past
 * that window the latest evidence reads as stale rather than live — longer than
 * the 5-minute price SLO, so it gets its own constant here rather than abusing
 * the `STALE_THRESHOLDS` price registry.
 */
const ATTESTATION_FRESH_MS = 35 * 24 * 60 * 60 * 1000;

/** Governance states that require an admin to act (sign or execute). */
const GOVERNANCE_ACTIONABLE_STATES = ["SIGNING", "EXECUTABLE"] as const;

export type AdminActionKey =
  | "kyc"
  | "distributions"
  | "documents"
  | "governance"
  | "subscriptions"
  | "wallet";

export interface AdminActionItem {
  key: AdminActionKey;
  /** Human label for the queue row. */
  label: string;
  /** Count of items awaiting admin action. `0` when clear. */
  count: number;
  /** Deep-link to the admin surface that resolves these items, or null. */
  href: string | null;
  /**
   * `true` when a real data pipeline backs this count. `false` when the domain
   * has no source wired yet (the count is structurally 0, not "all clear") —
   * the UI shows an honest "not yet tracked" state instead of a green zero.
   */
  tracked: boolean;
  /** Short microcopy describing the state. */
  hint: string;
}

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
  /** Action queue rows, tracked sources first. */
  actions: AdminActionItem[];
  /** Sum of counts across TRACKED domains only — the headline "action required". */
  totalActionRequired: number;
  proof: AdminProofStatus;
}

/**
 * Loads the admin command-center overview. Never throws on empty data — every
 * count degrades to 0, custody degrades to a manual snapshot. Safe to call
 * inside the dashboard's parallel `Promise.all`.
 */
export async function loadAdminOverview(): Promise<AdminOverview> {
  if (canRunDemoProvider()) return buildDemoAdminOverview();

  const [
    kycPending,
    distributionsPending,
    documentsPending,
    governanceActionable,
    subscriptionsPending,
    latestMiningAttestation,
    attestationsCount,
    proofsTotal,
    custody,
  ] = await Promise.all([
    prisma.investor.count({ where: { kycStatus: "pending" } }),
    prisma.distribution.count({ where: { status: "pending" } }),
    prisma.subscriptionEnvelope.count({
      where: { status: { in: ["sent", "delivered"] } },
    }),
    prisma.governanceProposal.count({
      where: { state: { in: [...GOVERNANCE_ACTIONABLE_STATES] } },
    }),
    prisma.subscription.count({ where: { status: "pending" } }),
    prisma.proof.findFirst({
      where: { proofType: "mining_attestation" },
      orderBy: { postedAt: "desc" },
      select: { postedAt: true },
    }),
    prisma.proof.count({ where: { proofType: "mining_attestation" } }),
    prisma.proof.count(),
    loadCustody(),
  ]);

  const actions: AdminActionItem[] = [
    {
      key: "kyc",
      label: "KYC reviews",
      count: kycPending,
      href: "/admin/customers",
      tracked: true,
      hint:
        kycPending > 0
          ? `${kycPending} investor${kycPending > 1 ? "s" : ""} awaiting verification`
          : "All investors verified",
    },
    {
      key: "distributions",
      label: "Distributions",
      count: distributionsPending,
      href: "/admin/distributions",
      tracked: true,
      hint:
        distributionsPending > 0
          ? "Awaiting multisig confirmation"
          : "No distribution pending approval",
    },
    {
      key: "documents",
      label: "Subscription documents",
      count: documentsPending,
      href: "/admin/customers",
      tracked: true,
      hint:
        documentsPending > 0
          ? "Envelopes sent, awaiting signature"
          : "No envelope awaiting signature",
    },
    {
      key: "governance",
      label: "Governance",
      count: governanceActionable,
      href: "/admin/governance",
      tracked: true,
      hint:
        governanceActionable > 0
          ? "Proposals to sign or execute"
          : "No proposal needs action",
    },
    {
      key: "subscriptions",
      // Subscription model exists but no flow creates rows yet (Phase 2+).
      // Surfaced as untracked so the zero never reads as "all settled".
      label: "Subscription intents",
      count: subscriptionsPending,
      href: null,
      tracked: false,
      hint: "Pipeline not wired yet",
    },
    {
      key: "wallet",
      // No model tracks wallet-connection exceptions — honest "not tracked".
      label: "Wallet exceptions",
      count: 0,
      href: null,
      tracked: false,
      hint: "Not tracked — manual audit",
    },
  ];

  const totalActionRequired = actions
    .filter((a) => a.tracked)
    .reduce((sum, a) => sum + a.count, 0);

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

  return { actions, totalActionRequired, proof };
}
