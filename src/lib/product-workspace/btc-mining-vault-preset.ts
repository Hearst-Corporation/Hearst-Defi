/**
 * btc-mining-vault-preset.ts — a PURE, structured Product Workspace brief for the
 * committed BTC Mining Performance Vault product (`src/lib/products/*`).
 *
 * WHY this exists: the Product Workspace streams a free-text brief from the LLM
 * route, which can fail / stall / arrive empty (an "infinite spinner" with a
 * vague "The agent is writing the brief…" and no content). This module gives the
 * workspace a DETERMINISTIC, structured FALLBACK built straight from the typed
 * product constant — so there is always honest content to render, with zero LLM,
 * zero I/O, and zero invented number.
 *
 * STRICT pure contract (mirrors the engine discipline, though this is not the
 * engine): no I/O (DB/fetch/fs/network), no process.env, no Date.now(), no
 * Math.random(), no module-level side effect, no argument mutation. It only READS
 * the product constant + the pure guards — it never modifies a Builder A file.
 *
 * Honesty rules (non-negotiables #1, #5, #10; doc §12, §22):
 *  - the monthly distribution target and the total performance target are the two
 *    SAFE strings from `formatTargetsSafely` — they are NEVER summed;
 *  - every band/target is labelled `configured, not validated`;
 *  - the warnings list states the four hard rules the surface must keep visible.
 */

import {
  BTC_MINING_PERFORMANCE_VAULT,
  type BtcMiningPerformanceVault,
} from "@/lib/products/btc-mining-performance-vault";
import { formatTargetsSafely } from "@/lib/products/guards";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One allocation band, expressed as a percentage RANGE — never a single point. */
export interface BtcMiningVaultAllocationBand {
  readonly sleeve: "mining" | "btc" | "stable" | "overlay";
  readonly label: string;
  /** Lower bound, percent (30 = 30%). */
  readonly minPct: number;
  /** Upper bound, percent (40 = 40%). */
  readonly maxPct: number;
  /** Structural floor for the mining sleeve (percent); undefined for others. */
  readonly floorPct?: number;
  readonly note: string;
}

/**
 * The two honest target strings — verbatim from `formatTargetsSafely`. They are
 * carried as DISTINCT strings so the surface can never sum them.
 */
export interface BtcMiningVaultTargets {
  /** "8–12% annualized monthly distribution target" */
  readonly distribution: string;
  /** "20–24% total target over ~24 months, inclusive of distributions" */
  readonly total: string;
}

export interface BtcMiningVaultBrief {
  readonly productId: "btc-mining-performance-vault";
  readonly name: string;
  readonly category: "Mining-first BTC performance cycle";
  readonly thesis: string;
  readonly objective: string;
  readonly targetDurationMonths: number;
  readonly allocationBands: readonly BtcMiningVaultAllocationBand[];
  readonly targets: BtcMiningVaultTargets;
  readonly recovery: {
    readonly extensionMonthsMin: number;
    readonly extensionMonthsMax: number;
    readonly defaultMode: "capital_only";
    readonly note: string;
  };
  /** Status of every figure here — always "configured, not validated". */
  readonly status: "configured, not validated";
  /** The four hard rules the workspace surface must keep visible. */
  readonly warnings: readonly string[];
}

// ---------------------------------------------------------------------------
// Builder — pure, derived from the product constant.
// ---------------------------------------------------------------------------

function bandsFrom(
  product: BtcMiningPerformanceVault,
): readonly BtcMiningVaultAllocationBand[] {
  const a = product.allocation;
  return [
    {
      sleeve: "mining",
      label: "Mining sleeve",
      minPct: Math.round(a.mining.min * 100),
      maxPct: Math.round(a.mining.max * 100),
      floorPct: Math.round(a.mining.floor * 100),
      note: "Productive core — 30% structural floor; sub-floor only under governance.",
    },
    {
      sleeve: "btc",
      label: "BTC holding / collateral",
      minPct: Math.round(a.btcHoldingCollateral.min * 100),
      maxPct: Math.round(a.btcHoldingCollateral.max * 100),
      note: "Core + tactical combined; carries cycle upside and backs USDC borrowing.",
    },
    {
      sleeve: "stable",
      label: "Stable funding reserve",
      minPct: Math.round(a.stableFundingReserve.min * 100),
      maxPct: Math.round(a.stableFundingReserve.max * 100),
      note: "Funds power/ops from the cheapest source; never auto-spent first.",
    },
    {
      sleeve: "overlay",
      label: "Yield overlay",
      minPct: Math.round(a.yieldOverlay.min * 100),
      maxPct: Math.round(a.yieldOverlay.max * 100),
      note: "Excess liquidity only — never from collateral or power runway.",
    },
  ];
}

/** The four hard rules the workspace must keep visible (doc §4, §7, §12, §14). */
export const BTC_MINING_VAULT_BRIEF_WARNINGS: readonly string[] = [
  "no guarantee",
  "no double count",
  "mining floor guard",
  "recovery not a guarantee",
] as const;

/**
 * Build the structured Product Workspace brief from the committed product
 * constant. Pure: same constant → same brief; no I/O, no LLM, no invented number.
 *
 * The targets come straight from `formatTargetsSafely` (the distribution band and
 * the total band as DISTINCT strings) — the brief never sums them.
 */
export function buildBtcMiningVaultBrief(
  product: BtcMiningPerformanceVault = BTC_MINING_PERFORMANCE_VAULT,
): BtcMiningVaultBrief {
  const safe = formatTargetsSafely(product);
  return {
    productId: product.id,
    name: product.name,
    category: "Mining-first BTC performance cycle",
    thesis: product.thesis,
    objective:
      "Package a real, mining-first Bitcoin operation into an investable performance cycle: a coverage-gated monthly distribution target paid in USDC, an inclusive full-cycle performance target, an early-exit mechanism, and a capital-first recovery extension — target and expected, risk-adjusted and collateral-protected, never guaranteed.",
    targetDurationMonths: product.targetDurationMonths,
    allocationBands: bandsFrom(product),
    targets: {
      distribution: safe.distribution,
      total: safe.total,
    },
    recovery: {
      extensionMonthsMin: product.recovery.extensionMonths.min,
      extensionMonthsMax: product.recovery.extensionMonths.max,
      defaultMode: product.recovery.defaultMode,
      note: "6–12 month capital-first extension (Mode A) — maximizes the probability of full capital return; it is not a promise of recovery.",
    },
    status: "configured, not validated",
    warnings: BTC_MINING_VAULT_BRIEF_WARNINGS,
  };
}

// ---------------------------------------------------------------------------
// Matcher — deterministic regex; returns the brief only when the objective
// names this product. No LLM. Gives the workspace a structured fallback so a
// matched objective NEVER shows an empty "agent is writing…" spinner.
// ---------------------------------------------------------------------------

/**
 * Deterministic phrase matcher for the BTC Mining Performance Vault objective.
 * Accent- and case-insensitive. Matches the documented anchor phrases:
 *  - "BTC mining performance vault" / "produit mining BTC" / "vault mining"
 *  - the distribution band "8–12% mensuel" (and EN/ASCII-dash variants)
 *  - the mining band "30–40% mining"
 *
 * Numbers in the regex are STRUCTURAL anchors recognising the product's OWN
 * documented bands — they are not invented business numbers (the brief reads its
 * figures from the product constant, never from the matched text).
 */
const BTC_MINING_VAULT_OBJECTIVE_RE =
  /(btc[\s-]*mining[\s-]*performance[\s-]*vault|produit[\s-]*mining[\s-]*btc|mining[\s-]*btc|vault[\s-]*mining|mining[\s-]*vault|8\s*[–-]\s*12\s*%?\s*mensuel|30\s*[–-]\s*40\s*%?\s*mining|mining[\s-]*first)/i;

/** Lowercase + strip diacritics so "minière"/"miniere" and accents all match. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** True when the objective names the BTC Mining Performance Vault. Deterministic. */
export function matchesBtcMiningVaultObjective(objective: string): boolean {
  if (!objective || !objective.trim()) return false;
  return BTC_MINING_VAULT_OBJECTIVE_RE.test(normalize(objective));
}

/**
 * Return the structured brief ONLY when the objective matches this product, else
 * `null`. The Product Workspace uses this as a deterministic, content-bearing
 * fallback (no spinner, no empty "writing the brief…" state). Pure; no I/O.
 */
export function buildBtcMiningVaultBriefIfMatched(
  objective: string,
): BtcMiningVaultBrief | null {
  return matchesBtcMiningVaultObjective(objective)
    ? buildBtcMiningVaultBrief()
    : null;
}
