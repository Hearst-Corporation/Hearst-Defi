/**
 * Product Projection — pure types.
 *
 * A projection is a READ-ONLY, deterministic artifact built from allowlisted
 * inputs. It invents no numbers (every figure traces to a provided input or a
 * declared derivation), expresses APY only as a range, never promises a return,
 * and always carries assumptions, provenance, and disclaimers. No I/O, no write.
 */

export type ProvenanceSource = "live" | "attested" | "estimated" | "manual";
export type Confidence = "low" | "medium" | "high";

/**
 * Optional methodology selector (additive, non-breaking). Absent → v1 (the v0
 * deterministic-range behaviour). `version: "v2"` adds a seeded p5/p50/p95
 * distribution. A seed is required for any percentile simulation; when omitted it
 * is derived deterministically from the allowlisted inputs (never random).
 */
export type ProjectionMethodologyInput = {
  version?: "v1" | "v2";
  seed?: string | number;
  iterations?: number;
  confidenceBands?: boolean;
};

export type ProductProjectionInput = {
  productId?: string;
  productName: string;
  productType: "vault" | "fund" | "strategy" | "unknown";
  capitalBase?: number;
  currency?: "USD" | "USDC";
  apyRange?: { min: number; max: number };
  horizonMonths?: number;
  allocation?: Array<{
    label: string;
    weightPct: number;
    source: ProvenanceSource;
  }>;
  assumptions?: Array<{
    key: string;
    value: string;
    source: ProvenanceSource;
  }>;
  methodology?: ProjectionMethodologyInput;
};

/** Resolved methodology block emitted on a v2 artifact. */
export type ProjectionMethodology = {
  version: "v2";
  seed: string;
  iterations: number;
  model: "seeded_scenario_distribution";
  limitations: string[];
};

export type ProjectionPercentile = {
  /** Percentile label, e.g. "p5". */
  label: "p5" | "p50" | "p95";
  /** Sampled APY at this percentile (%) — always part of a distribution, not a point promise. */
  apyPct: number;
  /** Projected yield at this percentile, only when capitalBase is provided. */
  projectedYield?: { value: number; unit: string };
};

export type ProjectionDistribution = {
  methodology: ProjectionMethodology;
  percentiles: {
    p5: ProjectionPercentile;
    p50: ProjectionPercentile;
    p95: ProjectionPercentile;
  };
  bands: Array<{
    horizonMonth: number;
    p5: number;
    p50: number;
    p95: number;
    unit: string;
  }>;
  assumptionsUsed: string[];
};

export type ProjectionMetric = {
  id: string;
  label: string;
  value?: string;
  range?: { min: number; max: number; unit: string };
  unit?: string;
  provenance: string;
  confidence: Confidence;
};

export type ProjectionScenario = {
  id: "bear" | "base" | "bull";
  label: string;
  description: string;
  metrics: Array<{
    label: string;
    range?: { min: number; max: number; unit: string };
    value?: string;
  }>;
};

export type ProjectionChart = {
  id: string;
  type: "range_band" | "allocation_mix" | "scenario_compare" | "percentile_band";
  title: string;
  data: unknown;
};

export type ProjectionRisk = {
  id: string;
  label: string;
  severity: "low" | "medium" | "high";
  note: string;
};

export type ProjectionReportArtifact = {
  id: string;
  kind: "product_projection_report";
  /** "v0" for the deterministic-range report; "v2" when a seeded distribution is attached. */
  version: "v0" | "v2";
  product: { id?: string; name: string; type: string };
  mode: "read_only_projection";
  horizonMonths: number;
  confidence: Confidence;
  summary: string;
  metrics: ProjectionMetric[];
  scenarios: ProjectionScenario[];
  charts: ProjectionChart[];
  assumptions: Array<{ key: string; value: string; source: string }>;
  risks: ProjectionRisk[];
  disclaimers: string[];
  provenance: Array<{ metricId: string; source: string }>;
  missingInputs: string[];
  /** v2 only — the resolved methodology block (additive; absent on v0). */
  methodology?: ProjectionMethodology;
  /** v2 only — the seeded p5/p50/p95 distribution (additive; absent on v0). */
  distribution?: ProjectionDistribution;
  sideEffects: false;
  businessSideEffects: false;
};
