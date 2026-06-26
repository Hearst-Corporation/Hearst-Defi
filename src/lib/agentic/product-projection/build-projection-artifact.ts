/**
 * Product Projection — deterministic artifact builder (pure).
 *
 * Builds a ProjectionReportArtifact from validated input. Deterministic: no
 * Date.now(), no randomness — same input yields identical output. It invents no
 * number: every figure is either echoed from an input or a clearly-labelled
 * derivation of inputs. Missing critical inputs go to `missingInputs` and are NOT
 * fabricated. APY is only ever a range. Disclaimers + provenance are mandatory.
 */

import type {
  ProductProjectionInput,
  ProjectionReportArtifact,
  ProjectionMetric,
  ProjectionScenario,
  ProjectionChart,
  ProjectionRisk,
  Confidence,
  ProvenanceSource,
} from "./types";
import { MANDATORY_DISCLAIMERS } from "./projection-guards";
import { buildProjectionDistribution } from "./projection-methodology-v2";

const DEFAULT_HORIZON_MONTHS = 12;

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Source quality score for confidence derivation (deterministic). */
function sourceScore(sources: ProvenanceSource[]): number {
  if (sources.length === 0) return 0;
  const weight: Record<ProvenanceSource, number> = {
    live: 3,
    attested: 2,
    estimated: 1,
    manual: 0,
  };
  const sum = sources.reduce((acc, s) => acc + weight[s], 0);
  return sum / sources.length; // 0..3
}

function deriveConfidence(input: ProductProjectionInput): Confidence {
  let present = 0;
  if (input.apyRange) present += 1;
  if (typeof input.capitalBase === "number") present += 1;
  if (input.allocation && input.allocation.length > 0) present += 1;
  if (input.assumptions && input.assumptions.length > 0) present += 1;

  const sources: ProvenanceSource[] = [
    ...(input.allocation ?? []).map((a) => a.source),
    ...(input.assumptions ?? []).map((a) => a.source),
  ];
  const quality = sourceScore(sources); // 0..3

  if (present >= 4 && quality >= 2) return "high";
  if (present >= 2 && quality >= 1) return "medium";
  return "low";
}

export function buildProjectionArtifact(
  input: ProductProjectionInput,
): ProjectionReportArtifact {
  const horizonMonths = input.horizonMonths ?? DEFAULT_HORIZON_MONTHS;
  const horizonDefaulted = input.horizonMonths === undefined;
  const currency = input.currency ?? "USDC";

  const metrics: ProjectionMetric[] = [];
  const provenance: ProjectionReportArtifact["provenance"] = [];
  const missingInputs: string[] = [];
  const charts: ProjectionChart[] = [];
  const scenarios: ProjectionScenario[] = [];

  const confidence = deriveConfidence(input);

  // ── APY (range only) ──────────────────────────────────────────────────────
  if (input.apyRange) {
    metrics.push({
      id: "target_apy",
      label: "Target APY (range)",
      range: { min: input.apyRange.min, max: input.apyRange.max, unit: "%" },
      provenance: "input:apyRange",
      confidence,
    });
    provenance.push({ metricId: "target_apy", source: "input:apyRange" });
  } else {
    missingInputs.push("apyRange");
  }

  // ── Capital base ──────────────────────────────────────────────────────────
  if (typeof input.capitalBase === "number") {
    metrics.push({
      id: "capital_base",
      label: "Capital base",
      value: `${round2(input.capitalBase)} ${currency}`,
      unit: currency,
      provenance: "input:capitalBase",
      confidence,
    });
    provenance.push({ metricId: "capital_base", source: "input:capitalBase" });
  } else {
    missingInputs.push("capitalBase");
  }

  // ── Projected yield (derived range, simple non-compounded) ────────────────
  const years = horizonMonths / 12;
  const canYield =
    input.apyRange !== undefined && typeof input.capitalBase === "number";
  if (canYield) {
    const apy = input.apyRange!;
    const cap = input.capitalBase!;
    const yMin = round2(cap * (apy.min / 100) * years);
    const yMax = round2(cap * (apy.max / 100) * years);
    metrics.push({
      id: "projected_yield",
      label: `Projected yield over ${horizonMonths} months (range)`,
      range: { min: yMin, max: yMax, unit: currency },
      provenance:
        "derived: capitalBase × apyRange × (horizonMonths/12), simple non-compounded",
      confidence,
    });
    provenance.push({
      metricId: "projected_yield",
      source: "derived:capitalBase×apyRange×horizon",
    });

    // ── Scenarios (framings of the SAME provided range; no invented numbers) ─
    const scen = (
      id: "bear" | "base" | "bull",
      label: string,
      apyMin: number,
      apyMax: number,
      description: string,
    ): ProjectionScenario => ({
      id,
      label,
      description,
      metrics: [
        { label: "APY (range)", range: { min: apyMin, max: apyMax, unit: "%" } },
        {
          label: "Projected yield (range)",
          range: {
            min: round2(cap * (apyMin / 100) * years),
            max: round2(cap * (apyMax / 100) * years),
            unit: currency,
          },
        },
      ],
    });
    scenarios.push(
      scen(
        "bear",
        "Bear",
        apy.min,
        apy.min,
        "Lower end of the stated APY range applied across the horizon.",
      ),
      scen(
        "base",
        "Base",
        apy.min,
        apy.max,
        "The full stated APY range applied across the horizon.",
      ),
      scen(
        "bull",
        "Bull",
        apy.max,
        apy.max,
        "Upper end of the stated APY range applied across the horizon.",
      ),
    );

    charts.push({
      id: "scenario_compare",
      type: "scenario_compare",
      title: "Scenario comparison (bear / base / bull)",
      data: scenarios.map((s) => ({ id: s.id, metrics: s.metrics })),
    });
    charts.push({
      id: "apy_range_band",
      type: "range_band",
      title: `APY range over ${horizonMonths} months`,
      data: { apy: { min: apy.min, max: apy.max, unit: "%" }, horizonMonths },
    });
  } else {
    if (!input.apyRange) missingInputs.push("projected_yield(needs apyRange)");
    if (typeof input.capitalBase !== "number")
      missingInputs.push("projected_yield(needs capitalBase)");
  }

  // ── Allocation chart ──────────────────────────────────────────────────────
  if (input.allocation && input.allocation.length > 0) {
    charts.push({
      id: "allocation_mix",
      type: "allocation_mix",
      title: "Allocation mix",
      data: input.allocation.map((a) => ({
        label: a.label,
        weightPct: a.weightPct,
        source: a.source,
      })),
    });
  } else {
    missingInputs.push("allocation");
  }

  // ── Assumptions (echo input + horizon default note) ───────────────────────
  const assumptions: ProjectionReportArtifact["assumptions"] = [
    ...(input.assumptions ?? []).map((a) => ({
      key: a.key,
      value: a.value,
      source: a.source as string,
    })),
  ];
  if (horizonDefaulted) {
    assumptions.push({
      key: "horizonMonths",
      value: `${DEFAULT_HORIZON_MONTHS} (assumed — not provided)`,
      source: "manual",
    });
    missingInputs.push("horizonMonths");
  }

  // ── Risks (qualitative, deterministic by product type; no numbers) ────────
  const risks: ProjectionRisk[] = [
    {
      id: "market_risk",
      label: "Market risk",
      severity: "medium",
      note: "Returns vary with market conditions; the projected range is not assured.",
    },
    {
      id: "model_risk",
      label: "Model / assumption risk",
      severity: "medium",
      note: "The projection is only as good as the stated assumptions and their provenance.",
    },
  ];
  if (input.productType === "vault") {
    risks.push({
      id: "liquidity_lockup_risk",
      label: "Liquidity / lock-up risk",
      severity: "medium",
      note: "Vault structures may carry a soft lock-up; capital may not be immediately redeemable.",
    });
  }

  // ── Summary (no forbidden words, APY only as a range) ─────────────────────
  const apyText = input.apyRange
    ? `a target APY range of ${input.apyRange.min}-${input.apyRange.max}%`
    : "no APY range provided (see missing inputs)";
  const summary =
    `Read-only ${horizonMonths}-month projection for ${input.productName} ` +
    `(${input.productType}) with ${apyText}. ` +
    `All figures are derived from the provided inputs and their provenance; ` +
    `this is a projection only, future results are not assured, and APY is shown only as a range.`;

  // ── Methodology v2 (additive, opt-in via input.methodology.version="v2") ──
  // Seeded p5/p50/p95 distribution. If requested without an apyRange there is no
  // distribution (never fabricated) — recorded in missingInputs instead.
  let methodology: ProjectionReportArtifact["methodology"];
  let distribution: ProjectionReportArtifact["distribution"];
  let version: ProjectionReportArtifact["version"] = "v0";
  if (input.methodology?.version === "v2") {
    const dist = buildProjectionDistribution(input);
    if (dist) {
      distribution = dist;
      methodology = dist.methodology;
      version = "v2";
      charts.push({
        id: "projection_percentile_band",
        type: "percentile_band",
        title: "Scenario distribution (p5 / p50 / p95)",
        data: { bands: dist.bands, percentiles: dist.percentiles },
      });
    } else {
      missingInputs.push("methodology_v2(needs apyRange)");
    }
  }

  const id = `projection:${version}:${input.productType}:${slug(input.productName)}:${horizonMonths}m`;

  return {
    id,
    kind: "product_projection_report",
    version,
    product: {
      ...(input.productId ? { id: input.productId } : {}),
      name: input.productName,
      type: input.productType,
    },
    mode: "read_only_projection",
    horizonMonths,
    confidence,
    summary,
    metrics,
    scenarios,
    charts,
    assumptions,
    risks,
    disclaimers: [...MANDATORY_DISCLAIMERS],
    provenance,
    missingInputs,
    ...(methodology ? { methodology } : {}),
    ...(distribution ? { distribution } : {}),
    sideEffects: false,
    businessSideEffects: false,
  };
}
