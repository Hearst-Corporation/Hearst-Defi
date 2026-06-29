/**
 * canonical-allocation.ts — the SINGLE source of truth for a constructed
 * product's allocation.
 *
 * Every surface MUST read this object: the summary, the scenario cards, the
 * assumptions, the write-up, the wizard prefill, and the raw JSON. No surface
 * may re-derive a weight from a yield mix or from the raw allocator. This kills
 * the class of bug where the wizard/summary showed `mining 2.92%` while the
 * scenario cards showed `mining 30%` — there is now ONE allocation, and it
 * carries its own provenance + the raw output that the product guard rejected.
 *
 * The product floor guard is the heart of it: for the BTC Mining Performance
 * Vault, mining in NORMAL mode is NEVER displayed below the 30% structural
 * floor. A raw allocator output that wants <30% mining is REJECTED (kept only as
 * a debug artifact) and the canonical mining weight is clamped to the floor and
 * flagged as a governance exception.
 *
 * PURE: no I/O, no Date.now(), no Math.random(), no server imports.
 */

import { BTC_MINING_PERFORMANCE_VAULT } from "./btc-mining-performance-vault";
import {
  clampToFloorOrFlag,
  MINING_FLOOR,
  type MiningFloorMode,
} from "./guards";
import type { LiveProvenance } from "@/lib/agentic/swarm/live/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The id of the BTC Mining product — the only product that carries the floor. */
export const BTC_MINING_PRODUCT_ID = BTC_MINING_PERFORMANCE_VAULT.id;

/** A raw, pre-guard allocation that the product floor guard rejected. Debug only. */
export interface RawAllocationDebug {
  /** Percent sleeves (product vocabulary). */
  mining: number;
  btcHoldingCollateral: number;
  stableReserve: number;
  yieldOverlay: number;
  /** Stable machine reason the raw output was rejected. */
  reason: string;
}

/**
 * The canonical allocation, in the product's four-sleeve vocabulary. Percent
 * values sum to ~100. EVERY consumer reads this — never the raw allocator or a
 * yield mix.
 */
export interface CanonicalAllocation {
  productId: string;
  productName: string;
  /** Mining floor sleeve (percent). Never < 30 for the mining product in NORMAL. */
  mining: number;
  /** BTC holding / collateral sleeve (percent). */
  btcHoldingCollateral: number;
  /** Stable funding reserve sleeve (percent). */
  stableReserve: number;
  /** Yield overlay sleeve (percent) — excess liquidity only. */
  yieldOverlay: number;
  /** Mining as a fraction in [0,1] — the Monte-Carlo weight. */
  miningFraction: number;
  /** True when the mining weight was clamped up to the floor / flagged. */
  governanceException: boolean;
  /** Provenance of the live inputs the allocation was derived from. */
  provenance: LiveProvenance;
  /** Raw allocator output rejected by the product floor guard — debug only. */
  rawRejected: RawAllocationDebug | null;
  /** The product's CONFIGURED sleeve bands (reference), percent. */
  bands: {
    mining: readonly [number, number];
    btcHoldingCollateral: readonly [number, number];
    stableReserve: readonly [number, number];
    yieldOverlay: readonly [number, number];
  };
}

export interface ProductIdentity {
  id: string;
  name: string;
  ticker: string;
}

// ---------------------------------------------------------------------------
// Product identity
// ---------------------------------------------------------------------------

/** True when the objective is asking for a BTC mining product (not a yield vault). */
export function isBtcMiningObjective(
  objective: string | undefined | null,
): boolean {
  const s = (objective ?? "").toLowerCase();
  if (s.length === 0) return false;
  return (
    /\bbtc[\s-]*mining\b/.test(s) ||
    /\bbitcoin[\s-]*mining\b/.test(s) ||
    /\bmining[\s-]*(vault|performance)\b/.test(s) ||
    /\bhashprice\b/.test(s) ||
    /\b(miner|miners|asic|hashrate)\b/.test(s) ||
    /\bmining\b/.test(s)
  );
}

/**
 * Resolve the product identity for an objective. For a BTC mining objective this
 * returns the canonical "BTC Mining Performance Vault" — never the generic
 * "Hearst Yield Vault". Returns null when the objective is not mining-related
 * (the caller then falls back to its generic vault inference).
 */
export function resolveProductIdentity(
  objective: string | undefined | null,
): ProductIdentity | null {
  if (isBtcMiningObjective(objective)) {
    return {
      id: BTC_MINING_PERFORMANCE_VAULT.id,
      name: BTC_MINING_PERFORMANCE_VAULT.name, // "BTC Mining Performance Vault"
      ticker: "HBMP",
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Floor guard
// ---------------------------------------------------------------------------

export interface ProductFloorDecision {
  /** Canonical mining weight (fraction), clamped to the floor in NORMAL. */
  miningFractionCanonical: number;
  /** True when the raw weight was below the floor and the guard rejected it. */
  rejected: boolean;
  /** True when the canonical weight is a flagged governance exception. */
  governanceException: boolean;
  /** Stable machine reason. */
  reason: string;
}

/**
 * Enforce the product's mining floor on a RAW mining percentage. For the BTC
 * Mining product, a raw weight below 30% in NORMAL mode is rejected and clamped
 * up to the floor. Non-mining products carry no floor (the weight passes through).
 *
 * Pure. `rawMiningPct` is a percent (0..100).
 */
export function enforceProductMiningFloor(
  rawMiningPct: number,
  productId: string,
  mode: MiningFloorMode = "NORMAL",
): ProductFloorDecision {
  const isMiningProduct = productId === BTC_MINING_PERFORMANCE_VAULT.id;
  const rawFraction =
    Number.isFinite(rawMiningPct) && rawMiningPct > 0 ? rawMiningPct / 100 : 0;

  if (!isMiningProduct) {
    return {
      miningFractionCanonical: rawFraction,
      rejected: false,
      governanceException: false,
      reason: "non_mining_product_no_floor",
    };
  }

  const clamp = clampToFloorOrFlag(rawFraction, mode);
  const rejected = rawFraction < MINING_FLOOR && mode === "NORMAL";
  const floorPct = Math.round(MINING_FLOOR * 100);
  return {
    miningFractionCanonical: clamp.miningPct,
    rejected,
    governanceException: clamp.flagged,
    reason: rejected
      ? `raw mining ${rawMiningPct.toFixed(2)}% below ${floorPct}% product floor — clamped to floor`
      : clamp.reason,
  };
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/** Product sleeve bands (percent), read from the typed product constant. */
function productBands(): CanonicalAllocation["bands"] {
  const a = BTC_MINING_PERFORMANCE_VAULT.allocation;
  return {
    mining: [a.mining.min * 100, a.mining.max * 100],
    btcHoldingCollateral: [
      a.btcHoldingCollateral.min * 100,
      a.btcHoldingCollateral.max * 100,
    ],
    stableReserve: [
      a.stableFundingReserve.min * 100,
      a.stableFundingReserve.max * 100,
    ],
    yieldOverlay: [a.yieldOverlay.min * 100, a.yieldOverlay.max * 100],
  };
}

/**
 * Build the canonical allocation from the floor-ENFORCED sleeves (the balanced
 * scenario) and, optionally, the RAW pre-guard sleeves (so the rejected output
 * can be shown in a debug section, never as a normal allocation).
 *
 * Pure. The enforced sleeves are percent; raw sleeves are percent.
 */
export function buildCanonicalAllocation(args: {
  productId: string;
  productName: string;
  enforced: {
    mining: number;
    btcHoldingCollateral: number;
    stableReserve: number;
    yieldOverlay: number;
    miningFraction: number;
    governanceException: boolean;
    provenance: LiveProvenance;
  };
  raw?: {
    mining: number;
    btcHoldingCollateral: number;
    stableReserve: number;
    yieldOverlay: number;
  } | null;
  mode?: MiningFloorMode;
}): CanonicalAllocation {
  const mode = args.mode ?? "NORMAL";

  let rawRejected: RawAllocationDebug | null = null;
  if (args.raw) {
    const decision = enforceProductMiningFloor(args.raw.mining, args.productId, mode);
    if (decision.rejected) {
      rawRejected = {
        mining: round2(args.raw.mining),
        btcHoldingCollateral: round2(args.raw.btcHoldingCollateral),
        stableReserve: round2(args.raw.stableReserve),
        yieldOverlay: round2(args.raw.yieldOverlay),
        reason: decision.reason,
      };
    }
  }

  return {
    productId: args.productId,
    productName: args.productName,
    mining: round2(args.enforced.mining),
    btcHoldingCollateral: round2(args.enforced.btcHoldingCollateral),
    stableReserve: round2(args.enforced.stableReserve),
    yieldOverlay: round2(args.enforced.yieldOverlay),
    miningFraction: args.enforced.miningFraction,
    governanceException: args.enforced.governanceException,
    provenance: args.enforced.provenance,
    rawRejected,
    bands: productBands(),
  };
}

/**
 * Assert the canonical allocation honours the product floor in NORMAL mode.
 * Returns the list of violations (empty = ok). Used by the orchestration
 * diagnostic + tests so a regression is caught, never shipped.
 */
export function assertCanonicalFloor(
  alloc: CanonicalAllocation,
  mode: MiningFloorMode = "NORMAL",
): string[] {
  const violations: string[] = [];
  if (alloc.productId !== BTC_MINING_PERFORMANCE_VAULT.id) return violations;
  const floorPct = MINING_FLOOR * 100;
  if (mode === "NORMAL" && alloc.mining < floorPct - 1e-6) {
    violations.push(
      `canonical mining ${alloc.mining}% below ${floorPct}% floor in NORMAL mode`,
    );
  }
  if (alloc.rawRejected && alloc.rawRejected.mining >= floorPct) {
    violations.push(
      "rawRejected carries a mining weight at/above the floor — it was not actually sub-floor",
    );
  }
  return violations;
}
