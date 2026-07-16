// Multi-vault definitions (ADR-006). Each vault is a first-class entity with its
// OWN target assumptions, share classes, and default provenance — no vault may
// reuse another's numbers silently. This module is pure: no I/O, no DB. The data
// layer (src/lib/data/*) maps DB rows onto these presets; it never lives here.

import { SHARE_CLASS_A, SHARE_CLASS_B, type ShareClassTerms } from "./share-class";
import type { AllocationBucket, VaultId, VaultMode } from "./types";
import {
  B1_MINING_ALLOCATION_BPS,
  B2_BTC_ALLOCATION_BPS,
  B3_USDC_ALLOCATION_BPS,
  PRODUCT_DURATION_MONTHS,
} from "@/lib/products/dynavault-factsheet";

export type { VaultId } from "./types";

// The flagship note's 3-pocket allocation has ONE source of truth: the bps
// constants on the factsheet (PermissionedDynaVault v2.1 §Appendix). The vault
// definition below DERIVES its percentages from them — it never restates
// 40 / 27 / 30 as literals, so a change to the factsheet flows through here.
const B1_MINING_PCT = B1_MINING_ALLOCATION_BPS / 100; // 40
const B2_BTC_PCT = B2_BTC_ALLOCATION_BPS / 100; // 27
const B3_USDC_PCT = B3_USDC_ALLOCATION_BPS / 100; // 33

// Provenance vocabulary mirrors CLAUDE.md #2 (Live / Oracle / Attested /
// Estimated / Manual / Stale). The default here is the worst-case label a vault
// definition can claim before live data is wired in.
export type Provenance =
  | "live"
  | "oracle"
  | "attested"
  | "estimated"
  | "manual"
  | "stale";

// Headline return targets are ALWAYS a range (non-negotiable #1) — never a
// single point. For the flagship mining note this band is an ESTIMATED target
// expressed in BTC accumulated over the term, not a distributed cash APY; the
// range format and the "estimated" provenance are preserved, only the meaning
// shifts (relabel, not removal).
export interface ApyTargetRange {
  low: number;
  high: number;
}

// Target allocation, in percent (0–100), per sleeve. Sums to ~100 per vault.
// v2 flagship reality (PermissionedDynaVault v2.1 §Appendix): the note is
// structured in THREE pockets — B1 mining / B2 BTC / B3 USDC reserve. It maps
// onto the four historical sleeve keys with the legacy `stable_reserve` retired
// to 0 and the single USDC reserve carried by `usdc_base`. Keeping the 4-key
// shape avoids churning the shared AllocationBucket type (./types) and its many
// downstream consumers.
export type AllocationTargets = Record<AllocationBucket, number>;

export interface VaultDefinition {
  id: VaultId;
  ticker: string;
  label: string;
  /** One-line strategy description. Forbidden-words rule (#5) applies. */
  description: string;
  /**
   * Estimated target return band (percent), always a range (#1). For the mining
   * note this represents BTC accumulated over the term (rule-based take-profit),
   * NOT a distributed cash yield — never a single point, never guaranteed.
   */
  apyTarget: ApyTargetRange;
  /** Default vault mode the strategy centres on. */
  baseMode: VaultMode;
  /** Target pocket / sleeve allocation (percent, sums to ~100). */
  allocationTargets: AllocationTargets;
  /** Share classes this vault offers. */
  shareClasses: ShareClassTerms[];
  /** Default provenance for this vault's headline metrics. */
  defaultProvenance: Provenance;
  /** Methodology version these assumptions belong to. */
  methodologyVersion: string;
  /**
   * Product term in months, when the vault carries a fixed maturity. The v2
   * mining note accumulates BTC over this term and settles at maturity (mirrors
   * `productDurationMonths()` on-chain — PermissionedDynaVault v2.1 §Appendix).
   * Optional: presets without a fixed term leave it undefined.
   */
  productDurationMonths?: number;
  /** Per-vault assumptions surfaced with every projection (#10). */
  assumptions: string[];
}

// Methodology bumps with the product: the platform moves from the cash-yield
// model (v1.0) to the BTC-accumulation mining note (v3.0). Shared across the
// presets so a single edit tracks the platform methodology version.
const METHODOLOGY_V3 = "v3.0";

// ── Hearst Yield Vault (HYV) — flagship mining note: 3 pockets, 24-month BTC accumulation ──
export const VAULT_YIELD: VaultDefinition = {
  id: "yield",
  ticker: "HYV",
  label: "Hearst Yield Vault",
  description:
    "Mining-backed BTC accumulation note: real Bitcoin mining structured across three pockets (mining power, BTC, USDC reserve), accumulating BTC over a 24-month term with rule-based take-profit; accumulated BTC is settled at maturity, with no periodic cash distribution.",
  apyTarget: { low: 8, high: 15 },
  baseMode: "balanced",
  // Three-pocket target — DERIVED from the factsheet bps constants (single
  // source of truth): B1 mining 40%, B2 BTC 27%, B3 USDC reserve 33%. The legacy
  // stable_reserve sleeve is retired (0) — the single reserve is the USDC pocket
  // carried by usdc_base.
  allocationTargets: {
    mining: B1_MINING_PCT,
    btc_tactical: B2_BTC_PCT,
    usdc_base: B3_USDC_PCT,
    stable_reserve: 0,
  },
  shareClasses: [SHARE_CLASS_A, SHARE_CLASS_B],
  defaultProvenance: "estimated",
  methodologyVersion: METHODOLOGY_V3,
  productDurationMonths: PRODUCT_DURATION_MONTHS,
  assumptions: [
    `Three-pocket structure — ${B1_MINING_PCT}% mining power, ${B2_BTC_PCT}% BTC, ${B3_USDC_PCT}% USDC reserve — driven by real Bitcoin mining; $250k minimum ticket and 60-day soft lock-up are contractual, not enforced on-chain.`,
    `Return accrues as BTC accumulated over a ${PRODUCT_DURATION_MONTHS}-month term with rule-based take-profit; there is no periodic cash distribution — accumulated BTC is settled at maturity.`,
    "Estimated target range is expressed in accumulated BTC, not a distributed cash yield. Outputs are projections, not guaranteed. Past performance does not predict future results.",
  ],
};

// ── Hearst Defensive Vault — lower risk, 5–8% estimated band, mining 15–25% ──
export const VAULT_DEFENSIVE: VaultDefinition = {
  id: "defensive",
  ticker: "HDV",
  label: "Hearst Defensive Vault",
  description:
    "Capital-preservation tilt: a larger stable reserve and USDC base sleeve, with mining capped at a low band to dampen drawdowns.",
  apyTarget: { low: 5, high: 8 },
  baseMode: "defensive",
  allocationTargets: {
    mining: 20,
    btc_tactical: 10,
    usdc_base: 35,
    stable_reserve: 35,
  },
  shareClasses: [SHARE_CLASS_A, SHARE_CLASS_B],
  defaultProvenance: "estimated",
  methodologyVersion: METHODOLOGY_V3,
  assumptions: [
    "Mining exposure held in the 15–25% band; majority in stable reserve and USDC base.",
    "Designed to reduce volatility versus the Yield Vault, at the cost of upside.",
    "Outputs are projections, not guaranteed. Past performance does not predict future results.",
  ],
};

// ── Hearst BTC Plus Vault — higher tactical BTC, 10–20% estimated band ──
export const VAULT_BTC_PLUS: VaultDefinition = {
  id: "btc-plus",
  ticker: "HBP",
  label: "Hearst BTC Plus Vault",
  description:
    "Upside-tilted strategy with a heavier BTC tactical sleeve alongside mining, accepting wider drawdowns for higher projected yield.",
  apyTarget: { low: 10, high: 20 },
  baseMode: "opportunistic",
  allocationTargets: {
    mining: 40,
    btc_tactical: 45,
    usdc_base: 10,
    stable_reserve: 5,
  },
  shareClasses: [SHARE_CLASS_A, SHARE_CLASS_B],
  defaultProvenance: "estimated",
  methodologyVersion: METHODOLOGY_V3,
  assumptions: [
    "BTC tactical sleeve is the largest single allocation; mining is secondary.",
    "Higher projected band reflects greater BTC delta and lower stable buffer.",
    "Outputs are projections, not guaranteed. Past performance does not predict future results.",
  ],
};

export const VAULTS: Record<VaultId, VaultDefinition> = {
  yield: VAULT_YIELD,
  defensive: VAULT_DEFENSIVE,
  "btc-plus": VAULT_BTC_PLUS,
};

export function getVaultDefinition(id: VaultId): VaultDefinition {
  const def = VAULTS[id];
  if (!def) {
    throw new Error(`unknown vault id: ${String(id)}`);
  }
  return def;
}

// allocationWeights in the V2 scenario contract are fractions summing to 1.0.
// A vault's allocationTargets are percentages; this is the bridge so a vault can
// be fed straight into runScenario without callers hardcoding the Yield mix.
export interface VaultAllocationWeights {
  mining: number;
  btcTactical: number;
  usdcBase: number;
  stableReserve: number;
}

export function vaultAllocationWeights(
  vault: VaultDefinition = VAULT_YIELD,
): VaultAllocationWeights {
  const t = vault.allocationTargets;
  const sum = t.mining + t.btc_tactical + t.usdc_base + t.stable_reserve;
  const denom = sum === 0 ? 1 : sum;
  return {
    mining: t.mining / denom,
    btcTactical: t.btc_tactical / denom,
    usdcBase: t.usdc_base / denom,
    stableReserve: t.stable_reserve / denom,
  };
}
