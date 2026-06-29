/**
 * Live-read swarm runners — artifact stages (E·F).
 *
 *   E charts  → maps the numeric artifacts to HIS chart specs (pure, no math).
 *   F writeup → composes long-form, output-guarded institutional prose.
 *
 * The charts runner is PURE (no I/O) and lives here so it is unit-testable
 * without server-only. The writeup runner is server-only (LLM) and is in
 * runners-writeup.ts; this file only holds the deterministic chart mapping +
 * the pure deterministic prose fallback (so a no-LLM environment still produces
 * a real write-up).
 */

import type {
  ChartArtifact,
  QuantArtifact,
  StrategyCrossArtifact,
  WriteupArtifact,
} from "./types";
import type { CanonicalAllocation } from "@/lib/products/canonical-allocation";

// ── E · charts (pure) ───────────────────────────────────────────────────────

/**
 * Build the renderable chart specs from the numeric artifacts. No business math
 * — every number is taken verbatim from the strategy/quant artifacts. The fan
 * chart is the projection p5/p50/p95 across the horizon (linearly interpolated
 * from t0=central to tN=percentile, which is a presentation ramp, not a model).
 */
export function runCharts(args: {
  strategy: StrategyCrossArtifact;
  quant: QuantArtifact;
  /** The canonical allocation — the allocation ring reads THIS (never a yield mix). */
  canonicalAllocation?: CanonicalAllocation;
}): { charts: ChartArtifact[] } {
  const { strategy, quant, canonicalAllocation } = args;
  const seedLabel = `seed ${quant.seed}`;

  // Projection fan: ramp from a tight t0 band to the full pN band at the horizon
  // so the cone widens with time (a standard fan presentation). Values in %.
  const months = Math.max(1, quant.horizonMonths);
  const p = quant.percentiles;
  const mid = p.p50 * 100;
  const fanBands = Array.from({ length: months + 1 }, (_, m) => {
    const t = m / months; // 0..1
    return {
      m,
      p5: round1(mid + (p.p5 * 100 - mid) * t),
      p50: round1(mid + (p.p50 * 100 - mid) * t),
      p95: round1(mid + (p.p95 * 100 - mid) * t),
    };
  });

  const charts: ChartArtifact[] = [
    {
      id: "projection-fan",
      kind: "fan",
      title: "Projected APY range (p5 / p50 / p95)",
      unit: "%",
      ariaLabel:
        "Projection fan chart of APY percentiles across the horizon — not guaranteed",
      seedLabel,
      fanBands,
      provenance: quant.provenance,
    },
    // Allocation ring — the CANONICAL four sleeves (floor-enforced), NOT the
    // yield mix. Falls back to the yield mix only when no canonical allocation
    // was supplied (legacy callers); the pipeline always supplies one.
    canonicalAllocation
      ? {
          id: "allocation",
          kind: "allocation" as const,
          title: "Canonical allocation",
          unit: "%",
          ariaLabel:
            "Canonical four-sleeve allocation — mining floor, BTC holding, stable reserve, yield overlay",
          allocation: [
            { label: "Mining", valuePct: round1(canonicalAllocation.mining) },
            {
              label: "BTC holding",
              valuePct: round1(canonicalAllocation.btcHoldingCollateral),
            },
            {
              label: "Stable reserve",
              valuePct: round1(canonicalAllocation.stableReserve),
            },
            {
              label: "Yield overlay",
              valuePct: round1(canonicalAllocation.yieldOverlay),
            },
          ],
          provenance: strategy.provenance,
        }
      : {
          id: "allocation",
          kind: "allocation" as const,
          title: "Blended yield mix",
          unit: "%",
          ariaLabel:
            "Allocation of the blended yield between mining and USDC legs",
          allocation: [
            { label: "Mining yield", valuePct: round1(strategy.miningYieldPct) },
            { label: "USDC yield", valuePct: round1(strategy.usdcYieldPct) },
          ],
          provenance: strategy.provenance,
        },
    {
      id: "headline-range",
      kind: "value",
      title: "Headline APY range",
      unit: "%",
      ariaLabel: "Headline APY range low to high",
      valuePoints: [
        { x: 0, y: round1(quant.headlineRange.low * 100), label: "low (p25)" },
        { x: 1, y: round1(quant.headlineRange.high * 100), label: "high (p75)" },
      ],
      provenance: quant.provenance,
    },
  ];

  return { charts };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ── F · writeup (deterministic fallback) ────────────────────────────────────

/**
 * Deterministic write-up — the no-LLM fallback. Assembles honest, output-safe
 * prose from the numbers (APY always a range, no guarantee language). The
 * server-only LLM runner (runners-writeup.ts) prefers a richer LLM narrative and
 * falls back to THIS when the model is unavailable, so a write-up always exists.
 */
export function buildDeterministicWriteup(args: {
  objective: string;
  vaultLabel: string;
  strategy: StrategyCrossArtifact;
  quant: QuantArtifact;
  market: { btcUsd: number; hashpriceUsdPerThDay: number };
  /** The canonical allocation — the prose's mining % must match every surface. */
  canonicalAllocation?: CanonicalAllocation;
}): WriteupArtifact {
  const { objective, vaultLabel, strategy, quant, market, canonicalAllocation } =
    args;
  const lo = round1(quant.headlineRange.low * 100);
  const hi = round1(quant.headlineRange.high * 100);
  const p5 = round1(quant.percentiles.p5 * 100);
  const p95 = round1(quant.percentiles.p95 * 100);

  const allocationLine = canonicalAllocation
    ? `Canonical allocation: mining ${round1(canonicalAllocation.mining)}% · ` +
      `BTC holding ${round1(canonicalAllocation.btcHoldingCollateral)}% · ` +
      `stable reserve ${round1(canonicalAllocation.stableReserve)}% · ` +
      `yield overlay ${round1(canonicalAllocation.yieldOverlay)}%` +
      (canonicalAllocation.governanceException
        ? " (mining floored — governance review)."
        : ".")
    : "";

  const prose = [
    `## ${vaultLabel} — framing brief`,
    "",
    `Objective: ${objective}`,
    "",
    `On the live inputs read this run (BTC at $${Math.round(market.btcUsd).toLocaleString("en-US")}, hashprice $${market.hashpriceUsdPerThDay.toFixed(3)}/TH/day), and the configured company levers (markup ${strategy.companyLevers.markupPct}%, revenue share ${strategy.companyLevers.revenueSharePct}%, energy $${strategy.companyLevers.energyCostUsdPerKwh}/kWh), the blended construction projects a target APY in the **${lo}–${hi}%** range.`,
    "",
    `A seeded Monte-Carlo (seed ${quant.seed}, ${quant.paths.toLocaleString("en-US")} paths, ${quant.horizonMonths}-month horizon) places the p5–p95 dispersion at ${p5}–${p95}%, with an estimated ${quant.probBelowFloorPct}% probability of finishing below the ${quant.floorApyPct}% floor. These are conditional projections, not promises.`,
    "",
    `Mining yield contributes ${round1(strategy.miningYieldPct)}% and the USDC leg ${round1(strategy.usdcYieldPct)}% (source: ${strategy.usdcSource}). Every figure above is conditional on the stated assumptions and is **not guaranteed**.`,
    ...(allocationLine ? ["", allocationLine] : []),
    "",
    "### Assumptions",
    ...strategy.assumptions.map((a) => `- ${a}`),
    "",
    strategy.disclaimer,
  ].join("\n");

  return {
    title: `${vaultLabel} — framing brief`,
    prose,
    llmAuthored: false,
    provenance: strategy.provenance,
  };
}
