// gpu1-backend/src/application/dashboard.ts
//
// Composes the aggregated DashboardDTO. GPU1 owns this composition — the frontend
// makes ONE call and renders. Honesty rules:
//   • DB-backed facts (identity, position, distributions, activity, proofs) →
//     LIVE when a record exists, PARTIAL when the investor record is absent.
//   • Product constants (allocation targets 4000/2700/3300 bps, 24-month term,
//     minimum deposit, subscription rules) → provenance "manual", status LIVE.
//     These are real constants, not fabricated readings.
//   • Contract-owned facts (capacity, reserve, mining, performance, rebalancing,
//     engine, actual allocation bps, AI experts feed) → NOT_CONFIGURED until the
//     v2 contract is deployed + indexed.
// Invariants: UNKNOWN ≠ 0 (unknown → value:null + non-LIVE status, never 0), no
// fixture fallback, availableCapacity computed HERE (never fabricated).
import type {
  ActivityItem,
  AiExpertsSummary,
  AlertItem,
  AllocationBreakdown,
  DashboardDTO,
  DataFreshness,
  DistributionSummary,
  InvestorIdentity,
  InvestorPosition,
  PerformanceSummary,
  ProofSummary,
  RebalancingSummary,
  Resolved,
  ReserveSummary,
  SubscriptionSummary,
  VaultCapacityBlock,
} from "../domain/index.js";
import type { VaultRepository } from "../persistence/vault-repository.js";
import { contractRuntime } from "./runtime.js";

// ── Freshness helpers ─────────────────────────────────────────────────────────

const FRESH_NOW = (nowMs: number): DataFreshness => ({
  asOf: new Date(nowMs).toISOString(),
  ageSeconds: 0,
  stale: false,
});

const FRESH_NONE: DataFreshness = { asOf: null, ageSeconds: null, stale: false };

/** Everything the contract owns is unavailable until v2 is deployed + indexed. */
function notConfigured<T>(): Resolved<T> {
  return {
    status: "NOT_CONFIGURED",
    value: null,
    provenance: "live",
    freshness: FRESH_NONE,
    reason: "dynavault_not_deployed",
  };
}

/** A resolved product constant — a REAL operator-entered constant, hence LIVE with
 *  provenance "manual". Not a fabricated reading. */
function manualLive<T>(value: T, nowMs: number): Resolved<T> {
  return { status: "LIVE", value, provenance: "manual", freshness: FRESH_NOW(nowMs) };
}

/** DB-backed value: LIVE when present, else the caller's degraded resolution. */
function dbLive<T>(value: T, nowMs: number): Resolved<T> {
  return { status: "LIVE", value, provenance: "db", freshness: FRESH_NOW(nowMs) };
}

function dbPartial<T>(reason: string): Resolved<T> {
  return { status: "PARTIAL", value: null, provenance: "db", freshness: FRESH_NONE, reason };
}

function dbUnavailable<T>(): Resolved<T> {
  return { status: "UNAVAILABLE", value: null, provenance: "db", freshness: FRESH_NONE, reason: "db_error" };
}

// ── Product constants (docs/VAULT_SPEC — Hearst Yield Vault v2, accumulation note).
// These are the real product terms. GPU1 is a standalone service (no cross-project
// imports, CLAUDE.md #11) so they live here as named constants, provenance "manual".

/** Target allocation of the 3 pockets in basis points — sums to 10000. */
const ALLOCATION_TARGET_BPS = { B1: 4000, B2: 2700, B3: 3300 } as const;
/** Minimum subscription ticket (USDC, 6dp decimal string). */
const MINIMUM_DEPOSIT_USDC = "250000";
/** Subscription is open in the current product state. */
const SUBSCRIPTION_OPEN = true;
/** Whitelist (KYC-gated) is required to subscribe. */
const WHITELIST_REQUIRED = true;

function allocationConstant(nowMs: number): Resolved<AllocationBreakdown> {
  const value: AllocationBreakdown = {
    pockets: [
      { pocket: "B1", label: "Mining Power", targetBps: ALLOCATION_TARGET_BPS.B1, actualBps: null },
      { pocket: "B2", label: "BTC Pouch", targetBps: ALLOCATION_TARGET_BPS.B2, actualBps: null },
      { pocket: "B3", label: "Reserve USDC", targetBps: ALLOCATION_TARGET_BPS.B3, actualBps: null },
    ],
    targetTotalBps:
      ALLOCATION_TARGET_BPS.B1 + ALLOCATION_TARGET_BPS.B2 + ALLOCATION_TARGET_BPS.B3,
  };
  return manualLive(value, nowMs);
}

/** Subscription summary — product rules are manual · LIVE. userEligible is DB-derived:
 *  KYC "approved" ⇒ eligible; unknown investor ⇒ null (honest, not false). */
function subscriptionSummary(
  identity: InvestorIdentity | null,
  nowMs: number,
): Resolved<SubscriptionSummary> {
  const userEligible =
    identity === null ? null : identity.kycStatus === "approved";
  const value: SubscriptionSummary = {
    subscriptionOpen: SUBSCRIPTION_OPEN,
    minimumDeposit: MINIMUM_DEPOSIT_USDC,
    whitelistRequired: WHITELIST_REQUIRED,
    userEligible,
  };
  return manualLive(value, nowMs);
}

/** Derived advisory alerts — honest, no forbidden words, no promises. Always LIVE
 *  (a derivation over known facts), value is the (possibly empty) alert list. */
function deriveAlerts(
  identity: InvestorIdentity | null,
  position: InvestorPosition | null,
  nowMs: number,
): Resolved<readonly AlertItem[]> {
  const alerts: AlertItem[] = [];
  if (identity === null) {
    alerts.push({ code: "no_investor_record", severity: "info", message: "No investor profile on file yet." });
  } else {
    if (identity.kycStatus !== "approved") {
      alerts.push({ code: "kyc_pending", severity: "notice", message: "KYC is not yet approved — subscription is gated until it clears." });
    }
    if (!identity.accredited) {
      alerts.push({ code: "accreditation_pending", severity: "notice", message: "Accreditation attestation is not yet on file." });
    }
    if (identity.walletAddress === null) {
      alerts.push({ code: "no_wallet", severity: "info", message: "No payment wallet connected yet." });
    }
  }
  if (position === null || position.positionsCount === 0) {
    alerts.push({ code: "no_position", severity: "info", message: "No active position — nothing is deployed yet." });
  }
  return { status: "LIVE", value: alerts, provenance: "db", freshness: FRESH_NOW(nowMs) };
}

// ── Contract-owned blocks — NOT_CONFIGURED until v2. availableCapacity is computed
// HERE from cap/assets; today both are null so it stays null (never fabricated).

function capacityBlock(): Resolved<VaultCapacityBlock> {
  // tvlCap / totalAssets are on-chain reads; until v2 they are unknown. The service
  // owns availableCapacity = max(cap - assets, 0) — but with both null it is null,
  // NEVER a fabricated 0. The whole block stays NOT_CONFIGURED.
  return notConfigured<VaultCapacityBlock>();
}

export interface DashboardDeps {
  readonly repo: VaultRepository;
  readonly nowMs: number;
}

export async function buildDashboard(userId: string, deps: DashboardDeps): Promise<DashboardDTO> {
  const { repo, nowMs } = deps;
  const runtime = contractRuntime();

  // ── DB-backed reads (each degrades independently; a DB error → UNAVAILABLE) ──
  let identityRow: InvestorIdentity | null = null;
  let identity: Resolved<InvestorIdentity>;
  try {
    identityRow = await repo.getInvestorIdentity(userId);
    identity =
      identityRow === null
        ? dbPartial<InvestorIdentity>("no_investor_record")
        : dbLive(identityRow, nowMs);
  } catch {
    identity = dbUnavailable<InvestorIdentity>();
  }

  let positionRow: InvestorPosition | null = null;
  let position: Resolved<InvestorPosition>;
  try {
    positionRow = await repo.getInvestorPosition(userId);
    position =
      positionRow === null
        ? dbPartial<InvestorPosition>("no_investor_record")
        : dbLive(positionRow, nowMs);
  } catch {
    position = dbUnavailable<InvestorPosition>();
  }

  let distributions: Resolved<DistributionSummary>;
  try {
    const d = await repo.getDistributions(userId);
    distributions =
      d === null
        ? dbPartial<DistributionSummary>("no_investor_record")
        : dbLive(d, nowMs);
  } catch {
    distributions = dbUnavailable<DistributionSummary>();
  }

  let activity: Resolved<readonly ActivityItem[]>;
  try {
    const a = await repo.getActivity(userId);
    activity =
      a === null
        ? dbPartial<readonly ActivityItem[]>("no_investor_record")
        : dbLive(a, nowMs);
  } catch {
    activity = dbUnavailable<readonly ActivityItem[]>();
  }

  let proofs: Resolved<ProofSummary>;
  try {
    const p = await repo.getProofSummary();
    proofs = dbLive(p, nowMs);
  } catch {
    proofs = dbUnavailable<ProofSummary>();
  }

  return {
    runtime,
    meta: { contract: runtime, generatedAt: new Date(nowMs).toISOString() },

    // DB-backed
    identity,
    position,
    distributions,
    activity,
    proofs,

    // Product constants (manual · LIVE)
    allocation: allocationConstant(nowMs),
    subscription: subscriptionSummary(identityRow, nowMs),

    // Derived
    alerts: deriveAlerts(identityRow, positionRow, nowMs),

    // Contract-owned — honest NOT_CONFIGURED until v2 is live behind GPU1.
    capacity: capacityBlock(),
    reserve: notConfigured<ReserveSummary>(),
    mining: notConfigured(),
    performance: notConfigured<PerformanceSummary>(),
    rebalancing: notConfigured<RebalancingSummary>(),
    engine: notConfigured(),
    aiExperts: notConfigured<AiExpertsSummary>(),

    // Retained surfaces (kept so existing consumers keep compiling).
    vault: notConfigured(),
    strategies: notConfigured(),
    recentEvents: notConfigured(),
  };
}
