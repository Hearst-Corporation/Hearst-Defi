import "server-only";

import { inngest } from "@/lib/inngest/client";
import { fetchBtcPrice } from "@/lib/data/btc-price";
import { fetchDefiLlama } from "@/lib/data/defillama";
import { fetchFearGreed } from "@/lib/data/fear-greed";
import { fetchHashprice } from "@/lib/data/hashprice";
import { getEnergyCostUsdPerKwh } from "@/lib/data/energy-cost";
import {
  computeMiningRevenue,
  computeOperationalConfidence,
} from "@/lib/engine/mining";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { isDuplicate, markComplete } from "@/lib/idempotency";

/**
 * Market Data Ingestion — hourly cron.
 *
 * Fetches live BTC price (CoinGecko) and hashprice (mempool.space)
 * and persists them to the `MiningMetric` table. This is the primary
 * feed that keeps the dashboard and mining health agent current.
 *
 * Cron: every hour at minute 0.
 */
const MARKET_DATA_HOURLY_ID = "market-data-hourly" as const;
const MARKET_DATA_HOURLY_CRON = "0 * * * *" as const;

/**
 * Seed values for the two fleet columns this job cannot measure.
 *
 * `MiningMetric.uptimePct` and `.deployedHashrate` are declared NOT NULL, so
 * the very first row of an empty database has to carry *something*. These are
 * that something — and their names say what they are: NOT a measurement.
 *
 * They are used ONLY when no previous row exists; every subsequent row carries
 * the previous value forward rather than re-minting a constant (a constant
 * re-written hourly looks like a live feed in a time series; a carried value
 * visibly flatlines, which is the truth here).
 *
 * Readers MUST tag anything derived from these `estimated`, never `attested` —
 * `src/lib/agents/loaders/mining.ts` does. When a real pool/uptime integration
 * lands, both columns should become nullable and these constants deleted.
 */
const FLEET_UPTIME_PCT_UNMEASURED = 98.5;
const FLEET_HASHRATE_TH_UNMEASURED = 182_000;

interface MarketDataHourlyStep {
  run<T>(name: string, fn: () => T | Promise<T>): Promise<T>;
  sendEvent(id: string, payload: { name: string; data: Record<string, unknown> }): Promise<unknown>;
}

async function marketDataHourlyHandler({
  step,
}: {
  step: MarketDataHourlyStep;
}): Promise<
  | { btcUsd: number; hashprice: number; miningMarginScore: number }
  | { skipped: true; reason: string }
> {
  const now = new Date();

  if (await isDuplicate(MARKET_DATA_HOURLY_ID, now)) {
    return { skipped: true, reason: "already_run_this_hour" };
  }

  const btc = await step.run("fetch-btc-price", () => fetchBtcPrice());
  const hp = await step.run("fetch-hashprice", () => fetchHashprice());

  // External market context — logged only, no DB persist in this chantier
  // (no `MarketSnapshot` table yet, out-of-scope per spec). Wired here so
  // the pipeline runs the loaders once an hour and we get observability
  // on freshness via the structured logger.
  const defi = await step.run("fetch-defillama", () => fetchDefiLlama());
  const fng = await step.run("fetch-fear-greed", () => fetchFearGreed());

  logger.info("[market-data-hourly] external context", {
    defiSource: defi.source,
    defiStale: defi.stale,
    apyTopPct: defi.apyTopPct,
    apyMedianPct: defi.apyMedianPct,
    fngSource: fng.source,
    fngStale: fng.stale,
    fngValue: fng.value,
    fngClassification: fng.classification,
  });

  if (btc.usd <= 0 || hp.usd_per_th_day <= 0) {
    logger.warn("[market-data-hourly] upstream data unavailable", {
      btcUsd: btc.usd,
      hashprice: hp.usd_per_th_day,
      btcStale: btc.stale,
      hashpriceStale: hp.stale,
    });
    // We still mark complete so we don't retry indefinitely on upstream outage.
    await markComplete(MARKET_DATA_HOURLY_ID, now);
    return { skipped: true, reason: "upstream_unavailable" };
  }

  const energyCost = getEnergyCostUsdPerKwh();

  const marginScore = await step.run("compute-margin-score", () => {
    const result = computeMiningRevenue({
      btc_price_change_pct: btc.usd_24h_change,
      hashprice_usd_th_day: hp.usd_per_th_day,
      energy_cost_kwh: energyCost.usdPerKwh,
      stable_apy_pct: 3.8,
      vol_index: 50,
    });
    return result.margin_score;
  });

  await step.run("persist-mining-metric", async () => {
    try {
      // Compute a simple hashprice trend from the previous row, and carry the
      // unmeasured fleet columns forward from it (see the write below).
      const previous = await prisma.miningMetric.findFirst({
        orderBy: { takenAt: "desc" },
        select: { hashprice: true, uptimePct: true, deployedHashrate: true },
      });

      const carried = {
        uptimePct: previous?.uptimePct?.toNumber() ?? null,
        deployedHashrate: previous?.deployedHashrate?.toNumber() ?? null,
      };

      // Decimal → number at the read boundary before arithmetic.
      const prevHashprice = previous?.hashprice?.toNumber() ?? null;
      const hashpriceTrendPct =
        prevHashprice && prevHashprice !== 0
          ? ((hp.usd_per_th_day - prevHashprice) / prevHashprice) * 100
          : 0;

      await prisma.miningMetric.create({
        data: {
          hashprice: hp.usd_per_th_day,
          difficulty: hp.difficulty,
          btcPrice: btc.usd,
          // Source: `getEnergyCostUsdPerKwh()` — env override or industry default.
          // Provenance is `Manual` (or `Attested` once the partner pipeline lands).
          energyCost: energyCost.usdPerKwh,
          // ── Fleet telemetry: carried over, NEVER re-invented ──────────────
          // These two columns are NOT measured: no pool integration and no
          // uptime feed exist (see src/lib/mining/pool-provider.ts). They used
          // to be written as literals (98.5 / 182_000) on EVERY row, which is
          // the one thing this codebase treats as the worst failure available:
          // a fabricated constant that acquires a timestamp by passing through
          // the database, becoming indistinguishable from a measurement.
          //
          // The schema declares both NOT NULL, so writing `null` would need a
          // migration and would break every reader (LLM context, investor PDF).
          // Until that migration lands, we carry the previous row's value
          // forward instead of minting a fresh-looking constant, and every
          // reader must keep tagging them `estimated` — never `attested`
          // (src/lib/agents/loaders/mining.ts:132-141 already does).
          uptimePct: carried.uptimePct ?? FLEET_UPTIME_PCT_UNMEASURED,
          deployedHashrate: carried.deployedHashrate ?? FLEET_HASHRATE_TH_UNMEASURED,
          miningMarginScore: marginScore,
          hashpriceTrendPct: Math.round(hashpriceTrendPct * 100) / 100,
          operationalConfidence: computeOperationalConfidence(marginScore, btc.usd_24h_change),
        },
      });

      logger.info("[market-data-hourly] persisted", {
        btcUsd: btc.usd,
        hashprice: hp.usd_per_th_day,
        marginScore,
      });
    } catch (err) {
      logger.error("[market-data-hourly] persist failed", {}, err instanceof Error ? err : new Error(String(err)));
      throw err; // Let Inngest retry
    }
  });

  await step.sendEvent("emit-market-data-updated", {
    name: "market.data.updated",
    data: {
      btcUsd: btc.usd,
      hashprice: hp.usd_per_th_day,
      miningMarginScore: marginScore,
    },
  });

  await markComplete(MARKET_DATA_HOURLY_ID, now);

  return { btcUsd: btc.usd, hashprice: hp.usd_per_th_day, miningMarginScore: marginScore };
}

export const marketDataHourly = inngest.createFunction(
  {
    id: MARKET_DATA_HOURLY_ID,
    concurrency: { limit: 1 },
    triggers: [{ cron: MARKET_DATA_HOURLY_CRON }],
  },
  marketDataHourlyHandler,
);
