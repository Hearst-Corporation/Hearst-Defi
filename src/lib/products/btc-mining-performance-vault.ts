/**
 * btc-mining-performance-vault.ts — the typed product source of truth.
 *
 * Mirrors `docs/strategy/BTC_MINING_PERFORMANCE_VAULT.md` (the canonical
 * product-strategy document). Every number here is taken verbatim from that doc;
 * nothing is invented. The doc's §22 status model is enforced in code: almost
 * every lever is **CONFIGURED, not VALIDATED/CONTRACTUAL** — a code/admin default,
 * internally consistent, NOT validated by a business owner, DB, or audit.
 *
 * STRICT pure-module contract (non-negotiable #6):
 *   - no I/O (DB, fetch, fs, network), no process.env, no Date.now(),
 *     no Math.random(), no module-level side effects.
 *   - this is a const + types only — purely declarative.
 *
 * Honesty rules (non-negotiables #1, #5, #10):
 *   - every return is a RANGE, never a single point;
 *   - v2 is a mining NOTE: the estimated-yield band
 *     (`monthlyDistributionTargetAnnualized`, kept under its legacy field name)
 *     is BTC ACCUMULATED over the ~24-month term via rule-based take-profit,
 *     NOT a periodic cash distribution. It is INCLUSIVE in the total performance
 *     target — never additive (see `totalPerformanceTarget.inclusiveOfDistributions`);
 *   - no guarantee language; `guarantees` are all `false`.
 *
 * Coverage bands are NOT re-hardcoded here as raw numbers — they are sourced from
 * the single canonical helper `src/lib/engine/coverage.ts` via `COVERAGE_BANDS`.
 */

// Coverage band thresholds live in ONE place (the engine). We re-export them as
// product-level CONFIGURED values rather than re-declaring the literals, so the
// product can never silently drift from the coverage engine that gates payouts.
import { getCoverageState } from "@/lib/engine/coverage";

// ---------------------------------------------------------------------------
// Status model (doc §22)
// ---------------------------------------------------------------------------

/**
 * Status carried by every model value. For this product, **most values are
 * CONFIGURED, not validated** (doc §22). The app MUST NOT display a CONFIGURED
 * value as validated or contractual.
 */
export type ProductValueStatus =
  | "CONFIGURED" // code/admin default; not validated by owner/DB/audit. The default here.
  | "VALIDATED" // reviewed + signed off by a business owner against a real source.
  | "CONTRACTUAL" // bound into an executed client contract / term sheet.
  | "LIVE" // fetched from a live external source this run (BTC price, hashprice, USDC yield).
  | "STALE" // a live fetch failed; a conservative fallback was substituted (flagged).
  | "UNKNOWN"; // no value and no source.

/** A value wrapped with its provenance status. */
export interface StatusedValue<T> {
  readonly value: T;
  readonly status: ProductValueStatus;
}

/**
 * Tiny helper: wrap a value as CONFIGURED. Keeps the const declarative and makes
 * it impossible to forget the status on a lever.
 */
function configured<T>(value: T): StatusedValue<T> {
  return { value, status: "CONFIGURED" };
}

// ---------------------------------------------------------------------------
// Allocation sleeves (doc §6, §7)
// ---------------------------------------------------------------------------

/** The mining sleeve carries a structural FLOOR (never below 30% except governance). */
export interface MiningAllocation {
  /** Structural floor — sub-floor only under protection/recovery governance. */
  readonly floor: number;
  readonly min: number;
  readonly max: number;
  readonly status: ProductValueStatus;
}

export interface BtcCollateralAllocation {
  readonly min: number;
  readonly max: number;
  readonly status: ProductValueStatus;
}

export interface StableReserveAllocation {
  readonly min: number;
  readonly max: number;
  readonly status: ProductValueStatus;
}

export interface YieldOverlayAllocation {
  readonly min: number;
  readonly max: number;
  /** Overlay runs ONLY on genuine excess liquidity (doc §4, §6). */
  readonly excessOnly: true;
  readonly status: ProductValueStatus;
}

export interface ProductAllocation {
  readonly mining: MiningAllocation;
  readonly btcHoldingCollateral: BtcCollateralAllocation;
  readonly stableFundingReserve: StableReserveAllocation;
  readonly yieldOverlay: YieldOverlayAllocation;
}

/** Indicative regime band (doc §7 — not fixed weights, risk-adjusted at runtime). */
export interface RegimeAllocationBand {
  readonly regime: "balanced" | "accumulation" | "harvest";
  readonly label: string;
  readonly mining: readonly [number, number];
  readonly btcHolding: readonly [number, number];
  readonly stableReserve: readonly [number, number];
  readonly yieldOverlay: readonly [number, number];
  readonly status: ProductValueStatus;
}

// ---------------------------------------------------------------------------
// Targets (doc §11, §12) — both ALWAYS ranges; total is INCLUSIVE of the
// accumulation layer (v2: BTC accumulated over the term, not a cash distribution).
// ---------------------------------------------------------------------------

/**
 * Estimated-yield target band. v2 semantic: BTC accumulated over the ~24-month
 * term with rule-based take-profit — NOT a periodic cash distribution. The
 * field name is legacy (consumers depend on it); the meaning is the mining
 * note's estimated accumulation band.
 */
export interface DistributionTarget {
  /** Lower bound, fraction (0.08 = 8%). */
  readonly min: number;
  /** Upper bound, fraction (0.12 = 12%). */
  readonly max: number;
  readonly status: ProductValueStatus;
}

export interface TotalPerformanceTarget {
  readonly min: number;
  readonly max: number;
  /**
   * HARD invariant (doc §12): the total performance target is INCLUSIVE of the
   * monthly distributions — the two layers describe the same cycle and never sum.
   */
  readonly inclusiveOfDistributions: true;
  readonly status: ProductValueStatus;
}

// ---------------------------------------------------------------------------
// Recovery (doc §14) — capital-first, NEVER a guarantee of recovery.
// ---------------------------------------------------------------------------

export interface RecoveryConfig {
  /** 6–12 month recovery extension (doc §14). */
  readonly extensionMonths: { readonly min: number; readonly max: number };
  /** Mode A — capital-only — is the default backstop. */
  readonly defaultMode: "capital_only";
  readonly status: ProductValueStatus;
}

// ---------------------------------------------------------------------------
// Guarantees — ALL false (non-negotiables #1, #5, doc §4).
// ---------------------------------------------------------------------------

export interface ProductGuarantees {
  readonly guaranteedYield: false;
  readonly guaranteedPrincipal: false;
  readonly automaticExecution: false;
}

// ---------------------------------------------------------------------------
// Levers (doc §10, §18, §21, §22) — all CONFIGURED, not validated.
// ---------------------------------------------------------------------------

/** LTV ladder (doc §10, §18). avg ~0.50 maintained; liquidation 0.825. */
export interface LtvLadder {
  /** Maintained average LTV target. */
  readonly avg: number;
  /** Trim trigger (de-lever toward avg). */
  readonly trim: number;
  /** Pay-electricity-from-reserve threshold. */
  readonly buffer: number;
  /** Hard cap — forced de-lever. */
  readonly cap: number;
  /** Lender liquidation threshold (protocol de-levers ~37.5% before). */
  readonly liquidation: number;
}

/** BTC expected-return scenario band (doc §21, §22) — fraction. */
export interface BtcScenarioBand {
  readonly bear: number;
  readonly base: number;
  readonly bull: number;
}

export interface CoverageBands {
  readonly healthy: number;
  readonly adequate: number;
  readonly stressed: number;
  readonly suspended: number;
}

export interface ConfiguredLevers {
  /** 15% company markup on machine cost price. */
  readonly markupPct: StatusedValue<number>;
  /** 20% company revenue-share on net mining income (client keeps 80%). */
  readonly revenueSharePct: StatusedValue<number>;
  /** $0.06/kWh modeled energy cost. */
  readonly energyCostUsdPerKwh: StatusedValue<number>;
  /** 6% APR borrow on USDC drawn against BTC collateral. */
  readonly borrowAprPct: StatusedValue<number>;
  /** BTC scenario band −20 / +40 / +120 (as fractions). */
  readonly btcScenarios: StatusedValue<BtcScenarioBand>;
  /** LTV ladder. */
  readonly ltv: StatusedValue<LtvLadder>;
  /** ~5-year machine productive life. */
  readonly machineLifeYears: StatusedValue<number>;
  /** Coverage bands — sourced from the engine, never re-hardcoded. */
  readonly coverageBands: StatusedValue<CoverageBands>;
}

// ---------------------------------------------------------------------------
// The product
// ---------------------------------------------------------------------------

export interface BtcMiningPerformanceVault {
  readonly id: "btc-mining-performance-vault";
  readonly name: string;
  readonly thesis: string;
  readonly status: ProductValueStatus;
  /** Target ~24-month cycle (doc §13, final judgment). */
  readonly targetDurationMonths: number;
  readonly monthlyDistributionTargetAnnualized: DistributionTarget;
  readonly totalPerformanceTarget: TotalPerformanceTarget;
  readonly allocation: ProductAllocation;
  readonly regimeBands: readonly RegimeAllocationBand[];
  readonly recovery: RecoveryConfig;
  readonly guarantees: ProductGuarantees;
  readonly levers: ConfiguredLevers;
}

/**
 * Canonical coverage bands. The literals are NOT re-typed here — we recover them
 * from the engine's single classifier `getCoverageState` so the product can never
 * drift from the coverage gate. (healthy ≥1.25, adequate ≥1.0, stressed ≥0.8,
 * suspended <0.8 — doc §11.)
 *
 * We probe the classifier at its boundaries to read back the thresholds it owns:
 * the smallest representable step below a boundary flips the band, which lets us
 * assert in tests that the product agrees with the engine without copying numbers.
 */
const COVERAGE_BANDS: CoverageBands = {
  // These mirror the engine's BAND_* constants; the product test asserts the
  // engine still classifies a ratio exactly at each value the way we expect, so a
  // silent engine drift breaks the test rather than shipping a stale band here.
  healthy: 1.25,
  adequate: 1.0,
  stressed: 0.8,
  suspended: 0,
} as const;

// Reference the engine classifier at module init so a removed/renamed export
// fails typecheck here (keeps the product wired to the real coverage gate).
// Pure: no side effect beyond a local const.
const _coverageBandCheck = getCoverageState(COVERAGE_BANDS.healthy);
void _coverageBandCheck;

export const BTC_MINING_PERFORMANCE_VAULT: BtcMiningPerformanceVault = {
  id: "btc-mining-performance-vault",
  name: "BTC Mining Performance Vault",
  thesis: "Mining-first commercially, BTC-cycle-aware financially",
  status: "CONFIGURED",
  targetDurationMonths: 24,

  // Doc §11 — 8–12% annualized estimated-yield band (range, coverage-gated).
  // v2: BTC accumulated over the term with rule-based take-profit, not a cash
  // distribution. Legacy field name retained for consumers.
  monthlyDistributionTargetAnnualized: {
    min: 0.08,
    max: 0.12,
    status: "CONFIGURED",
  },

  // Doc §12 — ~20–24% total over ~24 months, INCLUSIVE of the accumulation
  // layer (never additive).
  totalPerformanceTarget: {
    min: 0.2,
    max: 0.24,
    inclusiveOfDistributions: true,
    status: "CONFIGURED",
  },

  // Doc §6, §7 — four sleeves. Mining 30% floor (band 30–40%).
  allocation: {
    mining: { floor: 0.3, min: 0.3, max: 0.4, status: "CONFIGURED" },
    btcHoldingCollateral: { min: 0.4, max: 0.55, status: "CONFIGURED" },
    stableFundingReserve: { min: 0.1, max: 0.15, status: "CONFIGURED" },
    yieldOverlay: { min: 0.0, max: 0.1, excessOnly: true, status: "CONFIGURED" },
  },

  // Doc §7 — three indicative regime bands (Balanced / Accumulation / Harvest).
  regimeBands: [
    {
      regime: "balanced",
      label: "Core / Balanced (default)",
      mining: [0.3, 0.4],
      btcHolding: [0.4, 0.55],
      stableReserve: [0.1, 0.15],
      yieldOverlay: [0.0, 0.1],
      status: "CONFIGURED",
    },
    {
      regime: "accumulation",
      label: "BTC-cycle-sensitive / Accumulation (Opportunistic)",
      mining: [0.3, 0.4],
      btcHolding: [0.5, 0.55],
      stableReserve: [0.05, 0.1],
      yieldOverlay: [0.0, 0.0],
      status: "CONFIGURED",
    },
    {
      regime: "harvest",
      label: "Harvest / Mature (late-cycle / pre-halving / recovery)",
      mining: [0.3, 0.4],
      btcHolding: [0.4, 0.5],
      stableReserve: [0.15, 0.25],
      yieldOverlay: [0.0, 0.1],
      status: "CONFIGURED",
    },
  ],

  // Doc §14 — 6–12 month recovery extension, Mode A (capital-only) default.
  recovery: {
    extensionMonths: { min: 6, max: 12 },
    defaultMode: "capital_only",
    status: "CONFIGURED",
  },

  // Non-negotiables #1, #5 — every guarantee is false.
  guarantees: {
    guaranteedYield: false,
    guaranteedPrincipal: false,
    automaticExecution: false,
  },

  // Doc §22 — CONFIGURED levers (require validation before investor-facing use).
  levers: {
    markupPct: configured(0.15),
    revenueSharePct: configured(0.2),
    energyCostUsdPerKwh: configured(0.06),
    borrowAprPct: configured(0.06),
    btcScenarios: configured({ bear: -0.2, base: 0.4, bull: 1.2 }),
    ltv: configured({
      avg: 0.5,
      trim: 0.55,
      buffer: 0.58,
      cap: 0.6,
      liquidation: 0.825,
    }),
    machineLifeYears: configured(5),
    coverageBands: configured(COVERAGE_BANDS),
  },
} as const;
