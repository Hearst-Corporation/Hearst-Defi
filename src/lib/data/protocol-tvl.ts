import "server-only";

import { CircuitBreaker } from "@/lib/circuit-breaker";
import { logger } from "@/lib/logger";

/**
 * Protocol TVL loader — Morpho / Compound / Aave total value locked.
 *
 * Source: https://api.llama.fi/tvl/{slug} (DefiLlama, public, no auth, free).
 *
 * Each `/tvl/{slug}` call returns a single bare USD number — the cheapest poll
 * DefiLlama offers. TVL moves slowly (DefiLlama itself recomputes on the order
 * of hours), so a 15-minute cache is plenty. We poll each protocol's slug
 * concurrently and roll them up.
 *
 * Canonical slugs (verified live 2026-06):
 *   - "aave-v3"
 *   - "compound-v3"      (umbrella "compound-finance" also resolves)
 *   - "morpho-blue"      (NOTE: bare "morpho" is a parent with NO chain data —
 *                         we use "morpho-blue", the real deployed protocol)
 *
 * Mirrors the data-layer convention:
 *   - never throws — always returns a snapshot
 *   - exposes `source: "live" | "fallback"` and per-protocol `stale`
 *   - guarded by a circuit breaker.
 */

export type TvlProtocol = "morpho" | "compound" | "aave";

const PROTOCOL_SLUG: Readonly<Record<TvlProtocol, string>> = {
  aave: "aave-v3",
  compound: "compound-v3",
  morpho: "morpho-blue",
};

const PROTOCOL_LABEL: Readonly<Record<TvlProtocol, string>> = {
  morpho: "Morpho Blue",
  compound: "Compound v3",
  aave: "Aave v3",
};

export interface ProtocolTvl {
  protocol: TvlProtocol;
  label: string;
  slug: string;
  /** Current TVL in USD. */
  tvlUsd: number;
  /** "live" when the DefiLlama call succeeded for this slug, else "stale". */
  provenance: "live" | "stale";
}

export interface ProtocolTvlSnapshot {
  protocols: ProtocolTvl[];
  /** Sum of TVL across protocols that returned a live number. */
  totalTvlUsd: number;
  fetchedAt: Date;
  /** "live" if ≥1 slug resolved, "fallback" if every call failed. */
  source: "live" | "fallback";
  /** True when no protocol returned a live number. */
  stale: boolean;
}

const DEFAULT_BASE_URL = "https://api.llama.fi";
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 min — TVL moves slowly
const FETCH_TIMEOUT_MS = 8_000;

function resolveBaseUrl(): string {
  const fromEnv = process.env.DEFILLAMA_TVL_BASE_URL ?? process.env.DEFILLAMA_BASE_URL;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return DEFAULT_BASE_URL;
}

const breaker = new CircuitBreaker({
  name: "protocol-tvl",
  failureThreshold: 3,
  cooldownMs: 5 * 60 * 1000,
});

const cache = new Map<string, { data: ProtocolTvlSnapshot; expiresAt: number }>();
const CACHE_KEY = "protocol-tvl:lending";

/** Fetch one protocol's current TVL. Returns null on any failure. */
async function fetchOneTvl(slug: string): Promise<number | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const url = `${resolveBaseUrl()}/tvl/${slug}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    // `/tvl/{slug}` returns a bare JSON number.
    const raw: unknown = await res.json();
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function fallbackSnapshot(fetchedAt: Date): ProtocolTvlSnapshot {
  return {
    protocols: (Object.keys(PROTOCOL_SLUG) as TvlProtocol[]).map((protocol) => ({
      protocol,
      label: PROTOCOL_LABEL[protocol],
      slug: PROTOCOL_SLUG[protocol],
      tvlUsd: 0,
      provenance: "stale" as const,
    })),
    totalTvlUsd: 0,
    fetchedAt,
    source: "fallback",
    stale: true,
  };
}

/** Returns the latest protocol-TVL snapshot. Never throws. Cached 15 min. */
export async function fetchProtocolTvl(): Promise<ProtocolTvlSnapshot> {
  const cached = cache.get(CACHE_KEY);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const fetchedAt = new Date();
  try {
    const snapshot = await breaker.run(async () => buildSnapshot(fetchedAt));
    cache.set(CACHE_KEY, { data: snapshot, expiresAt: Date.now() + CACHE_TTL_MS });
    logger.info("[protocol-tvl] fetch success", {
      source: snapshot.source,
      totalTvlUsd: snapshot.totalTvlUsd,
      live: snapshot.protocols.filter((p) => p.provenance === "live").length,
    });
    return snapshot;
  } catch (err) {
    logger.warn(
      "[protocol-tvl] fetch failed, returning fallback",
      { error: err instanceof Error ? err.message : String(err) },
      err,
    );
    const snapshot = fallbackSnapshot(fetchedAt);
    cache.set(CACHE_KEY, { data: snapshot, expiresAt: Date.now() + 60 * 1000 });
    return snapshot;
  }
}

async function buildSnapshot(fetchedAt: Date): Promise<ProtocolTvlSnapshot> {
  const order = Object.keys(PROTOCOL_SLUG) as TvlProtocol[];
  const results = await Promise.all(order.map((p) => fetchOneTvl(PROTOCOL_SLUG[p])));

  const protocols: ProtocolTvl[] = order.map((protocol, i) => {
    const tvl = results[i];
    const live = typeof tvl === "number";
    return {
      protocol,
      label: PROTOCOL_LABEL[protocol],
      slug: PROTOCOL_SLUG[protocol],
      tvlUsd: live ? Math.round(tvl) : 0,
      provenance: live ? "live" : "stale",
    };
  });

  const liveCount = protocols.filter((p) => p.provenance === "live").length;
  // Every slug failed → treat as a breaker failure so we serve the fallback
  // and the circuit can open on a sustained DefiLlama outage.
  if (liveCount === 0) {
    throw new Error("protocol-tvl: every slug failed");
  }

  const totalTvlUsd = protocols.reduce((sum, p) => sum + p.tvlUsd, 0);
  return { protocols, totalTvlUsd, fetchedAt, source: "live", stale: false };
}

/** Test-only helper. Clears the in-memory cache + breaker so tests start fresh. */
export function __resetProtocolTvlCacheForTests(): void {
  cache.clear();
  breaker.reset();
}
