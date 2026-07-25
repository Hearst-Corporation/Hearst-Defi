import "server-only";

import { CircuitBreaker } from "@/lib/circuit-breaker";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * DeFiLlama yields loader — top USDC pools on institutional-grade venues.
 *
 * Source: https://yields.llama.fi/pools (public API, no auth, free).
 *
 * We filter for stablecoin (USDC) pools on major EVM chains (Ethereum,
 * Base, Arbitrum, Optimism) with TVL > $10M to surface only venues a
 * Cayman SPV would realistically consider. The full feed is several MB
 * — caching 10 minutes is plenty for an APY surface that only moves on
 * the order of basis points per day.
 *
 * Pattern mirrors `btc-price.ts` + `hashprice.ts`:
 *   - never throws — always returns a snapshot
 *   - exposes `source: "live" | "fallback"` and `stale: boolean` for the
 *     provenance badge (CLAUDE.md non-negotiable #2)
 *   - guarded by a circuit breaker so a flapping upstream does not
 *     stampede the rest of the dashboard
 */

export interface DefiLlamaYield {
  /** DeFiLlama pool id (uuid-ish string). */
  pool: string;
  /** Slug of the protocol (e.g. "aave-v3", "compound-v3", "morpho-blue"). */
  project: string;
  /** Human chain name as returned by DeFiLlama (e.g. "Ethereum", "Base"). */
  chain: string;
  /** Pool symbol — we filter to USDC, but keep the field for transparency. */
  symbol: string;
  /** Annualised yield in percent (DeFiLlama returns this as a number). */
  apy: number;
  /** Total value locked in USD. */
  tvlUsd: number;
  /** Optional permalink back to DeFiLlama. */
  url?: string;
}

export interface DefiLlamaSnapshot {
  /** Top 5 USDC pools by APY, after TVL > $10M filter. */
  topYields: DefiLlamaYield[];
  /** Highest APY in the filtered set (scenario engine "best case"). */
  apyTopPct: number;
  /** Median APY across the top 5 — more robust scenario input than the top. */
  apyMedianPct: number;
  /** When this snapshot was produced. */
  fetchedAt: Date;
  /** "live" if API call succeeded, "fallback" otherwise. */
  source: "live" | "fallback";
  /** True when the snapshot is the fallback OR older than the cache TTL. */
  stale: boolean;
}

/** Shape DeFiLlama returns. We narrow at the runtime boundary, never trust the wire. */
interface DefiLlamaPoolRaw {
  pool: string;
  project: string;
  chain: string;
  symbol: string;
  apy: number | null;
  tvlUsd: number | null;
  // The API also returns `apyBase`, `apyReward`, `stablecoin`, `ilRisk`, etc.
  // We deliberately ignore them at this layer; downstream engine consumers
  // see only the narrowed shape above.
}

interface DefiLlamaPoolsResponse {
  status?: string;
  data?: DefiLlamaPoolRaw[];
}

const DEFAULT_BASE_URL = "https://yields.llama.fi";
const POOLS_PATH = "/pools";

/**
 * Allow override via `DEFILLAMA_BASE_URL` — declared in the Zod canon
 * (src/lib/env.ts) since the raw-env purge 2026-07-26; same fallback as before.
 */
function resolveBaseUrl(): string {
  const fromEnv = env.DEFILLAMA_BASE_URL;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return DEFAULT_BASE_URL;
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const FETCH_TIMEOUT_MS = 8_000;

/** Allowed chains (lowercased on compare). */
const ALLOWED_CHAINS: ReadonlySet<string> = new Set([
  "ethereum",
  "base",
  "arbitrum",
  "optimism",
]);

const MIN_TVL_USD = 10_000_000;
const TOP_N = 5;
const STABLE_SYMBOL = "USDC";

/**
 * Conservative fallback when DeFiLlama is unreachable or returns garbage.
 * 4.5% reflects the typical USDC supply APY on Aave v3 / Compound v3 across
 * 2024-2026; conservative enough that a downstream scenario engine using
 * this number as an "APY floor" never paints a misleadingly rosy picture.
 */
const FALLBACK_APY_PCT = 4.5;

const FALLBACK_TOP_YIELDS: ReadonlyArray<DefiLlamaYield> = [
  {
    pool: "fallback-aave-v3-ethereum-usdc",
    project: "aave-v3",
    chain: "Ethereum",
    symbol: STABLE_SYMBOL,
    apy: FALLBACK_APY_PCT,
    tvlUsd: 1_000_000_000,
  },
];

const cache = new Map<string, { data: DefiLlamaSnapshot; expiresAt: number }>();
const CACHE_KEY = "defillama:usdc:top";

const breaker = new CircuitBreaker({
  name: "defillama",
  failureThreshold: 3,
  cooldownMs: 5 * 60 * 1000, // 5 min — match the public API's general latency
});

function fallbackSnapshot(fetchedAt: Date): DefiLlamaSnapshot {
  return {
    topYields: [...FALLBACK_TOP_YIELDS],
    apyTopPct: FALLBACK_APY_PCT,
    apyMedianPct: FALLBACK_APY_PCT,
    fetchedAt,
    source: "fallback",
    stale: true,
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    const lo = sorted[mid - 1];
    const hi = sorted[mid];
    if (lo === undefined || hi === undefined) return 0;
    return (lo + hi) / 2;
  }
  const m = sorted[mid];
  return m ?? 0;
}

function isPoolRaw(v: unknown): v is DefiLlamaPoolRaw {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.pool === "string" &&
    typeof o.project === "string" &&
    typeof o.chain === "string" &&
    typeof o.symbol === "string" &&
    (typeof o.apy === "number" || o.apy === null) &&
    (typeof o.tvlUsd === "number" || o.tvlUsd === null)
  );
}

/**
 * Returns the latest DeFiLlama USDC yield snapshot. Never throws.
 *
 * Cache: 10 minutes in-memory (shared across the module).
 * Fallback: static conservative 4.5% APY entry, `source: "fallback"`, `stale: true`.
 */
export async function fetchDefiLlama(): Promise<DefiLlamaSnapshot> {
  // Cache hit — return immediately without touching the network.
  const cached = cache.get(CACHE_KEY);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const fetchedAt = new Date();
  logger.info("[defillama] fetch start", { url: `${resolveBaseUrl()}${POOLS_PATH}` });

  try {
    const snapshot = await breaker.run(async () => fetchOnce(fetchedAt));
    cache.set(CACHE_KEY, {
      data: snapshot,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    logger.info("[defillama] fetch success", {
      source: snapshot.source,
      apyTopPct: snapshot.apyTopPct,
      apyMedianPct: snapshot.apyMedianPct,
      poolCount: snapshot.topYields.length,
    });
    return snapshot;
  } catch (err) {
    logger.warn(
      "[defillama] fetch failed, returning fallback",
      { error: err instanceof Error ? err.message : String(err) },
      err,
    );
    const snapshot = fallbackSnapshot(fetchedAt);
    // Cache the fallback for a shorter window so we recover quickly.
    cache.set(CACHE_KEY, {
      data: snapshot,
      expiresAt: Date.now() + 60 * 1000, // 1 min
    });
    return snapshot;
  }
}

/**
 * One network round-trip. Throws on any non-2xx / timeout / shape mismatch
 * so the circuit breaker can count it as a failure.
 */
async function fetchOnce(fetchedAt: Date): Promise<DefiLlamaSnapshot> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const url = `${resolveBaseUrl()}${POOLS_PATH}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`defillama: HTTP ${res.status}`);
    }

    const raw: unknown = await res.json();
    if (
      typeof raw !== "object" ||
      raw === null ||
      !("data" in raw)
    ) {
      throw new Error("defillama: response missing `data`");
    }

    const payload = raw as DefiLlamaPoolsResponse;
    if (!Array.isArray(payload.data)) {
      throw new Error("defillama: `data` is not an array");
    }

    const filtered: DefiLlamaYield[] = [];
    for (const item of payload.data) {
      if (!isPoolRaw(item)) continue;
      if (item.symbol.toUpperCase() !== STABLE_SYMBOL) continue;
      if (!ALLOWED_CHAINS.has(item.chain.toLowerCase())) continue;
      const tvl = item.tvlUsd ?? 0;
      const apy = item.apy ?? 0;
      if (tvl < MIN_TVL_USD) continue;
      if (!Number.isFinite(apy) || apy <= 0) continue;
      filtered.push({
        pool: item.pool,
        project: item.project,
        chain: item.chain,
        symbol: item.symbol.toUpperCase(),
        apy,
        tvlUsd: tvl,
      });
    }

    if (filtered.length === 0) {
      throw new Error("defillama: no USDC pools matched filters");
    }

    filtered.sort((a, b) => b.apy - a.apy);
    const top = filtered.slice(0, TOP_N);
    const apys = top.map((y) => y.apy);
    const apyTopPct = apys[0] ?? 0;
    const apyMedianPct = median(apys);

    return {
      topYields: top,
      apyTopPct: round2(apyTopPct),
      apyMedianPct: round2(apyMedianPct),
      fetchedAt,
      source: "live",
      stale: false,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Test-only helper. Clears the in-memory cache so tests can simulate
 * fresh runs without restarting the module graph.
 */
export function __resetDefiLlamaCacheForTests(): void {
  cache.clear();
}
