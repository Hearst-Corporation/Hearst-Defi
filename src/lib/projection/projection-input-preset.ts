/**
 * Projection input PRESET — pure, read-only, derived from a Product Workspace
 * objective. The honest contract between "what the chat/workspace inferred" and
 * "what the admin must still decide in the Studio".
 *
 * The Projection Studio's run inputs (ScenarioInputs: btc_price_change_pct,
 * hashprice_usd_th_day, energy_cost_kwh, stable_apy_pct, vol_index) are ALL
 * business numbers. NONE of them can be derived from a free-text objective
 * without inventing a figure — so this preset NEVER fills them. It only carries
 * NON-FINANCIAL, structural suggestions (label/description/product type/buckets/
 * notes) and explicitly lists what stays REVIEW-REQUIRED and what is FORBIDDEN to
 * prefill, so the UI can be honest and the admin keeps every numeric decision.
 *
 * Hard rules (same discipline as the engine, though this is not the engine):
 *  - NO LLM, NO fetch, NO DB, NO Date.now(), NO Math.random().
 *  - NEVER emits a business number. Builds on the deterministic keyword parser
 *    `deriveProjectionInputDraft` only.
 *  - Output is a checklist/preset, never a run trigger.
 */

import {
  deriveProjectionInputDraft,
  productTypeLabel,
  bucketLabel,
  type ProjectionProductType,
  type ProjectionDraftBucket,
} from "@/lib/projection/product-objective-draft";
import { PROJECTION_METHODOLOGY_VERSION } from "@/lib/projection/methodology-panel";

/** Non-financial fields safe to carry from the objective into the Studio. */
export interface ProjectionPresetSafeFields {
  label?: string;
  description?: string;
  productType?: ProjectionProductType;
  productTypeLabel?: string;
  buckets?: ProjectionDraftBucket[];
  bucketLabels?: string[];
  notes?: string[];
}

export interface ProjectionInputPreset {
  source: "product-workspace";
  objective: string;
  methodologyVersion: string;
  /** Structural, non-numeric fields derived from the objective. */
  safeFields: ProjectionPresetSafeFields;
  /** Human labels of inputs the admin MUST review before running (CONFIGURED /
   *  live-source / fallback values that this preset deliberately does not touch). */
  reviewRequired: string[];
  /** Human labels of inputs that are NEVER prefilled from a free-text objective. */
  forbiddenPrefill: string[];
  warnings: string[];
  /** True when at least one safe structural field was derived. Numbers are never
   *  prefilled regardless of this flag. */
  hasSafeFields: boolean;
}

/**
 * Inputs the admin must review in the Studio before a run. These keep their real
 * provenance (CONFIGURED in company-assumptions / risk-references, or LIVE/
 * FALLBACK from the data layer) — the preset never overrides them.
 */
const REVIEW_REQUIRED: readonly string[] = [
  "BTC price change %",
  "Hashprice (USD/TH/day)",
  "Energy cost (USD/kWh)",
  "Stable APY %",
  "Volatility index",
  "Revenue share (CONFIGURED)",
  "Machine-cost markup (CONFIGURED)",
  "Borrow APR (CONFIGURED)",
  "Management + performance fees (CONFIGURED)",
  "BTC scenario band (CONFIGURED)",
  "Risk references (CONFIGURED, pre-audit)",
];

/**
 * Inputs that must NEVER be prefilled from a free-text objective — surfacing a
 * number here would be invention. Listed so the UI can state the boundary.
 */
const FORBIDDEN_PREFILL: readonly string[] = [
  "APY target",
  "Revenue share",
  "Markup",
  "Borrow APR",
  "BTC scenario numbers",
  "Exact LTV",
  "Risk score",
  "Smart-contract score",
  "Counterparty score",
  "Hashprice",
  "Energy price",
  "Machine price",
  "Allocation percentages",
  "p5 / p50 / p95",
  "Cashflow amounts",
];

/** Trim + bound a label derived from the objective (display only). */
function deriveLabel(objective: string): string | undefined {
  const t = objective.trim();
  if (!t) return undefined;
  // A short, safe study label — never a financial value.
  return t.length > 80 ? `${t.slice(0, 77)}…` : t;
}

/**
 * Build a Projection input preset from a Product Workspace objective.
 *
 * Pure: deterministic, no I/O, no business number. Safe to call in a Server
 * Component render.
 */
export function buildProjectionInputPreset(
  objective: string,
): ProjectionInputPreset {
  const draft = deriveProjectionInputDraft(objective);

  const safeFields: ProjectionPresetSafeFields = {};
  const hasStructure =
    draft.suggestedProductType !== "unknown" || draft.suggestedBuckets.length > 0;

  if (draft.suggestedProductType !== "unknown") {
    safeFields.productType = draft.suggestedProductType;
    safeFields.productTypeLabel = productTypeLabel(draft.suggestedProductType);
  }
  if (draft.suggestedBuckets.length > 0) {
    safeFields.buckets = draft.suggestedBuckets;
    safeFields.bucketLabels = draft.suggestedBuckets.map(bucketLabel);
  }
  if (draft.suggestedNotes.length > 0) {
    safeFields.notes = draft.suggestedNotes;
  }
  // The label is the objective echoed (display only). It is only a "prepared
  // field" when the objective also yielded real structure — a bare opaque
  // objective is NOT a safe field (the admin must set everything manually).
  const label = deriveLabel(draft.objective);
  if (label && hasStructure) {
    safeFields.label = label;
    safeFields.description = `Framing handoff from Product Workspace — ${label}`;
  }

  // Safe fields exist only when real structure was inferred — never from a bare
  // label echo.
  const hasSafeFields = hasStructure;

  return {
    source: "product-workspace",
    objective: draft.objective,
    methodologyVersion: PROJECTION_METHODOLOGY_VERSION,
    safeFields,
    reviewRequired: [...REVIEW_REQUIRED],
    forbiddenPrefill: [...FORBIDDEN_PREFILL],
    warnings: draft.warnings,
    hasSafeFields,
  };
}
