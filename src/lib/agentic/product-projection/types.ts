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
  type: "range_band" | "allocation_mix" | "scenario_compare";
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
  version: "v0";
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
  sideEffects: false;
  businessSideEffects: false;
};
