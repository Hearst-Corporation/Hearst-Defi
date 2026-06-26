/**
 * Product Projection — Methodology v2 (seeded p5/p50/p95 distribution).
 *
 * Pure and deterministic: it REUSES the existing seeded PRNG
 * (src/lib/engine/prng.ts) — no Math.random, no Date.now. Given a (seed,
 * iterations, apyRange) triple it yields a byte-identical distribution.
 *
 * It invents no number: the APY samples are drawn ONLY within the PROVIDED
 * apyRange (a truncated normal centred on the range, clamped to its bounds), and
 * projected yields are a labelled derivation of capitalBase × sampled APY ×
 * horizon. If apyRange is absent there is no distribution (it is never
 * fabricated). p50 is a median of a conditional distribution, NOT a promise.
 */

import { createPrng } from "@/lib/engine/prng";
import type {
  ProductProjectionInput,
  ProjectionDistribution,
  ProjectionPercentile,
} from "./types";

const DEFAULT_ITERATIONS = 1000;
const MIN_ITERATIONS = 100;
const MAX_ITERATIONS = 10_000;
const MAX_BAND_POINTS = 24;

export type MethodologyV2Options = { iterations?: number };

/** FNV-1a 32-bit hash → stable uint32 from a string (for seed derivation). */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Resolve the (label, numeric) seed: explicit input, or derived from inputs. */
export function resolveSeed(input: ProductProjectionInput): {
  label: string;
  value: number;
} {
  const raw = input.methodology?.seed;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return { label: String(raw), value: raw >>> 0 };
  }
  if (typeof raw === "string" && raw.trim().length > 0) {
    return { label: raw, value: fnv1a(raw) };
  }
  // Deterministic derivation from allowlisted inputs (never random).
  const basis = [
    input.productName,
    input.productType,
    input.apyRange ? `${input.apyRange.min}-${input.apyRange.max}` : "noapy",
    typeof input.capitalBase === "number" ? String(input.capitalBase) : "nocap",
    String(input.horizonMonths ?? 12),
  ].join("|");
  return { label: `derived:${fnv1a(basis).toString(16)}`, value: fnv1a(basis) };
}

export function clampIterations(n: number | undefined): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return DEFAULT_ITERATIONS;
  return Math.min(MAX_ITERATIONS, Math.max(MIN_ITERATIONS, Math.floor(n)));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Linear-interpolated percentile of an ascending-sorted array. */
function percentileSorted(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const idx = (sorted.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const frac = idx - lo;
  return sorted[lo]! * (1 - frac) + sorted[hi]! * frac;
}

/**
 * Build the seeded p5/p50/p95 distribution. Returns null when apyRange is absent
 * (no distribution is ever fabricated). Pure & deterministic in (seed, iterations,
 * apyRange, capitalBase, horizon).
 */
export function buildProjectionDistribution(
  input: ProductProjectionInput,
  options: MethodologyV2Options = {},
): ProjectionDistribution | null {
  if (!input.apyRange) return null; // cannot distribute without a stated range

  const { min, max } = input.apyRange;
  const seed = resolveSeed(input);
  const iterations = clampIterations(
    options.iterations ?? input.methodology?.iterations,
  );
  const horizonMonths = input.horizonMonths ?? 12;
  const years = horizonMonths / 12;
  const currency = input.currency ?? "USDC";
  const hasCapital = typeof input.capitalBase === "number";
  const cap = input.capitalBase ?? 0;

  const prng = createPrng(seed.value);
  const mid = (min + max) / 2;
  const sd = (max - min) / 4 || 1e-9; // spread inside the provided range

  // Sample APY ONLY within the provided range (truncated normal, clamped).
  const apySamples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    let apy = mid + prng.nextGaussian() * sd;
    if (apy < min) apy = min;
    if (apy > max) apy = max;
    apySamples.push(apy);
  }
  apySamples.sort((a, b) => a - b);

  const apyP5 = round2(percentileSorted(apySamples, 0.05));
  const apyP50 = round2(percentileSorted(apySamples, 0.5));
  const apyP95 = round2(percentileSorted(apySamples, 0.95));

  const yieldAt = (apyPct: number): number => round2(cap * (apyPct / 100) * years);

  const pct = (
    label: ProjectionPercentile["label"],
    apyPct: number,
  ): ProjectionPercentile => ({
    label,
    apyPct,
    ...(hasCapital
      ? { projectedYield: { value: yieldAt(apyPct), unit: currency } }
      : {}),
  });

  // Per-month cumulative bands (projected yield when capital is known; APY-fraction
  // basis otherwise). Bounded to MAX_BAND_POINTS sampled evenly across the horizon.
  const bands: ProjectionDistribution["bands"] = [];
  const months = Math.max(1, horizonMonths);
  const step = Math.max(1, Math.ceil(months / MAX_BAND_POINTS));
  const bandUnit = hasCapital ? currency : "%";
  for (let m = step; m <= months; m += step) {
    const yr = m / 12;
    const scale = hasCapital ? cap * yr : yr * 100; // yield, or cumulative APY%
    bands.push({
      horizonMonth: m,
      p5: round2((scale * apyP5) / 100),
      p50: round2((scale * apyP50) / 100),
      p95: round2((scale * apyP95) / 100),
      unit: bandUnit,
    });
  }
  if (bands.length === 0 || bands[bands.length - 1]!.horizonMonth !== months) {
    const yr = months / 12;
    const scale = hasCapital ? cap * yr : yr * 100;
    bands.push({
      horizonMonth: months,
      p5: round2((scale * apyP5) / 100),
      p50: round2((scale * apyP50) / 100),
      p95: round2((scale * apyP95) / 100),
      unit: bandUnit,
    });
  }

  const limitations: string[] = [
    "Seeded scenario distribution: APY is sampled only within the provided range (truncated normal), not modelled from market data.",
    "p50 is the median of a conditional distribution under the stated assumptions — it is not a forecast or a target.",
    "Deterministic in (seed, iterations, inputs); a different seed yields a different sample, not a different truth.",
    ...(hasCapital
      ? []
      : ["Bands are expressed as cumulative APY% (capitalBase not provided)."]),
  ];

  const assumptionsUsed: string[] = [
    `apyRange=${min}-${max}%`,
    `horizonMonths=${horizonMonths}`,
    ...(hasCapital ? [`capitalBase=${cap} ${currency}`] : []),
    ...(input.assumptions ?? []).map((a) => `${a.key}=${a.value} (${a.source})`),
  ];

  return {
    methodology: {
      version: "v2",
      seed: seed.label,
      iterations,
      model: "seeded_scenario_distribution",
      limitations,
    },
    percentiles: {
      p5: pct("p5", apyP5),
      p50: pct("p50", apyP50),
      p95: pct("p95", apyP95),
    },
    bands,
    assumptionsUsed,
  };
}
