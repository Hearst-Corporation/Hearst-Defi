import "server-only";

import { createPublicClient, http, type Address } from "viem";
import { mainnet } from "viem/chains";

import { CircuitBreaker } from "@/lib/circuit-breaker";
import { evaluateFreshness, STALE_THRESHOLDS } from "@/lib/data/freshness";
import { logger } from "@/lib/logger";

/**
 * Decentralized stablecoin price loader — USDC / USDT / DAI (+ long-tail).
 *
 * "Decentralized" here means oracle / DEX-aggregated, NOT a centralized
 * exchange ticker. Two free, no-key sources, picked per methodology #2
 * (every metric carries an honest provenance badge):
 *
 *   - Primary  : Chainlink USD aggregators (on-chain oracles, Ethereum
 *                mainnet). Read via a free RPC — the DATA is the oracle's, the
 *                RPC is just transport, so a successful read is `provenance:
 *                "oracle"`. Wired ONLY when `ETH_RPC_URL` is set (the
 *                aggregators live on mainnet, NOT the app's Base-Sepolia RPC).
 *                Addresses verified on Etherscan (2026-06):
 *                  USDC/USD 0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6
 *                  USDT/USD 0x3E7d1eAB13ad0104d2750B8863b489D65364e32D
 *                  DAI/USD  0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9
 *                All 8-decimal feeds. We read the proxy (stable across
 *                aggregator upgrades), check `updatedAt` for staleness.
 *   - Fallback : DefiLlama coins API (https://coins.llama.fi). Free, no key,
 *                aggregated oracle+DEX price with a `confidence` field. Covers
 *                the long-tail stables (crvUSD/GHO/USDe) that lack a clean
 *                first-party Chainlink feed. A DefiLlama price is aggregated,
 *                NOT "the oracle reading", so it earns `provenance: "live"`,
 *                never `"oracle"` — we don't mislabel an aggregator as an oracle.
 *   - Stale    : Chainlink round older than its heartbeat budget, OR DefiLlama
 *                `confidence` too low / nothing responded → `provenance: "stale"`.
 *
 * Mirrors `btc-price.ts` + `defillama.ts`:
 *   - never throws — always returns a snapshot
 *   - exposes `source` / `stale` / per-coin `provenance` for the badge
 *   - guarded by a circuit breaker so a flapping RPC / API does not stampede
 *     the rest of the dashboard.
 */

export type StablecoinProvenance = "oracle" | "live" | "stale";

/** Stablecoins we surface. Extend the registry below to add more. */
export type StablecoinSymbol = "USDC" | "USDT" | "DAI" | "crvUSD" | "GHO" | "USDe";

export interface StablecoinPrice {
  symbol: StablecoinSymbol;
  /** Price in USD (≈ 1.00 when on peg). */
  priceUsd: number;
  /** Absolute deviation from the $1.00 peg, in basis points (10000 = 100%). */
  pegDeviationBps: number;
  /** Where this single reading came from. */
  provenance: StablecoinProvenance;
  /** When the underlying source last updated this price. */
  updatedAt: Date;
}

export interface StablecoinPriceSnapshot {
  prices: StablecoinPrice[];
  /** When this snapshot was produced. */
  fetchedAt: Date;
  /**
   * Coarse source of the snapshot as a whole:
   *   - "oracle"   : at least one Chainlink reading succeeded
   *   - "live"     : served entirely from the DefiLlama aggregator
   *   - "fallback" : nothing responded — static $1.00 placeholders, all stale
   */
  source: "oracle" | "live" | "fallback";
  /** True when the snapshot is the fallback OR every reading is stale. */
  stale: boolean;
}

/** On-chain registry: token contract + (optional) Chainlink USD aggregator. */
interface StablecoinDef {
  symbol: StablecoinSymbol;
  /** ERC-20 token contract on Ethereum mainnet — DefiLlama coins key. */
  token: Address;
  /** DefiLlama coins key when the token has no `chain:address` form. */
  llamaKey?: string;
  /** Chainlink USD proxy aggregator on mainnet. Undefined ⇒ DefiLlama only. */
  chainlink?: Address;
}

const CHAINLINK_DECIMALS_FALLBACK = 8;

const STABLECOINS: ReadonlyArray<StablecoinDef> = [
  // NOTE: every 0x value below is a PUBLIC Ethereum mainnet contract address
  // (ERC-20 tokens + Chainlink aggregators), verifiable on Etherscan — NOT a
  // secret. The `gitleaks:allow` markers silence the generic-api-key heuristic
  // that mistakes high-entropy hex addresses for API keys.
  {
    symbol: "USDC",
    token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // gitleaks:allow
    chainlink: "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6", // gitleaks:allow
  },
  {
    symbol: "USDT",
    token: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // gitleaks:allow
    chainlink: "0x3E7d1eAB13ad0104d2750B8863b489D65364e32D", // gitleaks:allow
  },
  {
    symbol: "DAI",
    token: "0x6B175474E89094C44Da98b954EedeAC495271d0F", // gitleaks:allow
    chainlink: "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9", // gitleaks:allow
  },
  // Long-tail: no canonical first-party Chainlink USD feed → DefiLlama only.
  {
    symbol: "crvUSD",
    token: "0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E", // gitleaks:allow
  },
  { symbol: "GHO", token: "0x0000000000000000000000000000000000000000", llamaKey: "coingecko:gho" },
  {
    symbol: "USDe",
    token: "0x0000000000000000000000000000000000000000",
    llamaKey: "coingecko:ethena-usde",
  },
];

const AGGREGATOR_V3_ABI = [
  {
    inputs: [],
    name: "latestRoundData",
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const DEFAULT_LLAMA_COINS_URL = "https://coins.llama.fi";
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 min — stablecoin peg moves slowly
const FETCH_TIMEOUT_MS = 8_000;
/**
 * DefiLlama confidence below this ⇒ we distrust the aggregated print and mark
 * the reading stale rather than display a number we can't stand behind.
 */
const MIN_LLAMA_CONFIDENCE = 0.9;
/**
 * Chainlink stablecoin feeds have a long heartbeat (they only publish on
 * ~0.25–0.5% deviation or a multi-hour heartbeat), so reuse the oracle SLO.
 */
const ORACLE_STALE_THRESHOLD_MS = STALE_THRESHOLDS.btc_price_oracle;

function resolveLlamaBaseUrl(): string {
  const fromEnv = process.env.DEFILLAMA_COINS_BASE_URL;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return DEFAULT_LLAMA_COINS_URL;
}

const breaker = new CircuitBreaker({
  name: "stablecoin-prices",
  failureThreshold: 3,
  cooldownMs: 5 * 60 * 1000,
});

const cache = new Map<string, { data: StablecoinPriceSnapshot; expiresAt: number }>();
const CACHE_KEY = "stablecoin-prices:eth";

function pegDeviationBps(priceUsd: number): number {
  return Math.round(Math.abs(priceUsd - 1) * 10_000);
}

function fallbackSnapshot(fetchedAt: Date): StablecoinPriceSnapshot {
  // Honest placeholder: we mark EVERYTHING stale and peg at exactly $1.00 so
  // no downstream consumer mistakes a fallback for a live reading.
  return {
    prices: STABLECOINS.map((s) => ({
      symbol: s.symbol,
      priceUsd: 1,
      pegDeviationBps: 0,
      provenance: "stale" as const,
      updatedAt: fetchedAt,
    })),
    fetchedAt,
    source: "fallback",
    stale: true,
  };
}

/**
 * Reads one Chainlink USD aggregator. Returns null when the RPC is unwired or
 * the on-chain call fails — the caller then leans on DefiLlama.
 */
async function readChainlink(
  client: ReturnType<typeof createPublicClient>,
  aggregator: Address,
): Promise<{ priceUsd: number; updatedAt: Date } | null> {
  try {
    const [roundData, decimals] = await Promise.all([
      client.readContract({
        address: aggregator,
        abi: AGGREGATOR_V3_ABI,
        functionName: "latestRoundData",
      }),
      client
        .readContract({
          address: aggregator,
          abi: AGGREGATOR_V3_ABI,
          functionName: "decimals",
        })
        .catch(() => CHAINLINK_DECIMALS_FALLBACK),
    ]);

    const answer = roundData[1];
    const updatedAtSec = roundData[3];
    if (answer <= 0n) return null;

    const scale = 10n ** BigInt(decimals);
    const usdMicro = Number((answer * 1_000_000n) / scale);
    const priceUsd = usdMicro / 1_000_000;
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) return null;

    return { priceUsd, updatedAt: new Date(Number(updatedAtSec) * 1000) };
  } catch {
    return null;
  }
}

interface LlamaCoinEntry {
  decimals?: number;
  symbol?: string;
  price?: number;
  timestamp?: number;
  confidence?: number;
}

interface LlamaCoinsResponse {
  coins?: Record<string, LlamaCoinEntry>;
}

function llamaKeyFor(def: StablecoinDef): string {
  return def.llamaKey ?? `ethereum:${def.token}`;
}

/** One DefiLlama coins round-trip for every registered stablecoin. */
async function fetchLlamaPrices(): Promise<Map<StablecoinSymbol, LlamaCoinEntry>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const keys = STABLECOINS.map(llamaKeyFor).join(",");
    const url = `${resolveLlamaBaseUrl()}/prices/current/${keys}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`coins.llama.fi: HTTP ${res.status}`);

    const raw: unknown = await res.json();
    if (typeof raw !== "object" || raw === null || !("coins" in raw)) {
      throw new Error("coins.llama.fi: response missing `coins`");
    }
    const payload = raw as LlamaCoinsResponse;
    const byKey = payload.coins ?? {};

    const out = new Map<StablecoinSymbol, LlamaCoinEntry>();
    for (const def of STABLECOINS) {
      const entry = byKey[llamaKeyFor(def)];
      if (entry) out.set(def.symbol, entry);
    }
    return out;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Returns the latest decentralized stablecoin price snapshot. Never throws.
 *
 * Chainlink (oracle) is tried first per coin when `ETH_RPC_URL` is configured;
 * any coin without a fresh oracle read falls back to the DefiLlama aggregated
 * price. Cached 2 minutes in-memory.
 */
export async function fetchStablecoinPrices(): Promise<StablecoinPriceSnapshot> {
  const cached = cache.get(CACHE_KEY);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const fetchedAt = new Date();
  try {
    const snapshot = await breaker.run(async () => buildSnapshot(fetchedAt));
    cache.set(CACHE_KEY, { data: snapshot, expiresAt: Date.now() + CACHE_TTL_MS });
    logger.info("[stablecoin-prices] fetch success", {
      source: snapshot.source,
      coins: snapshot.prices.length,
      stale: snapshot.stale,
    });
    return snapshot;
  } catch (err) {
    logger.warn(
      "[stablecoin-prices] fetch failed, returning fallback",
      { error: err instanceof Error ? err.message : String(err) },
      err,
    );
    const snapshot = fallbackSnapshot(fetchedAt);
    cache.set(CACHE_KEY, { data: snapshot, expiresAt: Date.now() + 60 * 1000 });
    return snapshot;
  }
}

async function buildSnapshot(fetchedAt: Date): Promise<StablecoinPriceSnapshot> {
  // Read Chainlink oracles when a mainnet RPC is wired. ETH_RPC_URL is the
  // canonical name; CHAINLINK_RPC_URL (already used by btc-price.ts) is honored
  // as an alias so a single mainnet RPC powers every on-chain oracle read.
  const oracleReadings = new Map<StablecoinSymbol, { priceUsd: number; updatedAt: Date }>();
  const rpcUrl = process.env.ETH_RPC_URL ?? process.env.CHAINLINK_RPC_URL;
  if (rpcUrl && rpcUrl.trim().length > 0) {
    const client = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl, { timeout: 5_000, retryCount: 1 }),
    });
    await Promise.all(
      STABLECOINS.filter((s) => s.chainlink).map(async (s) => {
        const reading = await readChainlink(client, s.chainlink as Address);
        if (reading) oracleReadings.set(s.symbol, reading);
      }),
    );
  }

  // DefiLlama fallback (also the ONLY source for long-tail stables). If it
  // throws and we have zero oracle readings, the breaker surfaces a failure
  // and the caller serves the static fallback.
  let llama: Map<StablecoinSymbol, LlamaCoinEntry> = new Map();
  try {
    llama = await fetchLlamaPrices();
  } catch (err) {
    if (oracleReadings.size === 0) throw err; // nothing to show — go to fallback
    logger.warn("[stablecoin-prices] DefiLlama leg failed; oracle-only snapshot", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const prices: StablecoinPrice[] = [];
  let anyOracle = false;
  let anyLive = false;

  for (const def of STABLECOINS) {
    const oracle = oracleReadings.get(def.symbol);
    if (oracle) {
      const stale = evaluateFreshness(oracle.updatedAt, ORACLE_STALE_THRESHOLD_MS) === "stale";
      if (!stale) anyOracle = true;
      prices.push({
        symbol: def.symbol,
        priceUsd: round6(oracle.priceUsd),
        pegDeviationBps: pegDeviationBps(oracle.priceUsd),
        provenance: stale ? "stale" : "oracle",
        updatedAt: oracle.updatedAt,
      });
      continue;
    }

    const entry = llama.get(def.symbol);
    if (entry && typeof entry.price === "number" && Number.isFinite(entry.price)) {
      const confidence = entry.confidence ?? 0;
      const updatedAt = entry.timestamp ? new Date(entry.timestamp * 1000) : fetchedAt;
      const stale = confidence < MIN_LLAMA_CONFIDENCE;
      if (!stale) anyLive = true;
      prices.push({
        symbol: def.symbol,
        priceUsd: round6(entry.price),
        pegDeviationBps: pegDeviationBps(entry.price),
        provenance: stale ? "stale" : "live",
        updatedAt,
      });
      continue;
    }

    // No source for this coin — show an honest stale $1.00.
    prices.push({
      symbol: def.symbol,
      priceUsd: 1,
      pegDeviationBps: 0,
      provenance: "stale",
      updatedAt: fetchedAt,
    });
  }

  const source: StablecoinPriceSnapshot["source"] = anyOracle
    ? "oracle"
    : anyLive
      ? "live"
      : "fallback";
  const stale = prices.every((p) => p.provenance === "stale");

  return { prices, fetchedAt, source, stale };
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

/** Test-only helper. Clears the in-memory cache + breaker so tests start fresh. */
export function __resetStablecoinPricesCacheForTests(): void {
  cache.clear();
  breaker.reset();
}
