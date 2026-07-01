/**
 * Deterministic BTC price models. A seeded PRNG (mulberry32) — never Math.random,
 * never Date.now — so a run is fully reproducible (ADR-006 engine purity).
 */

import { BPS } from "./portfolio-math";
import type { MarketModel } from "./types";

/** Seeded PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box–Muller standard normal from two uniforms. */
function normal(rng: () => number): number {
  const u1 = Math.max(1e-12, rng());
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Monthly GBM on BTC price: driftBps + volBps shock per step. Seeded and pure.
 * With volBps = 0 the path is a smooth deterministic drift.
 */
export function gbmMarketModel(
  driftBps: number,
  volBps: number,
  seed: number,
): MarketModel {
  const rng = mulberry32(seed >>> 0);
  const drift = driftBps / BPS;
  const vol = volBps / BPS;
  return {
    priceAt(month, prev) {
      if (month === 0) return prev;
      const shock = vol > 0 ? vol * normal(rng) : 0;
      const factor = Math.exp(drift - 0.5 * vol * vol + shock);
      return Math.max(0, prev * factor);
    },
  };
}
