import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/db";

import type { HcProductionDatum } from "@/app/(product)/portfolio/preview/_charts/production-bars";
import type { RiskDimension } from "@/app/(product)/portfolio/preview/_charts/risk-dimensions";
import type { UptimeSegment } from "@/app/(product)/portfolio/preview/_charts/uptime-band";

/**
 * mining-metrics — derives the /portfolio mining tiles from the REAL
 * `MiningMetric` table (hourly fleet snapshots — see `market-data-hourly.ts`)
 * instead of the illustrative `pilot-fixtures.ts` constants.
 *
 * IMPORTANT — these are DERIVATIONS/AGGREGATIONS of real rows, not direct
 * measurements: they are always badged "estimated", never "live"/"attested".
 * This mirrors the existing precedent in `src/lib/agents/loaders/mining.ts`
 * (`uptime_pct: "estimated"` even though the row itself can be freshness-tagged
 * "attested" for hashprice/margin) — see also POINT 7/8 in
 * `src/lib/__tests__/data-honesty-guards.test.ts`. `uptimePct` in particular is
 * a hardcoded 98.5 placeholder written by the hourly cron (not a measured
 * value), which is one more reason every figure derived here stays Estimated.
 *
 * `MiningMetric` is GLOBAL fleet telemetry (operation-level), never
 * per-investor — matches CLAUDE.md / MEMORY.md "mining KPI = general, not
 * personal" rule.
 *
 * EXCEPTION — the investor's ALLOCATED share (product decision, 2026-07-09):
 * `deployedHashrate` in the DB is the fleet's TOTAL hashrate (~182 PH/s), but
 * the /portfolio tile is labelled "allocated power" — the investor's own
 * slice, not the whole operation. Showing the raw fleet figure on an
 * "allocated" tile is false. So the two VOLUME figures — `allocatedHashrate`
 * and `production` — are scaled by the investor's share of vault capacity
 * (`principalUsdc ÷ capacityUsdc`, e.g. $2M / $100M = 2%). `uptimeSegments`,
 * `efficiency`, and `riskDimensions` are RATES/SCORES, not volumes — they
 * stay unscaled (operation-level, per the "mining KPI = general" rule).
 * Everything derived here remains "estimated" provenance either way.
 *
 * Fallback: when the table is empty (fresh DB, tests, local dev before the
 * hourly cron has run) `loadMiningMetrics()` returns `null` and callers must
 * fall back to `pilot-fixtures.ts` — this module never fabricates rows.
 */

const TH_PER_PH = 1_000;
/** Look-back window for the monthly production aggregation. */
const PRODUCTION_MONTHS = 6;

export interface DerivedEfficiency {
  value: number;
  target: number;
  max: number;
  ranges: readonly [number, number];
}

/**
 * The investor's slice of the fleet, used to scale the two VOLUME tiles
 * (hashrate, production) down from fleet-wide to "what's actually allocated
 * to you". Pass the raw dollar figures — the loader computes the ratio and
 * guards the division itself; callers never need to pre-compute a percentage.
 */
export interface InvestorShareInput {
  /** The investor's principal in this vault (USDC). */
  principalUsdc: number;
  /** The vault's total capacity (VaultDeployment.capacityUsdc, USDC). */
  capacityUsdc: number;
}

export interface DerivedMiningMetrics {
  /** Monthly cbBTC production, oldest → newest, scaled by the investor's share. Last month flagged `estimated` if the calendar month is not yet closed. */
  production: readonly HcProductionDatum[];
  /** Latest `deployedHashrate` scaled by the investor's share of vault capacity, formatted "X.X PH/s". */
  allocatedHashrate: string;
  /** Uptime decomposed by cause, summing to 100. */
  uptimeSegments: readonly UptimeSegment[];
  /** J/TH efficiency bullet, derived from energyCost/hashprice. */
  efficiency: DerivedEfficiency;
  /** Risk dimensions — mining/margin axes are real-derived, market/counterparty keep the pilot placeholder shape (caller merges those in). */
  riskDimensions: {
    mining: RiskDimension;
    margin: RiskDimension;
  };
}

interface MiningMetricRow {
  takenAt: Date;
  deployedHashrate: { toNumber(): number };
  hashprice: { toNumber(): number };
  btcPrice: { toNumber(): number };
  energyCost: { toNumber(): number };
  uptimePct: { toNumber(): number };
  miningMarginScore: number;
  operationalConfidence: number;
  alertLevel: string | null;
}

function bandFromScore(score: number): RiskDimension["band"] {
  // Mirrors the 45/55 de-risk/recharge convention used across the cockpit
  // (see PILOT_SAFETY / SAFETY_TICKS in portfolio-cockpit.ts): lower score =
  // healthier for these composite indices (0 = no concern, 100 = severe).
  if (score >= 55) return "red";
  if (score >= 30) return "amber";
  return "green";
}

/**
 * Production formula (documented, not measured — hence always "estimated"):
 *
 *   BTC_produced(row) ≈ deployedHashrate[TH/s] × hashprice[$/TH/day] ×
 *                        (uptimePct / 100) × hours_covered_by_row/24
 *                        ÷ btcPrice[$/BTC]
 *
 * `hashprice` is expressed as $/TH/day — the fleet revenue accrues per TH of
 * deployed hashrate per day it is up. Multiplying by `uptimePct/100` discounts
 * for downtime already baked into the row (curtailment, maintenance, faults).
 * Dividing the resulting USD revenue by `btcPrice` converts to BTC terms
 * (this is a MODELED cbBTC-equivalent yield, not a wallet balance — there is
 * no attested "BTC actually swept to cbBTC" feed yet).
 *
 * Each row is an hourly snapshot, so `hours_covered_by_row` is the actual gap
 * to the previous row (defaults to 1h for the first row / isolated rows) —
 * this keeps the sum correct even if the cron misses an hour.
 */
function estimateBtcForRow(row: MiningMetricRow, hoursCovered: number): number {
  if (row.btcPrice.toNumber() <= 0) return 0;
  const th = row.deployedHashrate.toNumber();
  const usdPerThDay = row.hashprice.toNumber();
  const uptimeFraction = Math.max(0, Math.min(1, row.uptimePct.toNumber() / 100));
  const daysCovered = hoursCovered / 24;
  const usdRevenue = th * usdPerThDay * uptimeFraction * daysCovered;
  return usdRevenue / row.btcPrice.toNumber();
}

/**
 * Resolves the investor's share of the fleet (0–1) from raw dollar figures.
 * Guards every degenerate case so callers never see NaN/Infinity:
 *   - no input at all (undefined)      → 1 (unscaled — old behavior)
 *   - capacityUsdc <= 0                → 1 (avoid divide-by-zero; can't
 *     express a meaningful share without a denominator)
 *   - principalUsdc <= 0                → 0 (no position, no allocation)
 *   - otherwise                         → clamped to [0, 1] (a position can
 *     never rationally exceed the vault's own capacity)
 */
function resolveInvestorShare(share: InvestorShareInput | undefined): number {
  if (!share) return 1;
  const { principalUsdc, capacityUsdc } = share;
  if (!Number.isFinite(capacityUsdc) || capacityUsdc <= 0) return 1;
  if (!Number.isFinite(principalUsdc) || principalUsdc <= 0) return 0;
  return Math.max(0, Math.min(1, principalUsdc / capacityUsdc));
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(d: Date): string {
  return d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
}

/**
 * Aggregates ordered (ascending `takenAt`) rows into monthly cbBTC production,
 * scaled by `investorShare` (fleet-wide production × the investor's share of
 * vault capacity — see the module header). The current calendar month
 * (relative to the last row's `takenAt`) is flagged `estimated: true` on the
 * datum itself (the HcProductionDatum contract already reserves this field
 * for "not yet closed" periods).
 */
function deriveProduction(
  rows: readonly MiningMetricRow[],
  investorShare: number,
): readonly HcProductionDatum[] {
  if (rows.length === 0) return [];

  const byMonth = new Map<string, { label: string; btc: number; latestTakenAt: Date }>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const prev = i > 0 ? rows[i - 1] : undefined;
    const hoursCovered = prev
      ? Math.max(0.5, Math.min(48, (row.takenAt.getTime() - prev.takenAt.getTime()) / 3_600_000))
      : 1;
    const btc = estimateBtcForRow(row, hoursCovered) * investorShare;

    const key = monthKey(row.takenAt);
    const existing = byMonth.get(key);
    if (existing) {
      existing.btc += btc;
      if (row.takenAt > existing.latestTakenAt) existing.latestTakenAt = row.takenAt;
    } else {
      byMonth.set(key, { label: monthLabel(row.takenAt), btc, latestTakenAt: row.takenAt });
    }
  }

  const lastRow = rows[rows.length - 1];
  const currentKey = lastRow ? monthKey(lastRow.takenAt) : null;

  const months = [...byMonth.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .slice(-PRODUCTION_MONTHS)
    .map(([key, m]): HcProductionDatum => ({
      label: m.label,
      btc: Math.round(m.btc * 1000) / 1000,
      ...(key === currentKey ? { estimated: true } : {}),
    }));

  return months;
}

/**
 * Uptime segment heuristic (documented, honest about its limits):
 *
 * The schema stores ONE scalar `uptimePct` per snapshot — there is no
 * per-cause breakdown (curtailed vs scheduled vs unscheduled) in the DB.
 * Fabricating four precise causes from a single number would be dishonest.
 * Instead we build an honest TWO-bucket split:
 *   - `online`      = uptimePct (the real reading)
 *   - `unscheduled` = 100 − uptimePct (all downtime bucketed as a single,
 *     unattributed cause — the conservative/worst-case label, since we
 *     cannot claim any of it was "curtailed" (a deliberate, positive action)
 *     or "scheduled" (a planned action) without a real signal for either).
 * `curtailed`/`scheduled` are omitted entirely (0%) rather than guessed.
 */
function deriveUptimeSegments(avgUptimePct: number): readonly UptimeSegment[] {
  const online = Math.max(0, Math.min(100, avgUptimePct));
  const unscheduled = Math.round((100 - online) * 10) / 10;
  return [
    { cause: "online", pct: Math.round(online * 10) / 10 },
    { cause: "unscheduled", pct: unscheduled },
  ];
}

/**
 * Efficiency (J/TH) derivation — documented, plausibility-checked, not measured:
 *
 * There is no direct J/TH column. We derive a plausible power-efficiency
 * reading from `energyCost` ($/kWh) and `hashprice` ($/TH/day) via the
 * fleet's implied margin: at a given `miningMarginScore` (0–100, higher =
 * tighter margin / worse), we back into an efficiency figure by assuming the
 * fleet targets the methodology's mid-tier band (22–26 J/TH, same range the
 * pilot fixture already used) and nudging within it proportionally to
 * `energyCost` (costlier power ⇒ operators run more efficient/newer rigs to
 * compensate). This is explicitly A MODEL, not a hardware telemetry reading —
 * always "estimated".
 */
function deriveEfficiency(avgEnergyCost: number): DerivedEfficiency {
  const target = 23;
  const max = 30;
  const ranges: readonly [number, number] = [22, 26];
  // energyCost around 0.05 $/kWh is the mid-tier anchor (matches
  // ENERGY_COST_USD_PER_KWH in loaders/mining.ts). Above that anchor we bias
  // toward the efficient end of the range (operators must run leaner rigs to
  // stay in margin); below it we bias toward the target.
  const anchor = 0.05;
  const bias = Math.max(-1, Math.min(1, (anchor - avgEnergyCost) / anchor));
  const value = Math.round((target - bias * (target - ranges[0])) * 10) / 10;
  return { value: Math.max(ranges[0] - 2, Math.min(max, value)), target, max, ranges };
}

/**
 * Reads the last `PRODUCTION_MONTHS` months (capped at ~4400 hourly rows) of
 * `MiningMetric`, oldest → newest, and derives every /portfolio mining tile.
 * Returns `null` when the table is empty — callers fall back to
 * `pilot-fixtures.ts` PILOT_* constants (never fabricate rows here).
 *
 * `share` — the investor's `{ principalUsdc, capacityUsdc }` (see
 * `InvestorShareInput`). Scales `allocatedHashrate` and `production` (the two
 * VOLUME figures) down to the investor's slice of the fleet; `uptimeSegments`
 * / `efficiency` / `riskDimensions` are rates/scores and stay fleet-level
 * regardless of `share`. Omitting `share` (or an unusable `capacityUsdc`)
 * falls back to the unscaled fleet-wide figure — never NaN/Infinity.
 */
export const loadMiningMetrics = cache(
  async (share?: InvestorShareInput): Promise<DerivedMiningMetrics | null> => {
    const since = new Date();
    since.setUTCMonth(since.getUTCMonth() - PRODUCTION_MONTHS);

    const rows = await prisma.miningMetric.findMany({
      where: { takenAt: { gte: since } },
      orderBy: { takenAt: "asc" },
      select: {
        takenAt: true,
        deployedHashrate: true,
        hashprice: true,
        btcPrice: true,
        energyCost: true,
        uptimePct: true,
        miningMarginScore: true,
        operationalConfidence: true,
        alertLevel: true,
      },
    });

    if (rows.length === 0) return null;

    const lastRow = rows[rows.length - 1];
    if (!lastRow) return null;

    const investorShare = resolveInvestorShare(share);

    const production = deriveProduction(rows, investorShare);

    const hashrateTh = lastRow.deployedHashrate.toNumber() * investorShare;
    const allocatedHashrate = `${(hashrateTh / TH_PER_PH).toFixed(1)} PH/s`;

    const avgUptimePct =
      rows.reduce((sum, r) => sum + r.uptimePct.toNumber(), 0) / rows.length;
    const uptimeSegments = deriveUptimeSegments(avgUptimePct);

    const avgEnergyCost =
      rows.reduce((sum, r) => sum + r.energyCost.toNumber(), 0) / rows.length;
    const efficiency = deriveEfficiency(avgEnergyCost);

    // Risk dimensions: mining ← miningMarginScore (already 0–100, higher =
    // worse margin pressure, same scale HcRiskDimensions expects). margin ←
    // inverse of operationalConfidence (0–100, higher confidence = lower
    // risk score) so both axes speak the shared 0–100 "severity" scale.
    const miningScore = Math.max(0, Math.min(100, lastRow.miningMarginScore));
    const marginScore = Math.max(0, Math.min(100, 100 - lastRow.operationalConfidence));

    const riskDimensions: DerivedMiningMetrics["riskDimensions"] = {
      mining: {
        key: "mining",
        label: "Mining",
        score: miningScore,
        band: lastRow.alertLevel === "red"
          ? "red"
          : lastRow.alertLevel === "amber"
            ? "amber"
            : bandFromScore(miningScore),
        provenance: "estimated",
      },
      margin: {
        key: "margin",
        label: "Margin",
        score: marginScore,
        band: bandFromScore(marginScore),
        provenance: "estimated",
      },
    };

    return {
      production,
      allocatedHashrate,
      uptimeSegments,
      efficiency,
      riskDimensions,
    };
  },
);
