/**
 * dynavault-factsheet.ts — the product parameters of PermissionedDynaVault v2.1
 * ("the factsheet").
 *
 * ── Why this module exists ───────────────────────────────────────────────────
 * These numbers are PRODUCT CONSTANTS, not chain data. They are transcribed
 * from the v2.1 interface spec so a route can serve them TODAY, while the
 * contract does not exist yet. Every one of them is therefore emitted with
 * `provenance: "manual"` — never "live". A constant that pretends to be a chain
 * read is exactly the silent lie this repo forbids.
 *
 * ── The cutover is designed in, not bolted on ────────────────────────────────
 * Once PermissionedDynaVault v2.1 is deployed, `productDurationMonths()`,
 * `vendingCurveBps(month)`, the allocation bps and the curtailment thresholds
 * become READABLE ON-CHAIN. `buildDynavaultFactsheet` already prefers the chain:
 * pass the corresponding `Wired<T>` reads in `options.chain` and each field flips
 * to `provenance: "live"`. A chain read that FAILED does not silently fall back
 * to the constant unannounced — the constant is served AND the field carries
 * `chainUnavailableReason`, so an RPC outage stays discernible from an absence
 * of data.
 *
 * ── Purity ───────────────────────────────────────────────────────────────────
 * No I/O, no prisma, no fetch, no clock: `now` is injected. This module is not
 * `server-only` on purpose — it is a pure data module, unit-testable without a
 * chain, a DB, or an RSC environment.
 *
 * ── Deliberately NOT decided here ────────────────────────────────────────────
 * `ChainRead<T>` is a STRUCTURAL type, not an import of `Wired<T>` from
 * `@/lib/chain/dynavault`. A `Wired<T>` is assignable to it as-is (same
 * `status` / `data` shape), but this module stays free of the chain adapter —
 * so the pure test suite never needs an RPC, an env var, or viem.
 *
 * ── THE ASSET IS USDC ────────────────────────────────────────────────────────
 * The v2.1 spec says "USDT" in places and "USDC" in others. That contradiction
 * is settled: it is USDC, 6 decimals — matching the asset of the deployed vault
 * (0x036CbD53…, Base Sepolia). The word USDT appears nowhere in this codebase.
 */

import type { Provenance } from "@/lib/engine/vaults";

export const DYNAVAULT_CONTRACT_NAME = "PermissionedDynaVault";
export const DYNAVAULT_SPEC_VERSION = "2.1";

/**
 * Provenance trace for every hand-transcribed value below.
 *
 * ⚠️ The spec document itself is NOT in this repo — these values were dictated
 * with the work order. They are UNVERIFIED against a committed source. When the
 * spec lands in `docs/`, point this string at the committed path.
 */
const SPEC_SOURCE = "SMART_CONTRACT_INTERFACE.md v2.1 §Appendix";

const CHAIN_SOURCE = `on-chain read — ${DYNAVAULT_CONTRACT_NAME} v${DYNAVAULT_SPEC_VERSION}`;

/**
 * The vault's asset. 6 decimals is a property of USDC on every chain; the
 * canonical constant lives in `@/lib/chain/dynavault` (`USDC_DECIMALS`), which
 * also reads `asset()` from the chain so a mismatch is observable rather than
 * assumed. It is restated here only to keep this module pure and chain-free.
 */
export const DYNAVAULT_ASSET = { symbol: "USDC", decimals: 6 } as const;

// ---------------------------------------------------------------------------
// Spec constants — Source: SMART_CONTRACT_INTERFACE.md v2.1 §Appendix
// ---------------------------------------------------------------------------

/** B1 — mining pocket target allocation. Source: v2.1 §Appendix. */
export const B1_MINING_ALLOCATION_BPS = 4_000;

/** B2 — BTC pocket target allocation. Source: v2.1 §Appendix. */
export const B2_BTC_ALLOCATION_BPS = 2_700;

/** B3 — USDC pocket target allocation. Source: v2.1 §Appendix. */
export const B3_USDC_ALLOCATION_BPS = 3_300;

/** A whole allocation, in bps. B1 + B2 + B3 must equal this. */
export const ALLOCATION_TOTAL_BPS = 10_000;

/** Monthly electricity cost, USD. Source: v2.1 §Appendix. */
export const MONTHLY_ELECTRICITY_COST_USD = 16_408;

/** Redemption cooldown, days. Source: v2.1 §Appendix. */
export const REDEMPTION_COOLDOWN_DAYS = 30;

/**
 * Curtailment threshold BEFORE the halving, USD. Source: v2.1 §Appendix.
 *
 * ⚠️ SEMANTICS UNCONFIRMED. The spec gives the figure, not the predicate: what
 * this threshold is compared against (monthly mining revenue? BTC price?
 * hashprice-implied revenue?) is not stated. It is surfaced as a labelled
 * number with an explicit note — never as a computed decision.
 */
export const CURTAILMENT_THRESHOLD_PRE_HALVING_USD = 35_968;

/** Curtailment threshold AFTER the halving, USD. Same UNCONFIRMED caveat. */
export const CURTAILMENT_THRESHOLD_POST_HALVING_USD = 72_318;

/** Month index at which the halving lands, within the product term. v2.1 §Appendix. */
export const HALVING_MONTH = 21;

/** Product term, months. Mirrors `productDurationMonths()` on-chain. v2.1 §Appendix. */
export const PRODUCT_DURATION_MONTHS = 24;

/**
 * The repo's canonical disclaimer (identical wording to `engine/vaults.ts`, so
 * the compliance guard sees a string it already clears).
 */
export const FACTSHEET_DISCLAIMER =
  "Outputs are projections, not guaranteed. Past performance does not predict future results.";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Structural mirror of `Wired<T>` (`@/lib/chain/dynavault`). A `Wired<T>` is
 * assignable to this without a cast; this module never imports the adapter.
 */
export type ChainRead<T> =
  | { status: "wired"; data: T }
  | { status: "unavailable"; reason?: string };

/** A parameter that HAS a spec constant, and may be overridden by the chain. */
export interface FactsheetField<T> {
  value: T;
  /** "live" only when the value came off the chain. Otherwise "manual". */
  provenance: Provenance;
  source: string;
  /**
   * Set when a chain read was attempted and did NOT succeed. The constant is
   * still served, but the failure is stated — an outage never masquerades as a
   * clean manual value.
   */
  chainUnavailableReason?: string;
}

/**
 * A parameter with NO spec constant to fall back on (the appendix does not give
 * it). It is chain-only: either read, or honestly unavailable. There is no
 * third state and no invented default.
 */
export type FactsheetChainOnlyField<T> =
  | { status: "available"; value: T; provenance: Provenance; source: string }
  | { status: "unavailable"; reason: string };

export type FactsheetDeploymentMode = "v2" | "legacy" | "not_configured";

export interface FactsheetDeployment {
  mode: FactsheetDeploymentMode;
  chainId: number;
  /** The address actually pointed at, or null when nothing is configured. */
  address: string | null;
}

/** Chain reads the caller may supply. Every one is optional and may fail. */
export interface FactsheetChainReads {
  miningAllocationBps?: ChainRead<number>;
  btcAllocationBps?: ChainRead<number>;
  usdcAllocationBps?: ChainRead<number>;
  monthlyElectricityCostUsd?: ChainRead<number>;
  productDurationMonths?: ChainRead<number>;
  halvingMonth?: ChainRead<number>;
  redemptionCooldownDays?: ChainRead<number>;
  curtailmentPreHalvingUsd?: ChainRead<number>;
  curtailmentPostHalvingUsd?: ChainRead<number>;
  /** `vendingCurveBps(month)` — no spec constant exists for the curve. */
  vendingCurveBps?: ChainRead<readonly number[]>;
  /** `tvlCap()` — uint256, carried as a decimal string (no bigint in JSON). */
  tvlCapUsdc?: ChainRead<string>;
}

export interface DynavaultFactsheet {
  status: "ok";
  contract: {
    name: string;
    specVersion: string;
    /** false until NEXT_PUBLIC_DYNAVAULT_ADDRESS points at a live v2.1 vault. */
    deployed: boolean;
    mode: FactsheetDeploymentMode;
    chainId: number;
    address: string | null;
  };
  asset: { symbol: string; decimals: number };
  allocation: {
    b1MiningBps: FactsheetField<number>;
    b2BtcBps: FactsheetField<number>;
    b3UsdcBps: FactsheetField<number>;
    /** Sum of the three RESOLVED values — recomputed, never assumed. */
    totalBps: number;
    /** false ⇒ the three resolved values do not make a whole. Visible, not hidden. */
    consistent: boolean;
  };
  economics: {
    monthlyElectricityCostUsd: FactsheetField<number>;
  };
  lifecycle: {
    productDurationMonths: FactsheetField<number>;
    halvingMonth: FactsheetField<number>;
    redemptionCooldownDays: FactsheetField<number>;
  };
  curtailment: {
    preHalvingThresholdUsd: FactsheetField<number>;
    postHalvingThresholdUsd: FactsheetField<number>;
    note: string;
  };
  vendingCurveBps: FactsheetChainOnlyField<readonly number[]>;
  tvlCapUsdc: FactsheetChainOnlyField<string>;
  apyTarget: { status: "not_applicable"; note: string };
  assumptions: readonly string[];
  disclaimer: string;
  generatedAt: string;
}

export interface BuildFactsheetOptions {
  /** Injected clock — this module owns no `Date.now()`. */
  now: Date;
  deployment: FactsheetDeployment;
  chain?: FactsheetChainReads;
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

const UNKNOWN_CHAIN_REASON = "unknown";

/**
 * Chain wins when it answered. Otherwise the spec constant is served, marked
 * "manual" — and, if a read was attempted and failed, the failure is carried.
 */
function resolveField<T>(
  constant: T,
  chain: ChainRead<T> | undefined,
): FactsheetField<T> {
  if (chain !== undefined && chain.status === "wired") {
    return { value: chain.data, provenance: "live", source: CHAIN_SOURCE };
  }
  const base: FactsheetField<T> = {
    value: constant,
    provenance: "manual",
    source: SPEC_SOURCE,
  };
  if (chain !== undefined) {
    return { ...base, chainUnavailableReason: chain.reason ?? UNKNOWN_CHAIN_REASON };
  }
  return base;
}

/**
 * Why a chain-only parameter is absent, when no read was even attempted. The
 * reason vocabulary mirrors `UNAVAILABLE_REASONS` in `@/lib/chain/dynavault`.
 */
function absentReasonFor(mode: FactsheetDeploymentMode): string {
  if (mode === "not_configured") return "not_deployed";
  if (mode === "legacy") return "not_supported_by_legacy";
  return "not_wired_yet";
}

function resolveChainOnly<T>(
  chain: ChainRead<T> | undefined,
  mode: FactsheetDeploymentMode,
): FactsheetChainOnlyField<T> {
  if (chain === undefined) {
    return { status: "unavailable", reason: absentReasonFor(mode) };
  }
  if (chain.status === "wired") {
    return {
      status: "available",
      value: chain.data,
      provenance: "live",
      source: CHAIN_SOURCE,
    };
  }
  return { status: "unavailable", reason: chain.reason ?? UNKNOWN_CHAIN_REASON };
}

const CURTAILMENT_NOTE =
  "Thresholds are transcribed from the v2.1 appendix. The predicate they feed " +
  "(what is compared against them, and when) is not specified there and is not " +
  "inferred here: these are labelled figures, not a curtailment decision.";

const APY_NOTE =
  "PermissionedDynaVault v2.1 states no target APY: the model is BTC " +
  "accumulation, tiered take-profit and a vending curve, with no distribution " +
  "function on the contract. Any APY band shown elsewhere in this app belongs to " +
  "the superseded v1.0 Hearst Yield Vault model and does not describe this product. " +
  "No single-point APY is emitted here, and none is invented.";

/**
 * Builds the factsheet. Pure: same inputs ⇒ same output.
 *
 * With no `chain` reads supplied (today: the v2.1 contract is not deployed),
 * every field with a constant resolves "manual", and every chain-only field
 * resolves `unavailable` with the reason implied by the deployment mode.
 */
export function buildDynavaultFactsheet(
  options: BuildFactsheetOptions,
): DynavaultFactsheet {
  const { now, deployment } = options;
  const chain = options.chain;
  const mode = deployment.mode;

  const b1MiningBps = resolveField(B1_MINING_ALLOCATION_BPS, chain?.miningAllocationBps);
  const b2BtcBps = resolveField(B2_BTC_ALLOCATION_BPS, chain?.btcAllocationBps);
  const b3UsdcBps = resolveField(B3_USDC_ALLOCATION_BPS, chain?.usdcAllocationBps);
  const totalBps = b1MiningBps.value + b2BtcBps.value + b3UsdcBps.value;

  return {
    status: "ok",
    contract: {
      name: DYNAVAULT_CONTRACT_NAME,
      specVersion: DYNAVAULT_SPEC_VERSION,
      deployed: mode === "v2",
      mode,
      chainId: deployment.chainId,
      address: deployment.address,
    },
    asset: { symbol: DYNAVAULT_ASSET.symbol, decimals: DYNAVAULT_ASSET.decimals },
    allocation: {
      b1MiningBps,
      b2BtcBps,
      b3UsdcBps,
      totalBps,
      consistent: totalBps === ALLOCATION_TOTAL_BPS,
    },
    economics: {
      monthlyElectricityCostUsd: resolveField(
        MONTHLY_ELECTRICITY_COST_USD,
        chain?.monthlyElectricityCostUsd,
      ),
    },
    lifecycle: {
      productDurationMonths: resolveField(
        PRODUCT_DURATION_MONTHS,
        chain?.productDurationMonths,
      ),
      halvingMonth: resolveField(HALVING_MONTH, chain?.halvingMonth),
      redemptionCooldownDays: resolveField(
        REDEMPTION_COOLDOWN_DAYS,
        chain?.redemptionCooldownDays,
      ),
    },
    curtailment: {
      preHalvingThresholdUsd: resolveField(
        CURTAILMENT_THRESHOLD_PRE_HALVING_USD,
        chain?.curtailmentPreHalvingUsd,
      ),
      postHalvingThresholdUsd: resolveField(
        CURTAILMENT_THRESHOLD_POST_HALVING_USD,
        chain?.curtailmentPostHalvingUsd,
      ),
      note: CURTAILMENT_NOTE,
    },
    vendingCurveBps: resolveChainOnly(chain?.vendingCurveBps, mode),
    tvlCapUsdc: resolveChainOnly(chain?.tvlCapUsdc, mode),
    apyTarget: { status: "not_applicable", note: APY_NOTE },
    assumptions: [
      `Product parameters transcribed from ${SPEC_SOURCE}; the spec document is not committed to this repo and the figures are unverified against a committed source.`,
      "Values marked provenance=manual are product constants, not chain reads. They will be replaced by the on-chain value once PermissionedDynaVault v2.1 is deployed.",
      "Curtailment thresholds are figures only: the predicate they feed is not specified and is not inferred.",
      // Says WHICH asset, not which asset it is not. Naming the wrong ticker
      // here would ship it into the API payload — and this assumptions array is
      // rendered to humans, where a stray ticker reads as a second supported
      // asset rather than as a correction. The spec's contradiction is recorded
      // in the module header and in docs/DYNAVAULT_V2_WIRING.md, where it
      // belongs. `sheet.asset` is the machine-readable answer; the on-chain
      // `asset()` is the authority.
      "The asset is USDC (6 decimals), confirmed against the vault's on-chain asset() — no other asset is supported.",
      FACTSHEET_DISCLAIMER,
    ],
    disclaimer: FACTSHEET_DISCLAIMER,
    generatedAt: now.toISOString(),
  };
}
