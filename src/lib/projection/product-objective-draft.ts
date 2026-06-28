/**
 * Product-objective → Projection input DRAFT (pure, deterministic, keyword-only).
 *
 * Turns the free-text `objective` carried from the Product Workspace into
 * READABLE, NON-EXECUTED suggestions for the Projection Studio: a coarse product
 * type and the buckets the objective seems to imply, plus honest notes/warnings.
 *
 * Hard rules (mirror the engine-purity discipline, even though this is not the
 * engine):
 *  - NO LLM, NO fetch, NO DB, NO Date.now(), NO Math.random().
 *  - NEVER invents a business number (APY, hashprice, energy, markup, LTV, fees,
 *    risk references…). It only classifies words. Numbers stay CONFIGURED and
 *    must be reviewed by the admin in the studio.
 *  - Output is a SUGGESTION, never a truth and never a run trigger.
 *
 * Keyword matching is accent-insensitive and case-insensitive so "USDC" /
 * "stablecoin" / "rendement stable" all land.
 */

export type ProjectionProductType =
  | "mining_stable_yield"
  | "stable_yield"
  | "btc_collateral"
  | "unknown";

/** Studio-facing bucket vocabulary (mirrors AllocationBucket, friendlier names). */
export type ProjectionDraftBucket = "mining" | "btc" | "usdc" | "reserve";

export interface ProjectionInputDraft {
  source: "product-workspace";
  objective: string;
  suggestedProductType: ProjectionProductType;
  suggestedBuckets: ProjectionDraftBucket[];
  suggestedNotes: string[];
  warnings: string[];
  /** True when at least one safe, non-numeric suggestion was derived. The studio
   *  may surface the structure; it NEVER pre-fills business numbers regardless. */
  canPrefill: boolean;
}

/** Lowercase + strip diacritics so "défensif"/"defensif" and "USDC"/"usdc" match. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Whole-word-ish presence test on the normalized objective. */
function has(haystack: string, ...needles: string[]): boolean {
  return needles.some((n) => haystack.includes(normalize(n)));
}

const MINING_TERMS = ["mining", "miner", "minage", "hashprice", "asic", "machine"];
const STABLE_TERMS = ["stable", "stablecoin", "usdc", "usdt", "yield", "rendement"];
const BTC_TERMS = ["btc", "bitcoin", "collateral", "ltv", "garantie btc"];
const RESERVE_TERMS = ["reserve", "réserve", "cash", "liquidity", "liquidite", "buffer"];

/**
 * Derive a non-executed Projection input draft from a Product Workspace objective.
 *
 * @param objective free-text objective carried via `?objective=` (already
 *   sanitized by the page). An empty/whitespace objective yields `unknown` with a
 *   warning and `canPrefill: false`.
 */
export function deriveProjectionInputDraft(
  objective: string,
): ProjectionInputDraft {
  const trimmed = objective.trim();
  const base: ProjectionInputDraft = {
    source: "product-workspace",
    objective: trimmed,
    suggestedProductType: "unknown",
    suggestedBuckets: [],
    suggestedNotes: [],
    warnings: [],
    canPrefill: false,
  };

  if (!trimmed) {
    return {
      ...base,
      warnings: ["No objective carried — nothing to suggest."],
    };
  }

  const n = normalize(trimmed);

  const hasMining = has(n, ...MINING_TERMS);
  const hasStable = has(n, ...STABLE_TERMS);
  const hasBtc = has(n, ...BTC_TERMS);
  const hasReserve = has(n, ...RESERVE_TERMS);

  // Buckets — keyword-derived, de-duplicated, stable order.
  const buckets: ProjectionDraftBucket[] = [];
  if (hasMining) buckets.push("mining");
  if (hasBtc) buckets.push("btc");
  if (hasStable) buckets.push("usdc");
  if (hasReserve) buckets.push("reserve");

  // Product type — coarse classification, precedence: mining+stable > btc > stable.
  let productType: ProjectionProductType = "unknown";
  if (hasMining && hasStable) {
    productType = "mining_stable_yield";
  } else if (hasBtc && !hasMining) {
    productType = "btc_collateral";
  } else if (hasStable && !hasMining) {
    productType = "stable_yield";
  } else if (hasMining) {
    // mining mentioned without an explicit stable sleeve → still mining-led.
    productType = "mining_stable_yield";
  }

  const notes: string[] = [];
  if (buckets.length > 0) {
    notes.push(
      `Suggested structure: ${buckets.map(bucketLabel).join(" + ")}.`,
    );
  }
  notes.push(
    "Suggestions are derived from objective keywords only — no business numbers were inferred.",
  );

  const warnings: string[] = [];
  if (productType === "unknown") {
    warnings.push(
      "Could not infer a product type from the objective — review and pick inputs manually.",
    );
  }
  warnings.push(
    "All business assumptions (hashprice, energy, APY, BTC scenario, fees, risk) stay CONFIGURED and must be reviewed before any run.",
  );

  return {
    ...base,
    suggestedProductType: productType,
    suggestedBuckets: buckets,
    suggestedNotes: notes,
    warnings,
    canPrefill: productType !== "unknown" || buckets.length > 0,
  };
}

/** Human label for a draft bucket (display only). */
export function bucketLabel(bucket: ProjectionDraftBucket): string {
  switch (bucket) {
    case "mining":
      return "Mining";
    case "btc":
      return "BTC";
    case "usdc":
      return "USDC";
    case "reserve":
      return "Reserve";
  }
}

/** Human label for a product type (display only). */
export function productTypeLabel(type: ProjectionProductType): string {
  switch (type) {
    case "mining_stable_yield":
      return "Mining + stable yield";
    case "stable_yield":
      return "Stable yield";
    case "btc_collateral":
      return "BTC collateral";
    case "unknown":
      return "Unknown";
  }
}
