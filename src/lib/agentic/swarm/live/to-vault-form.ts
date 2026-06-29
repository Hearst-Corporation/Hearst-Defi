/**
 * Map a product-construction draft → a partial vault-wizard form.
 *
 * The construction pipeline produces a numeric DRAFT (APY range, mining/USDC
 * mix, inferred vault). This pure mapper turns the parts we can derive HONESTLY
 * into the wizard's `CreateDraftInput` shape so the admin can open the vault
 * wizard pre-filled and finish the rest (fees, SPV, signers) by hand.
 *
 * Pure: no I/O. It never invents a fee, jurisdiction, or signer — those stay
 * empty for the admin to complete. APY stays a range (#1); allocations always
 * sum to 10000 bps. Read-only: producing this object writes nothing; the wizard
 * receives it via a URL param (no DB persistence on the handoff).
 */

import type { ProductConstructionDraft } from "./types";

/** Subset of CreateDraftInput we can derive from a construction draft. */
export interface VaultFormPrefill {
  ticker: string;
  name: string;
  strategy: "mining_yield" | "btc_tactical" | "stable_reserve";
  targetApyLowBps: number;
  targetApyHighBps: number;
  targetMiningBps: number;
  targetBtcTacticalBps: number;
  targetUsdcBaseBps: number;
  targetStableReserveBps: number;
  disclaimers: string[];
}

function clampBps(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(10_000, Math.round(n));
}

/** Pick the wizard strategy enum from the inferred vault ticker. */
function strategyForTicker(
  ticker: string,
): "mining_yield" | "btc_tactical" | "stable_reserve" {
  const t = ticker.toUpperCase();
  if (t.includes("BTC") || t.includes("HBP")) return "btc_tactical";
  if (t.includes("DEF") || t.includes("HDV")) return "stable_reserve";
  return "mining_yield";
}

/**
 * Build the prefill. Allocations: mining + USDC come from the draft; the
 * remainder (to reach 10000 bps) goes to a stable reserve so the wizard's
 * sum-to-100% invariant holds. APY bounds are the headline range (never a point).
 */
export function constructionDraftToVaultForm(
  draft: ProductConstructionDraft,
): VaultFormPrefill {
  const lowBps = clampBps(draft.quant.headlineRange.low * 10_000);
  // Guarantee high > low (the wizard refines on it). If the MC range collapsed
  // or went negative, widen by a nominal 100 bps so the form stays valid.
  const highRaw = clampBps(draft.quant.headlineRange.high * 10_000);
  const highBps = highRaw > lowBps ? highRaw : lowBps + 100;

  // Allocation: ALWAYS read the canonical allocation when present (the SINGLE
  // source of truth). This guarantees the wizard prefill, the summary, the
  // scenario cards and the write-up all carry the SAME mining weight (≥30% for
  // the BTC mining product) — never the old yield-mix proportion that produced
  // a sub-floor mining % (e.g. 2.92%) in the wizard while the cards showed 30%.
  let miningBps: number;
  let btcTacticalBps: number;
  let usdcBps: number;
  let stableReserveBps: number;

  if (draft.canonicalAllocation) {
    const a = draft.canonicalAllocation;
    miningBps = clampBps(a.mining * 100);
    btcTacticalBps = clampBps(a.btcHoldingCollateral * 100);
    usdcBps = clampBps(a.yieldOverlay * 100);
    stableReserveBps = clampBps(a.stableReserve * 100);
    // Re-normalise to exactly 10000 by absorbing the rounding slack into the
    // stable reserve (keeps the wizard's sum-to-100% invariant).
    const sum = miningBps + btcTacticalBps + usdcBps + stableReserveBps;
    stableReserveBps = clampBps(stableReserveBps + (10_000 - sum));
  } else {
    // Legacy fallback (no canonical allocation): derive from the yield mix.
    const miningPct = Math.max(0, draft.strategy.miningYieldPct);
    const usdcPct = Math.max(0, draft.strategy.usdcYieldPct);
    const denom = miningPct + usdcPct;
    miningBps = denom > 0 ? clampBps((miningPct / denom) * 6_000) : 3_000;
    usdcBps = denom > 0 ? clampBps((usdcPct / denom) * 6_000) : 3_000;
    btcTacticalBps = 0;
    const allocated = miningBps + usdcBps;
    stableReserveBps = clampBps(10_000 - allocated);
    if (miningBps + usdcBps + stableReserveBps > 10_000) {
      const over = miningBps + usdcBps + stableReserveBps - 10_000;
      usdcBps = Math.max(0, usdcBps - over);
    }
    const total = miningBps + usdcBps + stableReserveBps;
    if (total < 10_000) stableReserveBps += 10_000 - total;
    miningBps = clampBps(miningBps);
    usdcBps = clampBps(usdcBps);
    stableReserveBps = clampBps(stableReserveBps);
  }

  return {
    ticker: draft.vault.ticker.slice(0, 8),
    name: draft.vault.label.slice(0, 80),
    strategy: strategyForTicker(draft.vault.ticker),
    targetApyLowBps: lowBps,
    targetApyHighBps: highBps,
    targetMiningBps: miningBps,
    targetBtcTacticalBps: btcTacticalBps,
    targetUsdcBaseBps: usdcBps,
    targetStableReserveBps: stableReserveBps,
    // Carry the construction assumptions as disclaimers so provenance follows.
    disclaimers: [
      "Pre-filled from a live-read product-construction draft — not guaranteed.",
      ...draft.strategy.assumptions.slice(0, 4),
    ],
  };
}

/** Encode the prefill for a URL param (base64 of JSON). Pure. */
export function encodeVaultFormPrefill(prefill: VaultFormPrefill): string {
  const json = JSON.stringify(prefill);
  // btoa is available in both the browser and the Node runtime used here.
  return typeof btoa === "function"
    ? btoa(unescape(encodeURIComponent(json)))
    : Buffer.from(json, "utf-8").toString("base64");
}

/** Decode a URL prefill param back to a partial form. Returns null on garbage. */
export function decodeVaultFormPrefill(
  raw: string | undefined | null,
): Partial<VaultFormPrefill> | null {
  if (!raw) return null;
  try {
    const json =
      typeof atob === "function"
        ? decodeURIComponent(escape(atob(raw)))
        : Buffer.from(raw, "base64").toString("utf-8");
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    // Whitelist the known numeric/string fields so a crafted param can't inject
    // arbitrary keys into the form.
    const p = parsed as Record<string, unknown>;
    const out: Partial<VaultFormPrefill> = {};
    if (typeof p.ticker === "string") out.ticker = p.ticker.slice(0, 8);
    if (typeof p.name === "string") out.name = p.name.slice(0, 80);
    if (
      p.strategy === "mining_yield" ||
      p.strategy === "btc_tactical" ||
      p.strategy === "stable_reserve"
    ) {
      out.strategy = p.strategy;
    }
    for (const key of [
      "targetApyLowBps",
      "targetApyHighBps",
      "targetMiningBps",
      "targetBtcTacticalBps",
      "targetUsdcBaseBps",
      "targetStableReserveBps",
    ] as const) {
      if (typeof p[key] === "number" && Number.isFinite(p[key])) {
        out[key] = clampBps(p[key] as number);
      }
    }
    if (
      Array.isArray(p.disclaimers) &&
      p.disclaimers.every((d) => typeof d === "string")
    ) {
      out.disclaimers = (p.disclaimers as string[]).slice(0, 6);
    }
    return out;
  } catch {
    return null;
  }
}
