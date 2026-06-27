/**
 * allocator.ts — PURE 3-bucket allocator (no I/O, fully testable).
 *
 * Adrien's directive: the bucket split must be DERIVED, not fixed — weighted by
 * how much each engine returns relative to its risk:
 *
 *   Bucket 1  Mining  — produces BTC (cashflow + HODL'd sats)
 *   Bucket 2  BTC     — bought-direct BTC, captures price upside (the x2/x3)
 *   Bucket 3  USDC    — stable DeFi yield + cushion
 *
 * Inputs that move the allocation:
 *   - usdcYieldPct          : what USDC earns right now
 *   - btcExpectedReturnPct  : Adrien-set expected BTC performance (the upside lever)
 *   - miningYieldPct        : LP net mining yield (from strategy-model)
 *
 * Objective: best RISK-ADJUSTED return. Each bucket gets a score = expected
 * return / risk (Sharpe-like); weights are the normalized scores. So when BTC's
 * expected return is high it earns weight despite its volatility; when USDC pays
 * well it gains weight as the low-risk anchor. Optional per-vault min/max clamps
 * keep a profile honest (e.g. Defensive caps BTC).
 */

export interface BucketRisk {
  /** Annualized volatility proxy (%) used as the risk denominator. */
  mining: number;
  btc: number;
  usdc: number;
}

/** Default risk proxies (annualized vol, %). USDC ~near-zero, BTC high. */
export const DEFAULT_RISK: BucketRisk = {
  mining: 35, // hashprice + difficulty variance
  btc: 65, // BTC price volatility
  usdc: 3, // stable depeg/smart-contract risk floor
};

export interface AllocatorInputs {
  miningYieldPct: number;
  btcExpectedReturnPct: number;
  usdcYieldPct: number;
  risk?: BucketRisk;
  /** Optional per-bucket clamps (percent 0–100) to honor a vault profile. */
  bounds?: Partial<{
    mining: [number, number];
    btc: [number, number];
    usdc: [number, number];
  }>;
}

export interface Allocation3 {
  miningPct: number;
  btcPct: number;
  usdcPct: number;
  /** Sharpe-like scores before normalization (diagnostics). */
  scores: { mining: number; btc: number; usdc: number };
  /** Blended expected portfolio return at these weights (%). */
  blendedReturnPct: number;
}

/** Risk-adjusted score = max(0, return) / max(risk, epsilon). */
function score(returnPct: number, riskPct: number): number {
  return Math.max(0, returnPct) / Math.max(riskPct, 0.1);
}

/**
 * Derive the 3-bucket allocation from live returns + risk, best risk-adjusted.
 * Weights are normalized Sharpe-like scores, then clamped to optional bounds and
 * re-normalized so they always sum to 100.
 */
export function allocate(inputs: AllocatorInputs): Allocation3 {
  const risk = inputs.risk ?? DEFAULT_RISK;

  const scores = {
    mining: score(inputs.miningYieldPct, risk.mining),
    btc: score(inputs.btcExpectedReturnPct, risk.btc),
    usdc: score(inputs.usdcYieldPct, risk.usdc),
  };

  const total = scores.mining + scores.btc + scores.usdc;
  // Degenerate: every score zero (all returns ≤ 0) → park everything in USDC.
  let w =
    total <= 0
      ? { mining: 0, btc: 0, usdc: 100 }
      : {
          mining: (scores.mining / total) * 100,
          btc: (scores.btc / total) * 100,
          usdc: (scores.usdc / total) * 100,
        };

  if (inputs.bounds) {
    w = applyBounds(w, inputs.bounds);
  }

  const blendedReturnPct = round2(
    (w.mining * inputs.miningYieldPct +
      w.btc * inputs.btcExpectedReturnPct +
      w.usdc * inputs.usdcYieldPct) /
      100,
  );

  return {
    miningPct: round2(w.mining),
    btcPct: round2(w.btc),
    usdcPct: round2(w.usdc),
    scores,
    blendedReturnPct,
  };
}

type Weights = { mining: number; btc: number; usdc: number };
type Key = keyof Weights;

/**
 * Constrained normalization to 100 that RESPECTS [min,max] bounds. We can't just
 * clamp-then-renormalize (renormalization re-inflates a clamped bucket past its
 * cap). Instead: iteratively clamp violators, freeze them, and redistribute the
 * remaining budget across still-free buckets proportionally — repeating until no
 * bound is violated. Converges in ≤3 passes for 3 buckets.
 */
function applyBounds(
  w: Weights,
  bounds: NonNullable<AllocatorInputs["bounds"]>,
): Weights {
  const keys: Key[] = ["mining", "btc", "usdc"];
  const lo = (k: Key) => bounds[k]?.[0] ?? 0;
  const hi = (k: Key) => bounds[k]?.[1] ?? 100;

  const out: Weights = { ...w };
  const frozen = new Set<Key>();

  for (let pass = 0; pass < keys.length + 1; pass++) {
    // Budget left for the still-free buckets.
    const frozenSum = keys
      .filter((k) => frozen.has(k))
      .reduce((s, k) => s + out[k], 0);
    const free = keys.filter((k) => !frozen.has(k));
    const freeBudget = 100 - frozenSum;
    const freeRaw = free.reduce((s, k) => s + out[k], 0);

    // Distribute the budget proportionally across free buckets.
    for (const k of free) {
      out[k] = freeRaw > 0 ? (out[k] / freeRaw) * freeBudget : freeBudget / free.length;
    }

    // Find the worst bound violation among free buckets; clamp + freeze it.
    let violator: Key | null = null;
    for (const k of free) {
      if (out[k] < lo(k) - 1e-9) {
        out[k] = lo(k);
        violator = k;
        break;
      }
      if (out[k] > hi(k) + 1e-9) {
        out[k] = hi(k);
        violator = k;
        break;
      }
    }
    if (!violator) break;
    frozen.add(violator);
  }

  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
