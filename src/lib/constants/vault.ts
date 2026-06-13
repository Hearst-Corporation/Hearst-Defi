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

export const VAULT_STATUS_VARIANT: Record<
  VaultProduct["status"],
  "success" | "warning" | "default" | "danger"
> = {
  live: "success",
  review: "warning",
  draft: "default",
  paused: "warning",
  closed: "danger",
};

export function vaultStatusLabel(status: VaultProduct["status"]): string {
  return VAULT_STATUS_LABEL[status] ?? status;
}

/** C-13 — verbatim Model B one-liner for LP surfaces. */
export const MODEL_B_ONELINER =
  "Principal held in a USDC cash reserve — not deployed on-chain; yield is a monthly mining-revenue-share distribution.";

/** Static institutional status labels for the investor term sheet (vault-legal-proof-rows). */
export const VAULT_CUSTODY_LABEL = "Custody configuration pending";
export const VAULT_MULTISIG_LABEL = "Multisig approval required";
export const VAULT_AUDIT_LABEL = "Spearbit · scheduled";

/** Appended after vault.disclaimers on the LP term sheet. */
export const APY_DISCLAIMER_SUFFIX = "APY ranges are target projections — not guaranteed.";

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

export const METHODOLOGY_V1_STRESS_REGIMES: StressRegime[] = [
  {
    id: "bull",
    label: "Bull",
    scenario: "BTC rally > +20% QoQ",
    apyLow: 12.8,
    apyHigh: 15.2,
    miningPct: 45,
    btcTacticalPct: 35,
    usdcBasePct: 12,
    stableReservePct: 8,
    tone: "success",
  },
  {
    id: "bear",
    label: "Bear",
    scenario: "BTC drawdown > −30% QoQ",
    apyLow: 5.2,
    apyHigh: 8.4,
    miningPct: 70,
    btcTacticalPct: 5,
    usdcBasePct: 15,
    stableReservePct: 10,
    tone: "danger",
  },
];
