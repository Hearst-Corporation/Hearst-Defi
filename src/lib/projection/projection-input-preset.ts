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
import {
  BTC_MINING_PERFORMANCE_VAULT,
  type BtcMiningPerformanceVault,
} from "@/lib/products/btc-mining-performance-vault";
import { formatTargetsSafely } from "@/lib/products/guards";

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

// ---------------------------------------------------------------------------
// BTC Mining Performance Vault — CONFIGURED-context preset (additive)
// ---------------------------------------------------------------------------
//
// Carries the committed product's CONFIGURED, NON-FINANCIAL structural ranges as
// LABELLED-CONFIGURED context for the Projection Studio — duration, the four
// allocation ranges, the distribution band, the total target band, the recovery
// window, and machine life. EACH carries `status: "CONFIGURED"` + `validated:
// false` so a consumer can never read it as a contractual/validated term.
//
// HARD discipline (same as `buildProjectionInputPreset`): it does NOT prefill any
// ScenarioInputs business number (btc_price_change_pct, hashprice, energy_cost_kwh,
// stable_apy_pct, vol_index) — those stay in `reviewRequired` / `forbiddenPrefill`
// exactly as today. It does NOT run a study and does NOT create a record. The
// ranges below are READ from the product constant; nothing is invented.

/** A single CONFIGURED context range — display only, never a run input. */
export interface ConfiguredContextRange {
  /** What the range describes. */
  readonly label: string;
  /** Human display string — always a range or qualitative, never a single point. */
  readonly display: string;
  /** Always "CONFIGURED" — a code default, not validated by owner/DB/audit. */
  readonly status: "CONFIGURED";
  /** Always false — these are configured assumptions, not validated terms. */
  readonly validated: false;
}

export interface BtcMiningVaultProjectionPreset {
  readonly source: "btc-mining-performance-vault";
  readonly methodologyVersion: string;
  /** CONFIGURED, non-financial structural ranges (display-only context). */
  readonly configuredContext: readonly ConfiguredContextRange[];
  /** The two honest target strings — NEVER summed. */
  readonly targets: { readonly distribution: string; readonly total: string };
  /** Inputs the admin MUST review before any run (never prefilled here). */
  readonly reviewRequired: readonly string[];
  /** Business numbers that are NEVER prefilled from this preset. */
  readonly forbiddenPrefill: readonly string[];
  /** Honesty strings the surface must show. */
  readonly displayNotes: readonly string[];
  /** Always false — this preset never triggers a study. */
  readonly runsStudy: false;
  /** Always false — this preset never creates a record. */
  readonly createsRecord: false;
}

function configuredRange(label: string, display: string): ConfiguredContextRange {
  return { label, display, status: "CONFIGURED", validated: false };
}

/** The three mandatory honesty strings for the BTC Mining Vault projection preset. */
export const BTC_MINING_VAULT_PRESET_DISPLAY_NOTES: readonly string[] = [
  "All figures are configured assumptions, not validated contractual terms.",
  "Monthly distribution target is included in total performance target.",
  "Distribution is coverage-gated and not guaranteed.",
] as const;

/**
 * Build the BTC Mining Performance Vault projection preset — CONFIGURED context
 * only. Pure: reads the product constant, invents nothing, runs nothing, persists
 * nothing. Safe to call in a Server Component render.
 *
 * The distribution/total target strings come from `formatTargetsSafely` (two
 * distinct strings) — they are never summed into a single headline.
 */
export function buildBtcMiningVaultProjectionPreset(
  product: BtcMiningPerformanceVault = BTC_MINING_PERFORMANCE_VAULT,
): BtcMiningVaultProjectionPreset {
  const a = product.allocation;
  const d = product.monthlyDistributionTargetAnnualized;
  const t = product.totalPerformanceTarget;
  const safe = formatTargetsSafely(product);
  const pct = (f: number) => Math.round(f * 100);

  const configuredContext: ConfiguredContextRange[] = [
    configuredRange(
      "Target cycle duration",
      `~${product.targetDurationMonths} months`,
    ),
    configuredRange(
      "Mining allocation",
      `${pct(a.mining.min)}–${pct(a.mining.max)}% (${pct(a.mining.floor)}% structural floor)`,
    ),
    configuredRange(
      "BTC holding / collateral allocation",
      `${pct(a.btcHoldingCollateral.min)}–${pct(a.btcHoldingCollateral.max)}%`,
    ),
    configuredRange(
      "Stable funding reserve allocation",
      `${pct(a.stableFundingReserve.min)}–${pct(a.stableFundingReserve.max)}%`,
    ),
    configuredRange(
      "Yield overlay allocation",
      `${pct(a.yieldOverlay.min)}–${pct(a.yieldOverlay.max)}% (excess liquidity only)`,
    ),
    configuredRange(
      "Monthly distribution target (annualized)",
      `${pct(d.min)}–${pct(d.max)}% (coverage-gated)`,
    ),
    configuredRange(
      "Total performance target",
      `${pct(t.min)}–${pct(t.max)}% over ~${product.targetDurationMonths} months, inclusive of distributions`,
    ),
    configuredRange(
      "Recovery extension",
      `${product.recovery.extensionMonths.min}–${product.recovery.extensionMonths.max} months (capital-only default)`,
    ),
    configuredRange(
      "Machine productive life",
      `~${product.levers.machineLifeYears.value} years`,
    ),
  ];

  return {
    source: "btc-mining-performance-vault",
    methodologyVersion: PROJECTION_METHODOLOGY_VERSION,
    configuredContext,
    targets: { distribution: safe.distribution, total: safe.total },
    reviewRequired: [...REVIEW_REQUIRED],
    forbiddenPrefill: [...FORBIDDEN_PREFILL],
    displayNotes: BTC_MINING_VAULT_PRESET_DISPLAY_NOTES,
    runsStudy: false,
    createsRecord: false,
  };
}
