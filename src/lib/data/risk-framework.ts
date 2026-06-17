import "server-only";

import { prisma } from "@/lib/db";
import { fetchBtcPrice } from "@/lib/data/btc-price";
import { loadLatestTimelineSnapshot } from "@/lib/data/timeline-snapshot";
import { computeRiskBreakdown } from "@/lib/engine/risk";
import type { ScenarioInputs } from "@/lib/engine/types";
import { VAULT_YIELD } from "@/lib/engine/vaults";
import { canRunDemoProvider } from "@/lib/demo/guard";
import { buildDemoRiskFramework } from "@/lib/demo/admin/risk";
import { resolveFixtureVaultId } from "@/lib/vaults/dashboard-scope";

// ---------------------------------------------------------------------------
// Dashboard Risk Framework loader.
//
// Surfaces the 5-dimension breakdown defined in /docs/spec/08-risk-framework.mdx
// for the dashboard `<RiskFrameworkSection>` card.
//
// Strategy: build a `ScenarioInputs` from the latest VaultSnapshot, latest
// MiningMetric and the live BTC price, then delegate the numeric decomposition
// to `computeRiskBreakdown` (engine, pure). This keeps the engine untouched
// and the loader is responsible solely for I/O + I/O-flavoured fallbacks.
// ---------------------------------------------------------------------------

/**
 * Canonical risk-dimension key set, aligned with the agent schema
 * (`src/lib/agents/schemas.ts` → RiskExplanation input).
 *
 * NOTE — historical: this used to surface `"mining_ops"` to match an
 * earlier dashboard label convention; `risk-daily.ts` then had to remap
 * `mining_ops → mining` before calling the agent. The id is invisible to
 * the UI (only `label` is rendered), so we converged on the canonical
 * agent key here and removed the remap.
 */
export type RiskDimensionId =
  | "smart_contract"
  | "mining"
  | "counterparty"
  | "market"
  | "liquidity";

export type RiskStatus =
  | "OPTIMAL"
  | "STABLE"
  | "HEALTHY"
  | "AUDITED"
  | "MONITORED"
  | "ELEVATED"
  | "PRE-AUDIT"
  | "COMPRESSED"
  | "TIGHT"
  | "EXTREME"
  | "EXPOSED"
  | "BREACHED";

export type RiskSeverity = "low" | "medium" | "high";

export interface RiskDimension {
  id: RiskDimensionId;
  label: string;
  /** 1–100; higher = more risky. Matches the engine breakdown convention. */
  score: number;
  status: RiskStatus;
  severity: RiskSeverity;
  detail: string;
}

export type RiskBand = "low" | "medium" | "high";

export interface RiskFrameworkData {
  composite: number;
  band: RiskBand;
  bandLabel: string;
  dimensions: RiskDimension[];
  /** `db` when every input came from real rows; `partial`/`fallback` otherwise. */
  source: "db" | "partial" | "fallback";
}

// Stable proxy for vol_index — same constant the mining loader uses to keep
// agent inputs and dashboard inputs aligned. Real BTC realised-vol feed is
// out of MVP scope.
const VOL_INDEX_PROXY = 50;

// Stable APY proxy used when no allocation row exists yet.
const STABLE_APY_PROXY_PCT = 4.5;

// ---------------------------------------------------------------------------
// Spec thresholds (/docs/spec/08-risk-framework.mdx, table "The 5 risks").
// Lower number = greener.
// ---------------------------------------------------------------------------

interface Thresholds {
  green: number; // score < green → severity "low"
  amber: number; // green <= score < amber → severity "medium"; >= amber → "high"
}

const THRESHOLDS: Record<RiskDimensionId, Thresholds> = {
  market: { green: 40, amber: 65 },
  mining: { green: 30, amber: 60 },
  liquidity: { green: 35, amber: 55 },
  smart_contract: { green: 40, amber: 60 },
  counterparty: { green: 30, amber: 55 },
};

function severityFor(id: RiskDimensionId, score: number): RiskSeverity {
  const t = THRESHOLDS[id];
  if (score < t.green) return "low";
  if (score < t.amber) return "medium";
  return "high";
}

// Per-dimension status pill labels. Three labels per dimension covering the
// three severity bands.
const STATUS_LABELS: Record<RiskDimensionId, Record<RiskSeverity, RiskStatus>> = {
  market: { low: "STABLE", medium: "ELEVATED", high: "EXTREME" },
  mining: { low: "STABLE", medium: "MONITORED", high: "COMPRESSED" },
  liquidity: { low: "HEALTHY", medium: "MONITORED", high: "TIGHT" },
  smart_contract: { low: "AUDITED", medium: "MONITORED", high: "PRE-AUDIT" },
  counterparty: { low: "OPTIMAL", medium: "MONITORED", high: "EXPOSED" },
};

// ---------------------------------------------------------------------------
// Detail copy — short, client-facing one-liners per dimension.
// ---------------------------------------------------------------------------

function marketDetail(score: number, inputs: ScenarioInputs): string {
  const vol = Math.round(inputs.vol_index);
  if (score >= 65) {
    return `BTC vol index ${vol}/100; drawdown exposure stressed beyond tolerance.`;
  }
  if (score >= 40) {
    return `BTC vol index ${vol}/100; tactical sleeve sized within risk budget.`;
  }
  return `BTC vol index ${vol}/100; market regime supportive of full exposure.`;
}

function miningDetail(score: number, marginScore: number): string {
  if (score >= 60) {
    return `Margin score ${marginScore}/100 — hashprice / energy compressing net cashflow.`;
  }
  if (score >= 30) {
    return `Margin score ${marginScore}/100 — fleet economics within target band.`;
  }
  return `Margin score ${marginScore}/100 — fleet economics comfortably above target.`;
}

function liquidityDetail(score: number): string {
  if (score >= 55) {
    return "Redemption queue stressed; stable reserve sleeve at floor.";
  }
  if (score >= 35) {
    return "Stable reserve sleeve sized for 60-day soft lock-up window.";
  }
  return "Liquid stables cover modelled redemption demand with buffer.";
}

function smartContractDetail(score: number): string {
  if (score >= 60) {
    return "Phase 1 vault contracts pre-audit; Spearbit review scheduled before Phase 3.";
  }
  if (score >= 40) {
    return "Audited contracts; production exposure < 6 months.";
  }
  return "Audited + battle-tested > 6 months on mainnet.";
}

function counterpartyDetail(score: number): string {
  if (score >= 55) {
    return "Concentrated mining partner / custodian exposure under active review.";
  }
  if (score >= 30) {
    return "Mining partner + custodian diversified; attestations on cadence.";
  }
  return "Fully diversified mining + custody set with redundant attestations.";
}

// ---------------------------------------------------------------------------
// Composite band (matches dashboard hero `riskBandVariant()` semantics).
// ---------------------------------------------------------------------------

function compositeBand(score: number): { band: RiskBand; label: string } {
  if (score <= 33) return { band: "low", label: "Low" };
  if (score <= 50) return { band: "low", label: "Low–Moderate" };
  if (score <= 66) return { band: "medium", label: "Moderate" };
  if (score <= 80) return { band: "high", label: "Elevated" };
  return { band: "high", label: "High" };
}

// ---------------------------------------------------------------------------
// Public loader
// ---------------------------------------------------------------------------

/** Yield-only until per-vault `VaultSnapshot` lands (Phase 3). */
export const AWAITING_VAULT_RISK_SNAPSHOT: RiskFrameworkData = {
  composite: 0,
  band: "low",
  bandLabel: "Awaiting vault snapshot",
  dimensions: [],
  source: "fallback",
};

export async function loadRiskFramework(
  vaultId?: string,
): Promise<RiskFrameworkData> {
  if (canRunDemoProvider()) return buildDemoRiskFramework();

  const resolvedVaultId = resolveFixtureVaultId(vaultId);
  if (resolvedVaultId !== VAULT_YIELD.id) {
    return AWAITING_VAULT_RISK_SNAPSHOT;
  }

  const [latestSnapshot, latestMining, btcPrice] = await Promise.all([
    loadLatestTimelineSnapshot({ includeAllocations: true }),
    prisma.miningMetric.findFirst({
      orderBy: { takenAt: "desc" },
    }),
    fetchBtcPrice(),
  ]);

  if (latestSnapshot === null) {
    return {
      composite: 0,
      band: "low",
      bandLabel: "Awaiting data",
      dimensions: [],
      source: latestMining === null ? "fallback" : "partial",
    };
  }

  let usedFallback = false;
  const markFallback = (): void => {
    usedFallback = true;
  };

  // ---- Build engine inputs ------------------------------------------------
  if (latestMining === null) markFallback();

  const usdcBaseAlloc = latestSnapshot?.allocations.find(
    (a) => a.bucket === "usdc_base",
  );
  // Decimal → number at the read boundary before any arithmetic / engine call.
  const usdcBasePct = usdcBaseAlloc?.pct.toNumber() ?? 0;
  const usdcBaseBps = usdcBaseAlloc?.yieldContributionBps.toNumber() ?? 0;
  // Allocation stores `yieldContributionBps` as a contribution at the sleeve's
  // pct, not the sleeve's own APY. Recover the sleeve APY (%) by undoing the
  // weight; fall back to the proxy when bps or pct are missing.
  const stableApyPct =
    usdcBaseAlloc && usdcBasePct > 0
      ? (usdcBaseBps / usdcBasePct) / 100
      : STABLE_APY_PROXY_PCT;
  const usedStableApyProxy = !(usdcBaseAlloc && usdcBasePct > 0);
  // Realised-vol feed is out of MVP scope — vol_index is always a proxy today.
  const usesMvpInputProxies = usedStableApyProxy || true;

  if (latestMining === null) {
    return {
      composite: latestSnapshot?.riskScore ?? 0,
      band: "low",
      bandLabel: "Awaiting mining feed",
      dimensions: [],
      source: "partial",
    };
  }

  const inputs: ScenarioInputs = {
    btc_price_change_pct: btcPrice.usd === 0 ? 0 : btcPrice.usd_24h_change,
    hashprice_usd_th_day: latestMining.hashprice.toNumber(),
    energy_cost_kwh: latestMining.energyCost.toNumber(),
    stable_apy_pct: stableApyPct,
    vol_index: VOL_INDEX_PROXY,
  };

  // ---- Numeric breakdown (delegated to the engine, pure) ------------------
  const breakdown = computeRiskBreakdown(inputs);

  // Prefer the stored composite (the engine's freshly computed composite
  // should normally match, but the snapshot is the system-of-record).
  const composite = latestSnapshot
    ? latestSnapshot.riskScore
    : Math.round(breakdown.composite);

  const miningMarginScore = latestSnapshot?.miningMarginScore ?? 0;

  // ---- Compose the 5 dimensions ------------------------------------------
  const dimensions: RiskDimension[] = [
    buildDimension({
      id: "smart_contract",
      label: "Smart Contract",
      score: breakdown.smart_contract,
      detail: smartContractDetail(breakdown.smart_contract),
    }),
    buildDimension({
      id: "mining",
      label: "Mining Operations",
      // Engine `breakdown.mining` already represents *mining risk* (higher =
      // more compression), so we can use it directly. We surface the margin
      // score in the detail copy for human context.
      score: breakdown.mining,
      detail: miningDetail(breakdown.mining, miningMarginScore),
    }),
    buildDimension({
      id: "counterparty",
      label: "Counterparty",
      score: breakdown.counterparty,
      detail: counterpartyDetail(breakdown.counterparty),
    }),
    buildDimension({
      id: "market",
      label: "Market",
      score: breakdown.market,
      detail: marketDetail(breakdown.market, inputs),
    }),
    buildDimension({
      id: "liquidity",
      label: "Liquidity",
      score: breakdown.liquidity,
      detail: liquidityDetail(breakdown.liquidity),
    }),
  ];

  const { band, label: bandLabel } = compositeBand(composite);

  let source: RiskFrameworkData["source"] =
    latestSnapshot === null && latestMining === null
      ? "fallback"
      : usedFallback
        ? "partial"
        : "db";

  if (source === "db" && usesMvpInputProxies) {
    source = "partial";
  }

  return {
    composite,
    band,
    bandLabel,
    dimensions,
    source,
  };
}

interface BuildDimensionInput {
  id: RiskDimensionId;
  label: string;
  score: number;
  detail: string;
}

function buildDimension({
  id,
  label,
  score,
  detail,
}: BuildDimensionInput): RiskDimension {
  const rounded = Math.round(score);
  const severity = severityFor(id, rounded);
  return {
    id,
    label,
    score: rounded,
    status: STATUS_LABELS[id][severity],
    severity,
    detail,
  };
}
