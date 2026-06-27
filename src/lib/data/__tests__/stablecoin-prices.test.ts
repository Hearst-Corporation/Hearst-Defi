import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetStablecoinPricesCacheForTests,
  fetchStablecoinPrices,
} from "@/lib/data/stablecoin-prices";

/**
 * The stablecoin loader has two legs:
 *   - Chainlink oracles via viem (only when ETH_RPC_URL / CHAINLINK_RPC_URL set)
 *   - DefiLlama coins API via fetch (fallback + long-tail)
 *
 * These cases exercise the DefiLlama leg and the static fallback with NO RPC
 * configured (so the oracle leg is skipped and the logic is deterministic).
 * The oracle leg is integration-tested separately; here we pin the provenance
 * contract: DefiLlama → "live", nothing → "stale", never falsely "oracle".
 *
 * NOTE: never imports from `Dev/hearst-connect` — recoded from scratch here.
 */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

interface LlamaEntry {
  decimals?: number;
  symbol?: string;
  price?: number;
  timestamp?: number;
  confidence?: number;
}

function coinsPayload(entries: Record<string, LlamaEntry>): { coins: Record<string, LlamaEntry> } {
  return { coins: entries };
}

const USDC_KEY = "ethereum:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const USDT_KEY = "ethereum:0xdAC17F958D2ee523a2206206994597C13D831ec7";
const DAI_KEY = "ethereum:0x6B175474E89094C44Da98b954EedeAC495271d0F";

const NOW_SEC = Math.floor(Date.parse("2026-06-27T00:00:00Z") / 1000);

beforeEach(() => {
  __resetStablecoinPricesCacheForTests();
  // Ensure the oracle leg is skipped — purely DefiLlama/fallback path.
  vi.stubEnv("ETH_RPC_URL", "");
  vi.stubEnv("CHAINLINK_RPC_URL", "");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("fetchStablecoinPrices (DefiLlama leg, no RPC)", () => {
  it("Cas A — DefiLlama OK: maps prices, provenance 'live', source 'live'", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(
        coinsPayload({
          [USDC_KEY]: { symbol: "USDC", price: 0.9998, timestamp: NOW_SEC, confidence: 0.99 },
          [USDT_KEY]: { symbol: "USDT", price: 0.9986, timestamp: NOW_SEC, confidence: 0.99 },
          [DAI_KEY]: { symbol: "DAI", price: 0.9997, timestamp: NOW_SEC, confidence: 0.99 },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const snap = await fetchStablecoinPrices();

    expect(snap.source).toBe("live");
    expect(snap.stale).toBe(false);
    const usdc = snap.prices.find((p) => p.symbol === "USDC");
    expect(usdc?.priceUsd).toBe(0.9998);
    expect(usdc?.provenance).toBe("live"); // aggregator → live, NEVER oracle
    // Peg deviation: |0.9998 - 1| * 10000 = 2 bps.
    expect(usdc?.pegDeviationBps).toBe(2);
  });

  it("Cas B — low confidence is marked stale, not trusted", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(
        coinsPayload({
          [USDC_KEY]: { symbol: "USDC", price: 0.95, timestamp: NOW_SEC, confidence: 0.4 },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const snap = await fetchStablecoinPrices();
    const usdc = snap.prices.find((p) => p.symbol === "USDC");
    expect(usdc?.provenance).toBe("stale");
  });

  it("Cas C — missing coin: honest stale $1.00 placeholder", async () => {
    // DefiLlama returns only USDC; USDT/DAI/long-tail absent.
    const fetchMock = vi.fn(async () =>
      jsonResponse(
        coinsPayload({
          [USDC_KEY]: { symbol: "USDC", price: 0.9999, timestamp: NOW_SEC, confidence: 0.99 },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const snap = await fetchStablecoinPrices();
    const usdt = snap.prices.find((p) => p.symbol === "USDT");
    expect(usdt?.provenance).toBe("stale");
    expect(usdt?.priceUsd).toBe(1);
    // USDC still live → snapshot source is live.
    expect(snap.source).toBe("live");
  });

  it("Cas D — DefiLlama HTTP error: static fallback (all stale)", async () => {
    const fetchMock = vi.fn(async () => new Response("boom", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const snap = await fetchStablecoinPrices();
    expect(snap.source).toBe("fallback");
    expect(snap.stale).toBe(true);
    expect(snap.prices.every((p) => p.provenance === "stale")).toBe(true);
    expect(snap.prices.every((p) => p.priceUsd === 1)).toBe(true);
  });

  it("Cas E — network throws: static fallback", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    });
    vi.stubGlobal("fetch", fetchMock);

    const snap = await fetchStablecoinPrices();
    expect(snap.source).toBe("fallback");
    expect(snap.stale).toBe(true);
  });

  it("Cas F — cache hit: second call within TTL does not refetch", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(
        coinsPayload({
          [USDC_KEY]: { symbol: "USDC", price: 0.9998, timestamp: NOW_SEC, confidence: 0.99 },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const first = await fetchStablecoinPrices();
    const second = await fetchStablecoinPrices();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });
});
