import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetBinancePriceCacheForTests,
  fetchBinancePrices,
} from "@/lib/data/binance-price";

/**
 * The Binance loader calls the REST /api/v3/ticker/24hr endpoint with a batched
 * `symbols=[...]` query, returning an array of ticker objects. We stub `fetch`
 * globally and reset the in-memory cache between cases.
 *
 * NOTE: never imports from `Dev/hearst-connect` — recoded from scratch here.
 */

interface Ticker24hr {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  __resetBinancePriceCacheForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchBinancePrices", () => {
  it("Cas A — fetch OK: maps lastPrice/priceChangePercent, returns live", async () => {
    const payload: Ticker24hr[] = [
      { symbol: "BTCUSDT", lastPrice: "59696.00000000", priceChangePercent: "0.225" },
      { symbol: "ETHUSDT", lastPrice: "1572.35000000", priceChangePercent: "-1.10" },
    ];
    const fetchMock = vi.fn(async () => jsonResponse(payload));
    vi.stubGlobal("fetch", fetchMock);

    const snap = await fetchBinancePrices(["BTCUSDT", "ETHUSDT"]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(snap.source).toBe("live");
    expect(snap.stale).toBe(false);
    expect(snap.tickers).toHaveLength(2);
    expect(snap.tickers[0]).toMatchObject({
      symbol: "BTCUSDT",
      lastPrice: 59696,
      priceChangePct: 0.225,
      provenance: "live",
    });
    expect(snap.tickers[1]?.priceChangePct).toBe(-1.1);
  });

  it("Cas B — single-symbol object response is normalized to an array", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        symbol: "BTCUSDT",
        lastPrice: "60000.00",
        priceChangePercent: "1.5",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const snap = await fetchBinancePrices(["BTCUSDT"]);
    expect(snap.source).toBe("live");
    expect(snap.tickers).toHaveLength(1);
    expect(snap.tickers[0]?.lastPrice).toBe(60000);
  });

  it("Cas C — lowercase input is upper-cased and preserved in order", async () => {
    const payload: Ticker24hr[] = [
      { symbol: "ETHUSDT", lastPrice: "1572.00", priceChangePercent: "0" },
      { symbol: "BTCUSDT", lastPrice: "59696.00", priceChangePercent: "0" },
    ];
    const fetchMock = vi.fn(async () => jsonResponse(payload));
    vi.stubGlobal("fetch", fetchMock);

    // Requested order: btc, eth (lowercase). Output must follow requested order.
    const snap = await fetchBinancePrices(["btcusdt", "ethusdt"]);
    expect(snap.tickers.map((t) => t.symbol)).toEqual(["BTCUSDT", "ETHUSDT"]);
  });

  it("Cas D — timeout: returns fallback (stale rows for requested symbols)", async () => {
    const fetchMock = vi.fn(async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    });
    vi.stubGlobal("fetch", fetchMock);

    const snap = await fetchBinancePrices(["BTCUSDT", "ETHUSDT"]);
    expect(snap.source).toBe("fallback");
    expect(snap.stale).toBe(true);
    expect(snap.tickers).toHaveLength(2);
    expect(snap.tickers.every((t) => t.provenance === "stale")).toBe(true);
  });

  it("Cas E — empty/garbage response: returns fallback", async () => {
    const fetchMock = vi.fn(async () => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    const snap = await fetchBinancePrices(["BTCUSDT"]);
    expect(snap.source).toBe("fallback");
  });

  it("Cas F — empty symbol list: fallback with no network call", async () => {
    const fetchMock = vi.fn(async () => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    const snap = await fetchBinancePrices([]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(snap.source).toBe("fallback");
    expect(snap.tickers).toHaveLength(0);
  });

  it("Cas G — cache hit: second call within TTL does not refetch", async () => {
    const payload: Ticker24hr[] = [
      { symbol: "BTCUSDT", lastPrice: "59696.00", priceChangePercent: "0.2" },
    ];
    const fetchMock = vi.fn(async () => jsonResponse(payload));
    vi.stubGlobal("fetch", fetchMock);

    const first = await fetchBinancePrices(["BTCUSDT"]);
    const second = await fetchBinancePrices(["BTCUSDT"]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });
});
