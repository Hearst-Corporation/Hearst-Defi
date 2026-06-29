import "server-only";

import { CircuitBreaker } from "@/lib/circuit-breaker";
import { evaluateFreshness, STALE_THRESHOLDS } from "@/lib/data/freshness";
import { logger } from "@/lib/logger";

/**
 * Binance spot price loader — server-side, REST.
 *
 * Source: https://api.binance.com/api/v3/ticker/24hr (public, no auth, free).
 * Default host is the canonical Binance prod API (`api.binance.com`); override
 * via BINANCE_API_BASE_URL (e.g. the `data-api.binance.vision` market-data
 * mirror) when you want read-only polling off the trading-API host.
 *
 * WHY REST AND NOT WEBSOCKET:
 *   Binance's real-time price feed is a WebSocket
 *   (`wss://stream.binance.com:9443/stream?streams=btcusdt@ticker/...`) — a
 *   single long-lived TCP connection that must answer pings every ~20s and is
 *   force-closed every 24h (auto-reconnect required). That is fundamentally
 *   incompatible with Vercel/serverless SSR: request-scoped functions freeze
 *   after the response, so there is no persistent process to hold the socket
 *   or run the reconnect loop. So:
 *     - SERVER-SIDE (this module): poll the REST `/ticker/24hr` endpoint, which
 *       returns the SAME data as the `@ticker` stream (`lastPrice` = stream
 *       `c`, `priceChangePercent` = stream `P`), cached behind a short TTL.
 *     - LIVE TICKER WIDGET (cosmetic, optional): open the WebSocket directly
 *       from a `"use client"` component in a `useEffect` (the browser holds the
 *       socket) — NOT from the server. Reference stream format:
 *         wss://stream.binance.com:9443/stream?streams=btcusdt@ticker
 *     - REAL-TIME SERVER-SIDE AT SCALE: run a standalone Node worker that holds
 *       the WS and pushes ticks into Upstash Redis; the app reads the cached
 *       price. Out of scope for this loader.
 *
 * Mirrors `btc-price.ts`:
 *   - never throws — always returns a snapshot
 *   - exposes `source: "live" | "fallback"` and `stale` for the provenance badge
 *     (Binance is a CEX ticker, so a live print is `provenance: "live"`, never
 *     `"oracle"` — we don't dress a centralized feed as a decentralized one)
 *   - guarded by a circuit breaker.
 */

export interface BinanceTicker {
  /** Binance trading-pair symbol, e.g. "BTCUSDT". */
  symbol: string;
  /** Last traded price (quote currency — USDT here). */
  lastPrice: number;
  /** 24h price change in percent (e.g. -1.23 = down 1.23%). */
  priceChangePct: number;
  /** "live" when this print came from the API, "stale" on fallback/timeout. */
  provenance: "live" | "stale";
}

export interface BinancePriceSnapshot {
  tickers: BinanceTicker[];
  fetchedAt: Date;
  source: "live" | "fallback";
  stale: boolean;
}

/** Default symbols surfaced. Override per call via `fetchBinancePrices(symbols)`. */
export const DEFAULT_BINANCE_SYMBOLS = ["BTCUSDT", "ETHUSDT"] as const;

const DEFAULT_BASE_URL = "https://api.binance.com";
const CACHE_TTL_MS = 15 * 1000; // 15s — spot price moves second-by-second
const FETCH_TIMEOUT_MS = 8_000;
const STALE_THRESHOLD_MS = STALE_THRESHOLDS.btc_price; // 5 min spot SLO

function resolveBaseUrl(): string {
  const fromEnv = process.env.BINANCE_API_BASE_URL;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return DEFAULT_BASE_URL;
}

const breaker = new CircuitBreaker({
  name: "binance-price",
  failureThreshold: 3,
  cooldownMs: 2 * 60 * 1000,
});

const cache = new Map<string, { data: BinancePriceSnapshot; expiresAt: number }>();

interface Ticker24hrRaw {
  symbol?: string;
  lastPrice?: string;
  priceChangePercent?: string;
}

function isTicker24hrRaw(v: unknown): v is Ticker24hrRaw {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.symbol === "string" && typeof o.lastPrice === "string";
}

function normalizeSymbols(symbols: readonly string[]): string[] {
  // Upper-case, dedupe, drop empties — Binance symbols are upper-case.
  const seen = new Set<string>();
  for (const s of symbols) {
    const up = s.trim().toUpperCase();
    if (up.length > 0) seen.add(up);
  }
  return [...seen];
}

function fallbackSnapshot(fetchedAt: Date, symbols: string[]): BinancePriceSnapshot {
  return {
    tickers: symbols.map((symbol) => ({
      symbol,
      lastPrice: 0,
      priceChangePct: 0,
      provenance: "stale" as const,
    })),
    fetchedAt,
    source: "fallback",
    stale: true,
  };
}

/**
 * Returns the latest Binance spot snapshot for `symbols`. Never throws.
 * Cached 15s per symbol-set. Defaults to BTCUSDT + ETHUSDT.
 */
export async function fetchBinancePrices(
  symbols: readonly string[] = DEFAULT_BINANCE_SYMBOLS,
): Promise<BinancePriceSnapshot> {
  const normalized = normalizeSymbols(symbols);
  if (normalized.length === 0) {
    return fallbackSnapshot(new Date(), []);
  }
  const cacheKey = `binance:${normalized.slice().sort().join(",")}`;

  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const fetchedAt = new Date();
  try {
    const snapshot = await breaker.run(async () => fetchOnce(fetchedAt, normalized));
    cache.set(cacheKey, { data: snapshot, expiresAt: Date.now() + CACHE_TTL_MS });
    logger.info("[binance-price] fetch success", {
      source: snapshot.source,
      symbols: snapshot.tickers.length,
    });
    return snapshot;
  } catch (err) {
    logger.warn(
      "[binance-price] fetch failed, returning fallback",
      { error: err instanceof Error ? err.message : String(err) },
      err,
    );
    const snapshot = fallbackSnapshot(fetchedAt, normalized);
    cache.set(cacheKey, { data: snapshot, expiresAt: Date.now() + 10 * 1000 });
    return snapshot;
  }
}

async function fetchOnce(fetchedAt: Date, symbols: string[]): Promise<BinancePriceSnapshot> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    // Batched query: ?symbols=["BTCUSDT","ETHUSDT"] (JSON array, URL-encoded).
    const symbolsParam = encodeURIComponent(JSON.stringify(symbols));
    const url = `${resolveBaseUrl()}/api/v3/ticker/24hr?symbols=${symbolsParam}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`binance-price: HTTP ${res.status}`);

    const raw: unknown = await res.json();
    // A multi-symbol query returns an array; a single symbol may return one
    // object — normalize both into an array before mapping.
    const list: unknown[] = Array.isArray(raw) ? raw : [raw];

    const bySymbol = new Map<string, BinanceTicker>();
    const stale = evaluateFreshness(fetchedAt, STALE_THRESHOLD_MS) === "stale";
    for (const item of list) {
      if (!isTicker24hrRaw(item)) continue;
      const sym = (item.symbol ?? "").toUpperCase();
      const lastPrice = Number(item.lastPrice);
      const priceChangePct = Number(item.priceChangePercent ?? "0");
      if (!Number.isFinite(lastPrice) || lastPrice <= 0) continue;
      bySymbol.set(sym, {
        symbol: sym,
        lastPrice,
        priceChangePct: Number.isFinite(priceChangePct) ? priceChangePct : 0,
        provenance: stale ? "stale" : "live",
      });
    }

    if (bySymbol.size === 0) {
      throw new Error("binance-price: no usable tickers in response");
    }

    // Preserve the requested order; fill any missing symbol with a stale row.
    const tickers: BinanceTicker[] = symbols.map(
      (sym) =>
        bySymbol.get(sym) ?? {
          symbol: sym,
          lastPrice: 0,
          priceChangePct: 0,
          provenance: "stale" as const,
        },
    );

    const allStale = tickers.every((t) => t.provenance === "stale");
    return {
      tickers,
      fetchedAt,
      source: allStale ? "fallback" : "live",
      stale: allStale,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** Test-only helper. Clears the in-memory cache + breaker so tests start fresh. */
export function __resetBinancePriceCacheForTests(): void {
  cache.clear();
  breaker.reset();
}
