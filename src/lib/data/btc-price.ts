import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createPublicClient, http, type Address } from "viem";
import { mainnet } from "viem/chains";

import { env } from "@/lib/env";
import { evaluateFreshness, STALE_THRESHOLDS } from "@/lib/data/freshness";
import { ADMIN_DASHBOARD_REVALIDATE_SEC } from "@/lib/data/admin-dashboard-cache";
import { captureMessage } from "@/lib/error-tracking";

/**
 * BTC price loader — methodology v1.0 source contract.
 *
 *   - Primary  : Chainlink `BTC/USD` aggregator (on-chain oracle, Ethereum
 *                mainnet). Wired ONLY when `CHAINLINK_RPC_URL` (a mainnet RPC)
 *                is set — the aggregator lives on mainnet, so it must be read
 *                over a mainnet RPC, NOT the app's Base-Sepolia
 *                `NEXT_PUBLIC_CHAIN_RPC_URL`. Address defaults to mainnet
 *                `0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c` (override via
 *                `NEXT_PUBLIC_CHAINLINK_BTC_USD_ADDRESS`). When read
 *                successfully, `provenance: "oracle"`. When `CHAINLINK_RPC_URL`
 *                is unset the oracle is skipped and CoinGecko `live` is served.
 *   - Fallback : CoinGecko spot price. `provenance: "live"`.
 *   - Stale    : age > 5 minutes OR neither source responded. `provenance: "stale"`.
 *
 * The shape is kept additive: existing consumers reading `usd`, `usd_24h_change`,
 * `fetched_at` and `stale` keep working unchanged; the new `provenance` field
 * is read by the UI to display the correct badge per methodology #2.
 */

export type BtcPriceProvenance = "oracle" | "live" | "stale";

export interface BtcPriceData {
  usd: number;
  usd_24h_change: number;
  fetched_at: Date;
  stale: boolean; // true if age > 5 minutes
  provenance: BtcPriceProvenance;
}

interface CoinGeckoResponse {
  bitcoin: {
    usd: number;
    usd_24h_change: number;
  };
}

const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true";

// Freshness SLO comes from the central registry (`lib/data/freshness`).
// Local alias kept for clarity at call sites.
const STALE_THRESHOLD_MS = STALE_THRESHOLDS.btc_price;

// Chainlink BTC/USD aggregator on Ethereum mainnet — the canonical reference
// price used by the bulk of DeFi protocols. Used when the configured RPC
// resolves to mainnet (or when `NEXT_PUBLIC_CHAINLINK_BTC_USD_ADDRESS` is set
// explicitly, overriding chain detection).
const CHAINLINK_BTC_USD_MAINNET: Address =
  "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c";

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

function parseAddress(raw: string | undefined): Address | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("0x") || trimmed.length !== 42) return null;
  if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) return null;
  return trimmed as Address;
}

/**
 * Reads the Chainlink BTC/USD aggregator if (and only if) the RPC env is set
 * AND an aggregator address is resolvable. Returns `null` when not wired or
 * when the on-chain call fails — callers fall back to CoinGecko.
 */
async function fetchChainlinkBtcUsd(): Promise<{
  usd: number;
  updatedAt: Date;
} | null> {
  // The Chainlink BTC/USD aggregator lives on Ethereum MAINNET, so it must be
  // read over a mainnet RPC — NOT the app's Base-Sepolia NEXT_PUBLIC_CHAIN_RPC_URL
  // (querying a mainnet aggregator address over the Base-Sepolia RPC always
  // failed, which is why "oracle" provenance was never actually reachable).
  const rpcUrl = env.CHAINLINK_RPC_URL;
  if (!rpcUrl || rpcUrl.trim().length === 0) return null;

  const explicit = parseAddress(env.NEXT_PUBLIC_CHAINLINK_BTC_USD_ADDRESS);
  const aggregator = explicit ?? CHAINLINK_BTC_USD_MAINNET;

  try {
    const client = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl, { timeout: 5_000, retryCount: 1 }),
    });

    const [roundData, decimals] = await Promise.all([
      client.readContract({
        address: aggregator,
        abi: AGGREGATOR_V3_ABI,
        functionName: "latestRoundData",
      }),
      client.readContract({
        address: aggregator,
        abi: AGGREGATOR_V3_ABI,
        functionName: "decimals",
      }),
    ]);

    // roundData = [roundId, answer, startedAt, updatedAt, answeredInRound]
    const answer = roundData[1];
    const updatedAtSec = roundData[3];
    if (answer <= 0n) return null;

    const scale = 10n ** BigInt(decimals);
    // Convert to USD with 6 decimals of precision then back to number.
    const usdMicro = Number((answer * 1_000_000n) / scale);
    const usd = usdMicro / 1_000_000;
    if (!Number.isFinite(usd) || usd <= 0) return null;

    const updatedAt = new Date(Number(updatedAtSec) * 1000);
    return { usd, updatedAt };
  } catch {
    return null;
  }
}

interface CoinGeckoResult {
  usd: number;
  usd_24h_change: number;
}

async function fetchCoinGecko(): Promise<CoinGeckoResult | null> {
  try {
    const res = await fetch(COINGECKO_URL, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const data = (await res.json()) as CoinGeckoResponse;
    const usd = data?.bitcoin?.usd ?? 0;
    const usd_24h_change = data?.bitcoin?.usd_24h_change ?? 0;
    if (usd === 0) return null;
    return { usd, usd_24h_change };
  } catch {
    return null;
  }
}

async function fetchBtcPriceUncached(): Promise<BtcPriceData> {
  const fetched_at = new Date();

  // 1) Try Chainlink first (primary per methodology v1.0).
  const oracle = await fetchChainlinkBtcUsd();
  if (oracle !== null) {
    // 24h change is not exposed by the aggregator. We enrich it with CoinGecko
    // when available, but the spot price itself remains the on-chain reading.
    const gecko = await fetchCoinGecko();
    const usd_24h_change = gecko?.usd_24h_change ?? 0;

    // Use the oracle-specific SLO (75 min): the Chainlink aggregator updates on
    // ~0.5% deviation or ~1 h heartbeat, so the 5-min spot SLO is too tight here.
    const stale = evaluateFreshness(oracle.updatedAt, STALE_THRESHOLDS.btc_price_oracle) === "stale";
    return {
      usd: oracle.usd,
      usd_24h_change,
      fetched_at,
      stale,
      provenance: stale ? "stale" : "oracle",
    };
  }

  // Oracle unavailable. Only a CONFIGURED-but-failing oracle is a genuine
  // degradation worth surfacing. When CHAINLINK_RPC_URL is unset, CoinGecko
  // `live` is the intended mode (not a degradation), so we stay quiet instead
  // of firing a permanent false "degraded" alert every call. `captureMessage`
  // is a no-op without SENTRY_DSN and Sentry groups identical messages, so a
  // per-call capture becomes one grouped issue with a count, not log spam.
  const oracleConfigured =
    !!env.CHAINLINK_RPC_URL && env.CHAINLINK_RPC_URL.trim().length > 0;
  if (process.env.NODE_ENV === "production" && oracleConfigured) {
    captureMessage(
      "BTC price degraded: Chainlink oracle call failed, falling back to CoinGecko spot.",
      {
        reason: "oracle_call_failed",
        expectedProvenance: "oracle",
      },
    );
  }

  // 2) Fallback: CoinGecko.
  const gecko = await fetchCoinGecko();
  if (gecko !== null) {
    const stale = evaluateFreshness(fetched_at, STALE_THRESHOLD_MS) === "stale";
    return {
      usd: gecko.usd,
      usd_24h_change: gecko.usd_24h_change,
      fetched_at,
      stale,
      provenance: stale ? "stale" : "live",
    };
  }

  // 3) Nothing worked — neither oracle nor CoinGecko responded. This is a
  // harder failure than the degradation above; always surface it in prod.
  if (process.env.NODE_ENV === "production") {
    captureMessage(
      "BTC price unavailable: Chainlink oracle and CoinGecko both failed; serving stale $0.",
      { expectedProvenance: "oracle", servedProvenance: "stale" },
    );
  }
  return {
    usd: 0,
    usd_24h_change: 0,
    fetched_at,
    stale: true,
    provenance: "stale",
  };
}

/** Cross-request cache with per-request dedup on top. */
const fetchBtcPriceCrossRequest = unstable_cache(
  fetchBtcPriceUncached,
  ["admin-btc-price"],
  { revalidate: ADMIN_DASHBOARD_REVALIDATE_SEC, tags: ["admin-btc-price"] },
);

export const fetchBtcPrice = cache(
  async (): Promise<BtcPriceData> => fetchBtcPriceCrossRequest(),
);
