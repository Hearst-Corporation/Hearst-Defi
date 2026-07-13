import "server-only";

import { fetchBtcPrice } from "@/lib/data/btc-price";
import { evaluateFreshness, STALE_THRESHOLDS } from "@/lib/data/freshness";
import {
  BLOCK_REWARD_BTC,
  deriveHashpriceUsdPerThDay,
} from "@/lib/engine/hashprice-formula";

/**
 * Live hashprice ($/TH/day) derived from public, free data sources.
 *
 * The "hashprice" is the expected daily USD revenue per terahash of
 * deployed hashrate. It is a critical input to the mining margin score
 * and, by extension, to the vault APY range.
 *
 * We compute it ourselves from three public inputs so we don't depend on
 * a paid B2B feed (Luxor / Hashrate Index):
 *   - block reward         : constant, 3.125 BTC post April-2024 halving
 *   - blocks per day       : constant, 144 (10-min target)
 *   - BTC price (USD)      : Coingecko (via `fetchBtcPrice`)
 *   - network difficulty   : mempool.space (free, no auth)
 *
 * Formula (standard agg approximation, accurate to ~1% vs paid feeds):
 *
 *   network_hashrate_ths = difficulty * 2^32 / 600 / 1e12   // TH/s
 *   hashprice_usd_per_th_day
 *     = (block_reward * 144 * btc_price_usd) / network_hashrate_ths
 *
 * The `/ 600` factor converts difficulty (expected hashes per block,
 * divided by 2^32) into hashes per second on the network — a 10-minute
 * block target means the network must compute `difficulty * 2^32` hashes
 * every 600 seconds.
 *
 * Fees (the marginal lift above subsidy) are intentionally omitted: at
 * MVP they add <2% and we prefer a slightly conservative number.
 */
export interface HashpriceData {
  /** Hashprice in USD per TH per day. */
  usd_per_th_day: number;
  /** Current Bitcoin network difficulty (dimensionless). */
  difficulty: number;
  /** BTC price (USD) used in the calculation. */
  btc_price_usd: number;
  /** Block reward in BTC. 3.125 since the April 2024 halving. */
  block_reward_btc: number;
  /** When this snapshot was computed. */
  fetched_at: Date;
  /** True if the fallback was used or the data is > 10 minutes old. */
  stale: boolean;
}

const MEMPOOL_DIFFICULTY_URL =
  "https://mempool.space/api/v1/mining/difficulty-adjustments/1m";

// Freshness SLO comes from the central registry (`lib/data/freshness`).
// Local alias kept for clarity at call sites.
const STALE_THRESHOLD_MS = STALE_THRESHOLDS.hashprice;

/**
 * Conservative fallback when mempool.space is down. Tracks the typical
 * mid-2024/2026 hashprice band. Returned as `stale: true` so the UI can
 * surface a degraded badge instead of silently swapping.
 */
const FALLBACK_USD_PER_TH_DAY = 0.055;
const FALLBACK_DIFFICULTY = 1.32e14;
const FALLBACK_BTC_PRICE_USD = 100_000;

/**
 * Latest tuple from `/api/v1/mining/difficulty-adjustments/1m` is
 * `[timestamp, height, difficulty, change_ratio]`. We only need [2].
 */
type DifficultyAdjustmentTuple = [number, number, number, number];

function isDifficultyTuple(v: unknown): v is DifficultyAdjustmentTuple {
  return (
    Array.isArray(v) &&
    v.length >= 3 &&
    typeof v[0] === "number" &&
    typeof v[1] === "number" &&
    typeof v[2] === "number"
  );
}

function fallback(fetched_at: Date): HashpriceData {
  return {
    usd_per_th_day: FALLBACK_USD_PER_TH_DAY,
    difficulty: FALLBACK_DIFFICULTY,
    btc_price_usd: FALLBACK_BTC_PRICE_USD,
    block_reward_btc: BLOCK_REWARD_BTC,
    fetched_at,
    stale: true,
  };
}

/**
 * Returns the live hashprice. Never throws — on any upstream failure
 * (network, JSON shape mismatch, BTC price unavailable) we surface a
 * conservative fallback with `stale: true` so the dashboard keeps
 * rendering and downstream engine inputs stay numeric.
 */
export async function fetchHashprice(): Promise<HashpriceData> {
  const fetched_at = new Date();

  try {
    const [diffRes, btc] = await Promise.all([
      fetch(MEMPOOL_DIFFICULTY_URL, {
        // Difficulty only adjusts every ~2016 blocks (~2 weeks); 10-min cache
        // is plenty and shields us from mempool.space rate limits.
        next: { revalidate: 600 },
      }),
      fetchBtcPrice(),
    ]);

    if (!diffRes.ok) {
      return fallback(fetched_at);
    }

    const raw: unknown = await diffRes.json();
    if (!Array.isArray(raw) || raw.length === 0) {
      return fallback(fetched_at);
    }

    const latest = raw[0];
    if (!isDifficultyTuple(latest)) {
      return fallback(fetched_at);
    }

    const difficulty = latest[2];
    if (!Number.isFinite(difficulty) || difficulty <= 0) {
      return fallback(fetched_at);
    }

    // BTC price must be present and positive. `fetchBtcPrice` already
    // falls back to {usd: 0, stale: true} on its own outage — we don't
    // want to publish a $0 hashprice in that case.
    if (!Number.isFinite(btc.usd) || btc.usd <= 0) {
      return fallback(fetched_at);
    }

    const usd_per_th_day = deriveHashpriceUsdPerThDay(difficulty, btc.usd);

    if (!Number.isFinite(usd_per_th_day) || usd_per_th_day <= 0) {
      return fallback(fetched_at);
    }

    const stale =
      evaluateFreshness(fetched_at, STALE_THRESHOLD_MS) === "stale" || btc.stale;

    return {
      usd_per_th_day: round6(usd_per_th_day),
      difficulty,
      btc_price_usd: btc.usd,
      block_reward_btc: BLOCK_REWARD_BTC,
      fetched_at,
      stale,
    };
  } catch {
    // Silent fallback — never crash the dashboard.
    return fallback(fetched_at);
  }
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
