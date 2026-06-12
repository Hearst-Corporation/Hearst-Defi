import "server-only";

import { CircuitBreaker } from "@/lib/circuit-breaker";
import { STALE_THRESHOLDS } from "@/lib/data/freshness";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Crypto Fear & Greed Index loader.
 *
 * Source: https://api.alternative.me/fng/?limit=1 (public, no auth).
 *
 * The index is recomputed roughly once a day, so a 1-hour cache is far
 * more than enough — the only reason we don't cache for longer is so a
 * cold restart picks up fresh data quickly.
 *
 * Pattern mirrors `btc-price.ts` + `hashprice.ts`:
 *   - never throws
 *   - exposes `source: "live" | "fallback"` and `stale` for the
 *     provenance badge (CLAUDE.md non-negotiable #2)
 *   - circuit breaker so a flapping upstream does not stampede callers
 */

export type FearGreedClassification =
  | "extreme-fear"
  | "fear"
  | "neutral"
  | "greed"
  | "extreme-greed";

export interface FearGreedSnapshot {
  /** Index value in the [0, 100] range. */
  value: number;
  /** Bucket label derived from `value`, mirrored from the upstream response. */
  classification: FearGreedClassification;
  /** When this snapshot was produced. */
  fetchedAt: Date;
  /** "live" if the API answered, "fallback" if we served the static default. */
  source: "live" | "fallback";
  /** True if fallback OR snapshot age > 1h. */
  stale: boolean;
}

/** Wire shape returned by alternative.me. */
interface FearGreedItemRaw {
  value: string; // they encode as string, e.g. "57"
  value_classification: string; // "Extreme Fear" | "Fear" | "Neutral" | "Greed" | "Extreme Greed"
  timestamp: string;
  time_until_update?: string;
}

interface FearGreedResponse {
  name?: string;
  data?: FearGreedItemRaw[];
  metadata?: { error: string | null };
}

const FNG_PATH = "/fng/?limit=1";

function resolveBaseUrl(): string {
  return env.FEAR_GREED_BASE_URL;
}

// Cache TTL aligned with the freshness SLO published in
// `lib/data/freshness` (`STALE_THRESHOLDS.fear_greed`). The index recomputes
// roughly daily upstream — caching for one hour is the right balance.
const CACHE_TTL_MS = STALE_THRESHOLDS.fear_greed;
const FETCH_TIMEOUT_MS = 8_000;

const breaker = new CircuitBreaker({
  name: "fear-greed",
  failureThreshold: 3,
  cooldownMs: 5 * 60 * 1000,
});

const cache = new Map<string, { data: FearGreedSnapshot; expiresAt: number }>();
const CACHE_KEY = "fear-greed:latest";

/**
 * Static fallback when the upstream is down. `50 / neutral` is the
 * deliberately uninformative midpoint — never let a stale read tilt
 * downstream sentiment-aware logic in either direction.
 */
function fallbackSnapshot(fetchedAt: Date): FearGreedSnapshot {
  return {
    value: 50,
    classification: "neutral",
    fetchedAt,
    source: "fallback",
    stale: true,
  };
}

function mapClassification(raw: string): FearGreedClassification | null {
  switch (raw.trim().toLowerCase()) {
    case "extreme fear":
      return "extreme-fear";
    case "fear":
      return "fear";
    case "neutral":
      return "neutral";
    case "greed":
      return "greed";
    case "extreme greed":
      return "extreme-greed";
    default:
      return null;
  }
}

function isItemRaw(v: unknown): v is FearGreedItemRaw {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.value === "string" &&
    typeof o.value_classification === "string" &&
    typeof o.timestamp === "string"
  );
}

/**
 * Returns the latest Fear & Greed index. Never throws.
 *
 * Cache: 1 hour in-memory.
 * Fallback: `{ value: 50, classification: "neutral", source: "fallback", stale: true }`.
 */
export async function fetchFearGreed(): Promise<FearGreedSnapshot> {
  const cached = cache.get(CACHE_KEY);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const fetchedAt = new Date();
  logger.info("[fear-greed] fetch start", { url: `${resolveBaseUrl()}${FNG_PATH}` });

  try {
    const snapshot = await breaker.run(async () => fetchOnce(fetchedAt));
    cache.set(CACHE_KEY, {
      data: snapshot,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    logger.info("[fear-greed] fetch success", {
      source: snapshot.source,
      value: snapshot.value,
      classification: snapshot.classification,
    });
    return snapshot;
  } catch (err) {
    logger.warn(
      "[fear-greed] fetch failed, returning fallback",
      { error: err instanceof Error ? err.message : String(err) },
      err,
    );
    const snapshot = fallbackSnapshot(fetchedAt);
    cache.set(CACHE_KEY, {
      data: snapshot,
      expiresAt: Date.now() + 60 * 1000, // 1 min, recover quickly
    });
    return snapshot;
  }
}

async function fetchOnce(fetchedAt: Date): Promise<FearGreedSnapshot> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const url = `${resolveBaseUrl()}${FNG_PATH}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`fear-greed: HTTP ${res.status}`);
    }

    const raw: unknown = await res.json();
    if (typeof raw !== "object" || raw === null) {
      throw new Error("fear-greed: response not an object");
    }

    const payload = raw as FearGreedResponse;
    if (!Array.isArray(payload.data) || payload.data.length === 0) {
      throw new Error("fear-greed: empty `data` array");
    }

    const first = payload.data[0];
    if (!isItemRaw(first)) {
      throw new Error("fear-greed: malformed item");
    }

    const value = Number.parseInt(first.value, 10);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error(`fear-greed: invalid value "${first.value}"`);
    }

    const classification = mapClassification(first.value_classification);
    if (classification === null) {
      throw new Error(
        `fear-greed: unknown classification "${first.value_classification}"`,
      );
    }

    return {
      value,
      classification,
      fetchedAt,
      source: "live",
      stale: false,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Test-only helper. Clears the in-memory cache so tests can simulate
 * fresh runs without restarting the module graph.
 */
export function __resetFearGreedCacheForTests(): void {
  cache.clear();
}
