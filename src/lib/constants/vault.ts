// Vault metadata labels — single source for admin + LP product surfaces.
// Admin uses short labels; LP uses *_LONG variants where investors need detail.

import type { VaultProduct } from "@/lib/data/vaults";

export const STRATEGY_LABELS: Record<string, string> = {
  mining_yield: "Mining Yield",
  btc_tactical: "BTC Tactical",
  stable_reserve: "Stable Reserve",
};

export const REG_LABELS: Record<string, string> = {
  regD_506c: "Reg D 506(c)",
  regS: "Reg S",
  art2_lux: "Art. 2 Lux",
};

/** LP term sheet / legal copy — full regulatory wording. */
export const REG_LABELS_LONG: Record<string, string> = {
  regD_506c: "Reg D, Rule 506(c) — US Accredited Investors",
  regS: "Reg S — Non-US Qualified Investors",
  art2_lux: "Art. 2 RAIF — EU Professional Investors",
};

export const SPV_LABELS: Record<string, string> = {
  cayman: "Cayman Islands",
  bvi: "British Virgin Islands",
  delaware: "Delaware",
  lux: "Luxembourg",
};

/** LP term sheet — full SPV legal names. */
export const SPV_LABELS_LONG: Record<string, string> = {
  cayman: "Cayman Islands Exempted Limited Partnership",
  bvi: "British Virgin Islands LP",
  delaware: "Delaware LP",
  lux: "Luxembourg RAIF",
};

export const RISK_LABELS: Record<VaultProduct["riskLevel"], string> = {
  low: "Low risk",
  "low-moderate": "Low–Moderate",
  moderate: "Moderate",
  high: "High",
};

export const VAULT_STATUS_LABEL: Record<VaultProduct["status"], string> = {
  live: "Live",
  review: "In review",
  draft: "Draft",
  paused: "Paused",
  closed: "Closed",
};

export function vaultStatusLabel(status: VaultProduct["status"]): string {
  return VAULT_STATUS_LABEL[status] ?? status;
}

/** Static institutional status labels for the investor term sheet (vault-legal-proof-rows). */
export const VAULT_CUSTODY_LABEL = "Custody configuration pending";
export const VAULT_MULTISIG_LABEL = "Multisig approval required";
export const VAULT_AUDIT_LABEL = "Spearbit · scheduled";

/** Appended after vault.disclaimers on the LP term sheet. */
export const APY_DISCLAIMER_SUFFIX = "APY ranges are target projections — not guaranteed.";

/** Shown wherever a vault has no AUM/capital yet (term sheet, product card). */
export const AUM_PENDING_LABEL = "Pending";

/** Methodology v1.0 stress regime data — Bull / Bear postures. */
export interface StressRegime {
  id: string;
  label: string;
  scenario: string;
  apyLow: number;
  apyHigh: number;
  miningPct: number;
  btcTacticalPct: number;
  usdcBasePct: number;
  stableReservePct: number;
  tone: "success" | "danger";
}

/**
 * Clamp each sleeve to [0, 100] then renormalize so the four percentages
 * always sum to exactly 100. Returns integer percentages. Safe for any
 * vault configuration, including edge cases where a tactical shift would
 * otherwise produce a negative sleeve value.
 */
function clampAndNormalizeSleeves(sleeves: {
  mining: number;
  btc: number;
  usdc: number;
  reserve: number;
}): { mining: number; btc: number; usdc: number; reserve: number } {
  const clamped = {
    mining: Math.max(0, Math.min(100, sleeves.mining)),
    btc: Math.max(0, Math.min(100, sleeves.btc)),
    usdc: Math.max(0, Math.min(100, sleeves.usdc)),
    reserve: Math.max(0, Math.min(100, sleeves.reserve)),
  };
  const sum = clamped.mining + clamped.btc + clamped.usdc + clamped.reserve;
  if (sum === 0) {
    // Degenerate case: distribute evenly.
    return { mining: 25, btc: 25, usdc: 25, reserve: 25 };
  }
  // Scale each sleeve proportionally, then round.  Assign any rounding
  // remainder to the largest sleeve to guarantee sum = 100.
  const scale = 100 / sum;
  const rounded = {
    mining: Math.round(clamped.mining * scale),
    btc: Math.round(clamped.btc * scale),
    usdc: Math.round(clamped.usdc * scale),
    reserve: Math.round(clamped.reserve * scale),
  };
  const diff = 100 - (rounded.mining + rounded.btc + rounded.usdc + rounded.reserve);
  // Apply remainder to the sleeve with the largest raw value.
  const keys = ["mining", "btc", "usdc", "reserve"] as const;
  const largest = keys.reduce((a, b) => (clamped[a] >= clamped[b] ? a : b));
  rounded[largest] += diff;
  return rounded;
}

/**
 * Derive illustrative stress-regime rows from a vault's own stated APY range
 * and target sleeve mix. The Bull posture scales toward the high end of the
 * range and shifts tactically toward riskier sleeves; the Bear posture anchors
 * near the low end and rotates into defensive sleeves.
 *
 * These are *conditional stress postures* — not projections of future returns.
 * Numbers are derived per-vault from its stated assumptions; they vary across
 * vaults and are not fixed reference values. Non-negotiable #1 and #10
 * enforced by callers.
 *
 * P1.1 safety: tactical shifts are bounded to the available sleeve before
 * application, and all four sleeve percentages are clamped to [0, 100] and
 * renormalized to sum to 100.
 */
export function deriveStressRegimes(vault: VaultProduct): StressRegime[] {
  const { apyLow, apyHigh } = vault;
  const spread = apyHigh - apyLow;

  // Bull: upper portion of the range, plus a modest outperformance extension.
  const bullLow = +(apyLow + spread * 0.5).toFixed(1);
  const bullHigh = +(apyHigh + spread * 0.1).toFixed(1);

  // Bear: lower portion of the range, minus a haircut for downside stress.
  const bearLow = +(Math.max(0, apyLow - spread * 0.1)).toFixed(1);
  const bearHigh = +(apyLow + spread * 0.3).toFixed(1);

  // Ensure APY ordering is sane (guards against exotic spread values).
  const safeBullLow = Math.min(bullLow, bullHigh);
  const safeBullHigh = Math.max(bullLow, bullHigh);
  const safeBearLow = Math.min(bearLow, bearHigh);
  const safeBearHigh = Math.max(bearLow, bearHigh);

  // Sleeve mixes — scale from the vault's target allocations.
  const miningBps = vault.targetMiningBps;
  const btcBps = vault.targetBtcTacticalBps;
  const usdcBps = vault.targetUsdcBaseBps;
  const reserveBps = vault.targetStableReserveBps;
  const total = miningBps + btcBps + usdcBps + reserveBps || 10000;

  // Bull posture: shift up to 15% of total from mining into BTC tactical.
  // Shift is bounded so it cannot exceed the available mining allocation.
  const bullBtcShift = Math.min(Math.round(total * 0.15), miningBps);
  const bull = clampAndNormalizeSleeves({
    mining: Math.round(((miningBps - bullBtcShift) / total) * 100),
    btc: Math.round(((btcBps + bullBtcShift) / total) * 100),
    usdc: Math.round((usdcBps / total) * 100),
    reserve: Math.round((reserveBps / total) * 100),
  });

  // Bear posture: shift up to 25% of total from BTC tactical into mining + reserve.
  // Shift is bounded so it cannot exceed the available BTC allocation.
  const bearBtcShift = Math.min(Math.round(total * 0.25), btcBps);
  const bear = clampAndNormalizeSleeves({
    mining: Math.round(((miningBps + Math.round(bearBtcShift * 0.7)) / total) * 100),
    btc: Math.round(((btcBps - bearBtcShift) / total) * 100),
    usdc: Math.round((usdcBps / total) * 100),
    reserve: Math.round((reserveBps / total) * 100),
  });

  return [
    {
      id: "bull",
      label: "Bull",
      scenario: "BTC rally > +20% QoQ",
      apyLow: safeBullLow,
      apyHigh: safeBullHigh,
      miningPct: bull.mining,
      btcTacticalPct: bull.btc,
      usdcBasePct: bull.usdc,
      stableReservePct: bull.reserve,
      tone: "success",
    },
    {
      id: "bear",
      label: "Bear",
      scenario: "BTC drawdown > −30% QoQ",
      apyLow: safeBearLow,
      apyHigh: safeBearHigh,
      miningPct: bear.mining,
      btcTacticalPct: bear.btc,
      usdcBasePct: bear.usdc,
      stableReservePct: bear.reserve,
      tone: "danger",
    },
  ];
}
