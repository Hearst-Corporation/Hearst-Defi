// src/lib/vaults/profile.ts
//
// VaultProfile — a unified projection type that can represent either an engine
// fixture (VaultDefinition) or a Prisma VaultDeployment row. The shape mirrors
// VaultDefinition exactly but widens `id` to `string` so deployment ticker-slugs
// (e.g. "hyv-a") are accepted without casting. No I/O, no DB, no Date.now(),
// no Math.random() — engine purity rule #6.

import type { VaultDeployment } from "@prisma/client";
import type { VaultMode } from "@/lib/engine/types";
import type {
  VaultDefinition,
  ApyTargetRange,
  AllocationTargets,
  Provenance,
} from "@/lib/engine/vaults";
import type { ShareClassTerms } from "@/lib/engine/share-class";
import type { VaultRef } from "@/lib/vaults/types";

// ---------------------------------------------------------------------------
// VaultProfile — VaultDefinition with id widened to string
// ---------------------------------------------------------------------------

export interface VaultProfile {
  /** URL-safe identifier. Fixtures: VaultId ("yield" / "defensive" / "btc-plus").
   *  Deployments: lowercased ticker slug (e.g. "hyv-a"). */
  id: string;
  ticker: string;
  label: string;
  description: string;
  apyTarget: ApyTargetRange;
  baseMode: VaultMode;
  allocationTargets: AllocationTargets;
  shareClasses: ShareClassTerms[];
  defaultProvenance: Provenance;
  methodologyVersion: string;
  assumptions: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Basis-points divisor for converting bps columns to percent (100 bps = 1%). */
const BPS_PER_PERCENT = 100;

// ---------------------------------------------------------------------------
// Strategy → baseMode mapping
// ---------------------------------------------------------------------------

function strategyToMode(strategy: string): VaultMode {
  if (strategy === "mining_yield") return "balanced";
  if (strategy === "btc_tactical") return "opportunistic";
  if (strategy === "stable_reserve") return "defensive";
  // Default: unknown strategy maps to balanced (most permissive mid-ground).
  return "balanced";
}

// ---------------------------------------------------------------------------
// Deployment row → VaultProfile
//
// Conversion rules (bps → percent):
//   apyTarget.low  = targetApyLowBps  / 100
//   apyTarget.high = targetApyHighBps / 100
//   allocation.X   = targetXBps       / 100
//
// Decimal fields (Prisma): use .toNumber() — only toNumber() is consumed here.
// ---------------------------------------------------------------------------

function deploymentToProfile(deployment: VaultDeployment): VaultProfile {
  // Data integrity guards — these invariants are also enforced upstream by the
  // Zod schema in vaults/actions.ts, but we re-check here so that any corrupt
  // row (direct DB write, migration slip) is caught at the pure-function
  // boundary rather than silently producing an invalid profile.
  if (deployment.targetApyHighBps <= deployment.targetApyLowBps) {
    throw new Error(
      `VaultDeployment "${deployment.ticker}": targetApyHighBps (${deployment.targetApyHighBps}) must be > targetApyLowBps (${deployment.targetApyLowBps})`,
    );
  }
  const allocationSum =
    deployment.targetMiningBps +
    deployment.targetBtcTacticalBps +
    deployment.targetUsdcBaseBps +
    deployment.targetStableReserveBps;
  if (allocationSum !== 10_000) {
    throw new Error(
      `VaultDeployment "${deployment.ticker}": allocation bps must sum to 10000, got ${allocationSum}`,
    );
  }

  const id = deployment.ticker.toLowerCase();
  const ticker = deployment.ticker.toUpperCase();

  const apyTarget: ApyTargetRange = {
    low: deployment.targetApyLowBps / BPS_PER_PERCENT,
    high: deployment.targetApyHighBps / BPS_PER_PERCENT,
  };

  const allocationTargets: AllocationTargets = {
    mining: deployment.targetMiningBps / BPS_PER_PERCENT,
    btc_tactical: deployment.targetBtcTacticalBps / BPS_PER_PERCENT,
    usdc_base: deployment.targetUsdcBaseBps / BPS_PER_PERCENT,
    stable_reserve: deployment.targetStableReserveBps / BPS_PER_PERCENT,
  };

  // ShareClassTerms built from the deployment's fee columns. The Prisma row
  // carries a single shareClass string (e.g. "A"), so we produce a 1-element
  // array. Fields not tracked per-deployment use defaults:
  //   - softLockupDays: deployment.softLockupDays (present in schema)
  //   - hurdleBps: deployment.hurdleBps (present in schema, default 0)
  //   - minTicketUsdc: deployment.minTicketUsdc (Decimal → .toNumber())
  const shareClasses: ShareClassTerms[] = [
    {
      shareClass: deployment.shareClass,
      // Decimal → number at the data boundary.
      minTicketUsdc: deployment.minTicketUsdc.toNumber(),
      softLockupDays: deployment.softLockupDays,
      mgmtFeeBps: deployment.mgmtFeeBps,
      perfFeeBps: deployment.perfFeeBps,
      hurdleBps: deployment.hurdleBps,
    },
  ];

  const lockupDays = deployment.softLockupDays;
  const strategyLabel = deployment.strategy.replace(/_/g, " ");

  // Forbidden-words linter (#5): never use guarantee/promise/certain/will deliver/risk-free.
  // "not guaranteed" is the allowed pattern per CLAUDE.md rule #8.
  //
  // Copy tracks methodology v3.0 (the mining note, ADR-019): the note accrues
  // BTC over its term and settles at maturity — §2 "There is no periodic cash
  // distribution and no fixed APY" — and the soft lock-up is contractual /
  // applicative, "the contract does not enforce a minDeposit or a lock-up".
  // The distribution layer is retired platform-wide (ADR-019 §Consequences),
  // so no deployment can assert distribution terms.
  const assumptions: string[] = [
    `Strategy: ${strategyLabel}; allocations target the configured pocket mix.`,
    `${lockupDays}-day soft lock-up applies contractually and is not enforced on-chain.`,
    "Return accrues as BTC accumulated over the term and settled at maturity; there is no periodic cash distribution.",
    "Outputs are projections, not guaranteed. Past performance does not predict future results.",
  ];

  return {
    id,
    ticker,
    label: deployment.name,
    description: deployment.description ?? "Custom deployment",
    apyTarget,
    baseMode: strategyToMode(deployment.strategy),
    allocationTargets,
    shareClasses,
    defaultProvenance: "estimated",
    // Active methodology for the current product (ADR-019). The engine fixtures
    // in `src/lib/engine/vaults.ts` carry the same version; v1.0 stays reserved
    // for re-citing an output actually produced under it.
    methodologyVersion: "v3.0",
    assumptions,
  };
}

// ---------------------------------------------------------------------------
// toVaultProfile — public bridge function
// ---------------------------------------------------------------------------

/**
 * Converts a {@link VaultRef} into a {@link VaultProfile}.
 *
 * - Fixture ref: the `VaultDefinition` shape is already compatible; only `id`
 *   is widened from `VaultId` (a branded string union) to `string` — no data
 *   transforms needed.
 * - Deployment ref: each Prisma column is mapped explicitly onto the profile
 *   shape. Decimal financial fields are converted via `.toNumber()` at this
 *   boundary so downstream consumers never see `Prisma.Decimal`.
 *
 * This function is pure: no I/O, no side effects, no clock access.
 */
export function toVaultProfile(ref: VaultRef): VaultProfile {
  if (ref.kind === "fixture") {
    // Cast: VaultDefinition is structurally identical to VaultProfile; the only
    // difference is `id: VaultId` (a string subtype) vs `id: string`. Returning
    // the fixture object directly satisfies the profile contract — no copy needed.
    const def: VaultDefinition = ref.fixture;
    return def as VaultProfile;
  }

  if (ref.kind === "deployment") {
    return deploymentToProfile(ref.deployment);
  }

  // Exhaustiveness check — TypeScript narrows `ref` to `never` here.
  // If a new `kind` is ever added to VaultRef, this line becomes a compile error.
  const _exhaustive: never = ref;
  throw new Error(`Unknown vault ref kind: ${JSON.stringify(_exhaustive)}`);
}

