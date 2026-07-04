import "server-only";

import { prisma } from "@/lib/db";
import { METHODOLOGY_ANCHORS } from "@/lib/engine/methodology";
import type {
  MiningHealthInput,
  MiningHealthProvenance,
} from "@/lib/agents/mining-health";
import type { ProvenanceTag } from "@/lib/agents/schemas";
import { fetchHashprice, type HashpriceData } from "@/lib/data/hashprice";
import { evaluateFreshness, STALE_THRESHOLDS } from "@/lib/data/freshness";
import { computeMiningRevenue } from "@/lib/engine/mining";

/**
 * Operational snapshot of the mining fleet for the Investor Memo PDF.
 *
 * Distinct from `MiningHealthInput` (which projects rolling indicators onto
 * the agent's expected shape). Here we expose human-facing numbers that land
 * verbatim on the PDF page (hashrate badge, uptime KPI, attestations count).
 */
export interface MiningOpsSnapshot {
  /** Hashrate deployed across the operator fleet, expressed in PH/s. */
  hashrate_ph_s: number;
  /** Uptime over the look-back window, 0–100. */
  uptime_pct: number;
  /** Engine-derived margin composite, 0–100. */
  margin_score: number;
  /** Count of `mining_attestation` proofs published over the look-back window. */
  attestations_count: number;
  /**
   * Live hashprice context (USD per TH per day) recomputed from
   * mempool.space difficulty + Coingecko BTC price when available.
   * `null` when both fail and we fall back to the DB-only snapshot.
   */
  hashprice?: HashpriceData | null;
  /**
   * True when the operational figures (hashrate, uptime, attestations) are the
   * DB-empty fallback rather than measured/attested rows. Consumers MUST badge
   * fallback figures as `estimated`/`stale`, never `attested` (B3).
   */
  is_fallback?: boolean;
}

/** Default look-back window for the ops snapshot (30 days). */
const OPS_WINDOW_DAYS = 30;

/**
 * Mode vérité live: when the DB has no MiningMetric / Proof rows, we report
 * zeros for measured metrics (hashrate, uptime) but use the methodology v1.0
 * anchor for the margin score so the dashboard isn't "dead". Flagged
 * `is_fallback` so consumers badge them as `estimated` (B3).
 */
const OPS_FALLBACK: MiningOpsSnapshot = {
  hashrate_ph_s: 0,
  uptime_pct: 0,
  margin_score: METHODOLOGY_ANCHORS.MINING_MARGIN_SCORE, // Methodology v1.0 anchor
  attestations_count: 0,
};

/** Conversion: schema stores `deployedHashrate` in TH/s; PDF wants PH/s. */
const TH_PER_PH = 1_000;

/**
 * Industry-average energy cost ($/kWh) used to recompute `margin_score`
 * from the live hashprice. No public real-time feed exists for this —
 * private hosting contracts are negotiated and confidential. We pin a
 * conservative mid-tier number (5¢/kWh) so the live margin_score moves
 * with hashprice + BTC price but stays comparable across runs.
 */
const ENERGY_COST_USD_PER_KWH = 0.05;

/**
 * Default stable APY (%) passed to the engine for margin computation.
 * The engine does not actually use this for `margin_score` (only revenue
 * inputs matter) but `ScenarioInputs` requires it.
 */
const ENGINE_STABLE_APY_PCT = 3.8;
const ENGINE_VOL_INDEX = 50;

/**
 * Reads the most recent `MiningMetric` row and projects it onto the shape
 * consumed by the Mining Health Agent.
 *
 * Field mapping (schema → agent input):
 *   - hashprice           → hashprice_usd_per_th  (USD per TH per day)
 *   - hashpriceTrendPct   → difficulty_change_pct (signed % over the period)
 *   - miningMarginScore   → margin_pct           (margin score is stored as an integer 0–100;
 *                                                  we use it directly as a percentage proxy because
 *                                                  the engine already normalises margin onto that scale)
 *   - uptimePct           → uptime_pct
 *   - constant 30         → period_days          (we operate on rolling 30-day windows per spec)
 *
 * The mapping is intentionally conservative: we do NOT derive new aggregates
 * here (no I/O inside the engine; this loader sits *next to* the engine in
 * the data-access layer but its job is read-only projection). Aggregation is
 * the seed job's responsibility.
 */
export async function loadLatestMiningMetrics(): Promise<MiningHealthInput> {
  const row = await prisma.miningMetric.findFirst({
    orderBy: { takenAt: "desc" },
  });

  if (!row) {
    throw new Error("No mining metrics in DB. Run pnpm db:seed.");
  }

  // All the columns we read below are non-nullable in `prisma/schema.prisma`,
  // but we re-assert at runtime to surface a clear error if the schema drifts.
  if (row.hashprice === null || row.hashprice === undefined) {
    throw new Error("MiningMetric.hashprice is null — invalid seed data.");
  }
  if (row.hashpriceTrendPct === null || row.hashpriceTrendPct === undefined) {
    throw new Error("MiningMetric.hashpriceTrendPct is null — invalid seed data.");
  }
  if (row.miningMarginScore === null || row.miningMarginScore === undefined) {
    throw new Error("MiningMetric.miningMarginScore is null — invalid seed data.");
  }
  if (row.uptimePct === null || row.uptimePct === undefined) {
    throw new Error("MiningMetric.uptimePct is null — invalid seed data.");
  }

  // Provenance (CLAUDE.md #2): hashprice/difficulty/margin are measured/derived
  // operational columns. They are `attested` while the snapshot is within its
  // freshness SLO; a row older than the SLO is `stale` (no fabrication — the
  // value is real, just aged). We resolve ONE freshness verdict for the row
  // and apply it to those three metrics since they all come from the same
  // `takenAt` snapshot.
  const rowTag: ProvenanceTag =
    evaluateFreshness(row.takenAt, STALE_THRESHOLDS.portfolio_snapshot) === "stale"
      ? "stale"
      : "attested";
  // `uptimePct` is NOT measured: `market-data-hourly.ts` writes a hardcoded
  // placeholder (98.5) on every row pending a real fleet uptime feed — no
  // freshness verdict can make a fabricated constant "attested". Always
  // `estimated` so the agent flags it in-line instead of presenting it as
  // attested fact.
  const provenance: MiningHealthProvenance = {
    hashprice_usd_per_th: rowTag,
    difficulty_change_pct: rowTag,
    margin_pct: rowTag,
    uptime_pct: "estimated",
  };

  // Decimal → number at the loader boundary (engine/agent shapes are `number`).
  return {
    hashprice_usd_per_th: row.hashprice.toNumber(),
    difficulty_change_pct: row.hashpriceTrendPct.toNumber(),
    margin_pct: row.miningMarginScore,
    uptime_pct: row.uptimePct.toNumber(),
    period_days: 30,
    provenance,
  };
}

/**
 * Reads the last `OPS_WINDOW_DAYS` of `MiningMetric` rows plus the count of
 * `mining_attestation` proofs in the same window and projects them onto the
 * PDF-friendly `MiningOpsSnapshot` shape.
 *
 * Decisions:
 *   - `hashrate_ph_s`: average of `deployedHashrate` across the window,
 *     converted from TH/s to PH/s. Average (not last) so a spike on the most
 *     recent row does not distort the headline number reported to LPs.
 *   - `uptime_pct`: arithmetic mean of `uptimePct` across the window. The
 *     schema does not expose a binary "up/down" flag — averaging the recorded
 *     percentages is the closest faithful projection.
 *   - `margin_score`: the most recent `miningMarginScore` (engine output is
 *     already a 0–100 composite; averaging would smear regime shifts).
 *   - `attestations_count`: count of `Proof.proofType = "mining_attestation"`
 *     posted on or after the window start.
 *
 * Fallback: if the DB has no rows in the window, returns the canned
 * `OPS_FALLBACK` so the PDF still renders during dev / before seeding. On
 * Prisma transport errors (pool timeout, Supabase unreachable), returns the
 * same flagged fallback instead of crashing the dashboard.
 */
function liveMarginFromHashprice(hashprice: HashpriceData): number | null {
  if (hashprice.usd_per_th_day <= 0 || hashprice.stale) return null;
  return computeMiningRevenue({
    btc_price_change_pct: 0,
    hashprice_usd_th_day: hashprice.usd_per_th_day,
    energy_cost_kwh: ENERGY_COST_USD_PER_KWH,
    stable_apy_pct: ENGINE_STABLE_APY_PCT,
    vol_index: ENGINE_VOL_INDEX,
  }).margin_score;
}

function miningOpsTransportFallback(hashprice: HashpriceData): MiningOpsSnapshot {
  const liveMarginScore = liveMarginFromHashprice(hashprice);
  return {
    ...OPS_FALLBACK,
    margin_score: liveMarginScore ?? OPS_FALLBACK.margin_score,
    hashprice,
    is_fallback: true,
  };
}

export async function loadMiningOpsSnapshot(
  opts: { periodEnd?: Date } = {},
): Promise<MiningOpsSnapshot> {
  const periodEnd = opts.periodEnd ?? new Date();
  const periodStart = new Date(periodEnd.getTime() - OPS_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const hashprice = await fetchHashprice();

  let rows: Array<{
    deployedHashrate: { toNumber(): number };
    uptimePct: { toNumber(): number };
    miningMarginScore: number;
  }>;
  let attestationsCount: number;

  try {
    [rows, attestationsCount] = await Promise.all([
      prisma.miningMetric.findMany({
        where: { takenAt: { gte: periodStart, lte: periodEnd } },
        orderBy: { takenAt: "desc" },
        select: {
          deployedHashrate: true,
          uptimePct: true,
          miningMarginScore: true,
        },
      }),
      prisma.proof.count({
        where: {
          proofType: "mining_attestation",
          postedAt: { gte: periodStart, lte: periodEnd },
        },
      }),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[mining] loadMiningOpsSnapshot DB unavailable:", message);
    return miningOpsTransportFallback(hashprice);
  }

  const liveMarginScore = liveMarginFromHashprice(hashprice);

  if (rows.length === 0) {
    return miningOpsTransportFallback(hashprice);
  }

  // Decimal → number at the read boundary before any arithmetic.
  const avgDeployedTh =
    rows.reduce((sum, r) => sum + r.deployedHashrate.toNumber(), 0) / rows.length;
  const avgUptime =
    rows.reduce((sum, r) => sum + r.uptimePct.toNumber(), 0) / rows.length;
  const latest = rows[0];
  // rows[0] is non-undefined here because rows.length > 0 (noUncheckedIndexedAccess).
  const dbMarginScore = latest ? latest.miningMarginScore : OPS_FALLBACK.margin_score;

  return {
    hashrate_ph_s: round1(avgDeployedTh / TH_PER_PH),
    uptime_pct: round1(avgUptime),
    // Prefer the engine-recomputed score from live hashprice; otherwise
    // fall back to the last DB value.
    margin_score: liveMarginScore ?? dbMarginScore,
    attestations_count: attestationsCount,
    hashprice,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
