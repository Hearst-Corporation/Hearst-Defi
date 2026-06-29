import "server-only";

import { CircuitBreaker } from "@/lib/circuit-breaker";
import { logger } from "@/lib/logger";

/**
 * Lending yields loader — Morpho / Compound v3 / Aave v3 supply APY.
 *
 * Source: https://yields.llama.fi/pools (DefiLlama, public, no auth, free).
 *
 * DefiLlama is the single zero-key integration that covers all three
 * protocols with one schema (Aave's & Compound's own subgraphs now require a
 * paid Graph API key — the Hosted Service was sunset). We pull the full feed
 * once, group by protocol, and surface per-protocol best/median supply APY
 * with the base/reward split so a yield-comparison surface can show where the
 * yield actually comes from (organic interest vs token incentives).
 *
 * This is DISTINCT from `defillama.ts`, which surfaces a flat top-5 USDC pool
 * list for the scenario engine. This loader is protocol-centric (Morpho /
 * Compound / Aave) and keeps the base/reward decomposition.
 *
 * Canonical project slugs (verified live 2026-06):
 *   - "aave-v3"
 *   - "compound-v3"
 *   - "morpho-blue"   (NOTE: "morpho-aave" is dead — Optimizers deprecated)
 *
 * Mirrors `defillama.ts`:
 *   - never throws — always returns a snapshot
 *   - exposes `source: "live" | "fallback"` and `stale: boolean` for the badge
 *   - guarded by a circuit breaker.
 */

export type LendingProtocol = "morpho" | "compound" | "aave";

/** DefiLlama project slug → our protocol id. */
const SLUG_TO_PROTOCOL: Readonly<Record<string, LendingProtocol>> = {
  "aave-v3": "aave",
  "compound-v3": "compound",
  "morpho-blue": "morpho",
};

const PROTOCOL_LABEL: Readonly<Record<LendingProtocol, string>> = {
  morpho: "Morpho Blue",
  compound: "Compound v3",
  aave: "Aave v3",
};

export interface LendingPool {
  /** DeFiLlama pool id (uuid-ish, stable — usable for /chart/{pool} history). */
  pool: string;
  protocol: LendingProtocol;
  /** Human chain name as returned by DeFiLlama (e.g. "Ethereum", "Base"). */
  chain: string;
  /** Asset symbol — we filter to USDC. */
  symbol: string;
  /** Total net supply APY in percent (base + reward). */
  apyPct: number;
  /** Organic supply APY (interest only). May equal apyPct when no rewards. */
  apyBasePct: number;
  /** Incentive / token-reward APY in percent. 0 when none. */
  apyRewardPct: number;
  /** Supply-side TVL in USD. */
  tvlUsd: number;
}

export interface LendingProtocolSummary {
  protocol: LendingProtocol;
  label: string;
  /** Best (highest-APY) qualifying USDC pool for this protocol. */
  topPool: LendingPool;
  /** Median supply APY across this protocol's qualifying pools. */
  apyMedianPct: number;
  /** Sum of TVL across this protocol's qualifying pools. */
  tvlUsd: number;
  /** How many qualifying pools fed this summary. */
  poolCount: number;
}

export interface LendingYieldsSnapshot {
  /** One summary per protocol that had ≥1 qualifying pool, sorted by APY desc. */
  protocols: LendingProtocolSummary[];
  /** Every qualifying pool, flattened, sorted by APY desc. */
  pools: LendingPool[];
  fetchedAt: Date;
  source: "live" | "fallback";
  stale: boolean;
}

interface PoolRaw {
  pool: string;
  project: string;
  chain: string;
  symbol: string;
  apy: number | null;
  apyBase: number | null;
  apyReward: number | null;
  tvlUsd: number | null;
  underlyingTokens?: string[] | null;
}

interface PoolsResponse {
  status?: string;
  data?: PoolRaw[];
}

const DEFAULT_BASE_URL = "https://yields.llama.fi";
const POOLS_PATH = "/pools";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min — APY moves by basis points/day
const FETCH_TIMEOUT_MS = 8_000;

const ALLOWED_CHAINS: ReadonlySet<string> = new Set([
  "ethereum",
  "base",
  "arbitrum",
  "optimism",
]);
const MIN_TVL_USD = 10_000_000;
const STABLE_SYMBOL = "USDC";
const MAX_POOLS = 30;

/**
 * USDC contract addresses by chain (lowercase).
 * Used to match Morpho Blue vaults that expose a non-USDC symbol but have USDC
 * as their sole underlying token (e.g. STEAKUSDC, GTUSDCP on Base).
 */
const USDC_ADDRESSES: ReadonlySet<string> = new Set([
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // Ethereum USDC
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // Base USDC
  "0xaf88d065e77c8cc2239327c5edb3a432268e5831", // Arbitrum USDC
  "0x0b2c639c533813f4aa9d7837caf62653d097ff85", // Optimism USDC
]);

function isUsdcPool(item: PoolRaw): boolean {
  if (item.symbol.toUpperCase() === STABLE_SYMBOL) return true;
  // For Morpho vaults with wrapped/curated symbols, match by underlying token address.
  if (Array.isArray(item.underlyingTokens) && item.underlyingTokens.length === 1) {
    const addr = item.underlyingTokens[0]?.toLowerCase();
    if (addr && USDC_ADDRESSES.has(addr)) return true;
  }
  return false;
}

/**
 * Conservative fallback (DefiLlama unreachable). 4.5% reflects the typical
 * USDC supply APY across Aave/Compound 2024-2026 — conservative enough that a
 * scenario consumer never paints a misleadingly rosy picture from a fallback.
 */
const FALLBACK_APY_PCT = 4.5;

function resolveBaseUrl(): string {
  const fromEnv = process.env.DEFILLAMA_YIELDS_BASE_URL ?? process.env.DEFILLAMA_BASE_URL;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return DEFAULT_BASE_URL;
}

const breaker = new CircuitBreaker({
  name: "lending-yields",
  failureThreshold: 3,
  cooldownMs: 5 * 60 * 1000,
});

const cache = new Map<string, { data: LendingYieldsSnapshot; expiresAt: number }>();
const CACHE_KEY = "lending-yields:usdc";

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
  return sorted[mid] ?? 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isPoolRaw(v: unknown): v is PoolRaw {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.pool === "string" &&
    typeof o.project === "string" &&
    typeof o.chain === "string" &&
    typeof o.symbol === "string" &&
    (typeof o.apy === "number" || o.apy === null) &&
    (typeof o.apyBase === "number" || o.apyBase === null || o.apyBase === undefined) &&
    (typeof o.apyReward === "number" || o.apyReward === null || o.apyReward === undefined) &&
    (typeof o.tvlUsd === "number" || o.tvlUsd === null)
  );
}

function fallbackSnapshot(fetchedAt: Date): LendingYieldsSnapshot {
  const pool: LendingPool = {
    pool: "fallback-aave-v3-ethereum-usdc",
    protocol: "aave",
    chain: "Ethereum",
    symbol: STABLE_SYMBOL,
    apyPct: FALLBACK_APY_PCT,
    apyBasePct: FALLBACK_APY_PCT,
    apyRewardPct: 0,
    tvlUsd: 1_000_000_000,
  };
  return {
    protocols: [
      {
        protocol: "aave",
        label: PROTOCOL_LABEL.aave,
        topPool: pool,
        apyMedianPct: FALLBACK_APY_PCT,
        tvlUsd: pool.tvlUsd,
        poolCount: 1,
      },
    ],
    pools: [pool],
    fetchedAt,
    source: "fallback",
    stale: true,
  };
}

/** Returns the latest lending-yields snapshot. Never throws. Cached 10 min. */
export async function fetchLendingYields(): Promise<LendingYieldsSnapshot> {
  const cached = cache.get(CACHE_KEY);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const fetchedAt = new Date();
  try {
    const snapshot = await breaker.run(async () => fetchOnce(fetchedAt));
    cache.set(CACHE_KEY, { data: snapshot, expiresAt: Date.now() + CACHE_TTL_MS });
    logger.info("[lending-yields] fetch success", {
      source: snapshot.source,
      protocols: snapshot.protocols.length,
      pools: snapshot.pools.length,
    });
    return snapshot;
  } catch (err) {
    logger.warn(
      "[lending-yields] fetch failed, returning fallback",
      { error: err instanceof Error ? err.message : String(err) },
      err,
    );
    const snapshot = fallbackSnapshot(fetchedAt);
    cache.set(CACHE_KEY, { data: snapshot, expiresAt: Date.now() + 60 * 1000 });
    return snapshot;
  }
}

async function fetchOnce(fetchedAt: Date): Promise<LendingYieldsSnapshot> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const url = `${resolveBaseUrl()}${POOLS_PATH}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`lending-yields: HTTP ${res.status}`);

    const raw: unknown = await res.json();
    if (typeof raw !== "object" || raw === null || !("data" in raw)) {
      throw new Error("lending-yields: response missing `data`");
    }
    const payload = raw as PoolsResponse;
    if (!Array.isArray(payload.data)) {
      throw new Error("lending-yields: `data` is not an array");
    }

    const pools: LendingPool[] = [];
    for (const item of payload.data) {
      if (!isPoolRaw(item)) continue;
      const protocol = SLUG_TO_PROTOCOL[item.project];
      if (!protocol) continue;
      if (!isUsdcPool(item)) continue;
      if (!ALLOWED_CHAINS.has(item.chain.toLowerCase())) continue;
      const tvl = item.tvlUsd ?? 0;
      const apy = item.apy ?? 0;
      if (tvl < MIN_TVL_USD) continue;
      if (!Number.isFinite(apy) || apy <= 0) continue;

      const apyBase = item.apyBase ?? apy;
      const apyReward = item.apyReward ?? 0;
      pools.push({
        pool: item.pool,
        protocol,
        chain: item.chain,
        symbol: STABLE_SYMBOL,
        apyPct: round2(apy),
        apyBasePct: round2(Number.isFinite(apyBase) ? apyBase : apy),
        apyRewardPct: round2(Number.isFinite(apyReward) ? Math.max(0, apyReward) : 0),
        tvlUsd: tvl,
      });
    }

    if (pools.length === 0) {
      throw new Error("lending-yields: no qualifying USDC pools matched filters");
    }

    pools.sort((a, b) => b.apyPct - a.apyPct);
    const trimmed = pools.slice(0, MAX_POOLS);

    // Group by protocol → per-protocol summary.
    const byProtocol = new Map<LendingProtocol, LendingPool[]>();
    for (const p of trimmed) {
      const list = byProtocol.get(p.protocol) ?? [];
      list.push(p);
      byProtocol.set(p.protocol, list);
    }

    const protocols: LendingProtocolSummary[] = [];
    for (const [protocol, list] of byProtocol) {
      // list is already APY-desc (inherited from `trimmed`), so [0] is the top.
      const topPool = list[0];
      if (!topPool) continue;
      protocols.push({
        protocol,
        label: PROTOCOL_LABEL[protocol],
        topPool,
        apyMedianPct: round2(median(list.map((p) => p.apyPct))),
        tvlUsd: list.reduce((sum, p) => sum + p.tvlUsd, 0),
        poolCount: list.length,
      });
    }
    protocols.sort((a, b) => b.topPool.apyPct - a.topPool.apyPct);

    return { protocols, pools: trimmed, fetchedAt, source: "live", stale: false };
  } finally {
    clearTimeout(timeout);
  }
}

/** Test-only helper. Clears the in-memory cache + breaker so tests start fresh. */
export function __resetLendingYieldsCacheForTests(): void {
  cache.clear();
  breaker.reset();
}
