import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetLendingYieldsCacheForTests,
  fetchLendingYields,
} from "@/lib/data/lending-yields";

/**
 * The lending-yields loader hits the single public DeFiLlama /pools endpoint.
 * We stub `fetch` globally and reset the in-memory cache between cases.
 *
 * NOTE: never imports from `Dev/hearst-connect` — recoded from scratch here.
 */

interface PoolRaw {
  pool: string;
  project: string;
  chain: string;
  symbol: string;
  apy: number | null;
  apyBase: number | null;
  apyReward: number | null;
  tvlUsd: number | null;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function poolsPayload(pools: PoolRaw[]): { status: string; data: PoolRaw[] } {
  return { status: "success", data: pools };
}

beforeEach(() => {
  __resetLendingYieldsCacheForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchLendingYields", () => {
  it("Cas A — fetch OK: groups by protocol, keeps base/reward split, returns live", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(
        poolsPayload([
          {
            pool: "aave-1",
            project: "aave-v3",
            chain: "Ethereum",
            symbol: "USDC",
            apy: 5.4,
            apyBase: 5.4,
            apyReward: null,
            tvlUsd: 1_200_000_000,
          },
          {
            pool: "comp-1",
            project: "compound-v3",
            chain: "Base",
            symbol: "USDC",
            apy: 6.8,
            apyBase: 6.0,
            apyReward: 0.8,
            tvlUsd: 400_000_000,
          },
          {
            pool: "morpho-1",
            project: "morpho-blue",
            chain: "Arbitrum",
            symbol: "USDC",
            apy: 9.1,
            apyBase: 8.9,
            apyReward: 0.2,
            tvlUsd: 80_000_000,
          },
          // Rejected: TVL too low
          {
            pool: "tiny",
            project: "aave-v3",
            chain: "Ethereum",
            symbol: "USDC",
            apy: 25.0,
            apyBase: 25.0,
            apyReward: null,
            tvlUsd: 1_000_000,
          },
          // Rejected: not a tracked protocol
          {
            pool: "lido",
            project: "lido",
            chain: "Ethereum",
            symbol: "USDC",
            apy: 7.0,
            apyBase: 7.0,
            apyReward: null,
            tvlUsd: 500_000_000,
          },
          // Rejected: not USDC
          {
            pool: "aave-usdt",
            project: "aave-v3",
            chain: "Ethereum",
            symbol: "USDT",
            apy: 4.0,
            apyBase: 4.0,
            apyReward: null,
            tvlUsd: 500_000_000,
          },
        ]),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const snap = await fetchLendingYields();

    expect(snap.source).toBe("live");
    expect(snap.stale).toBe(false);
    // 3 qualifying pools across 3 protocols.
    expect(snap.pools).toHaveLength(3);
    expect(snap.protocols).toHaveLength(3);
    // Sorted by top-pool APY desc: morpho (9.1) > compound (6.8) > aave (5.4).
    expect(snap.protocols.map((p) => p.protocol)).toEqual([
      "morpho",
      "compound",
      "aave",
    ]);
    // Base/reward split preserved.
    const compound = snap.protocols.find((p) => p.protocol === "compound");
    expect(compound?.topPool.apyBasePct).toBe(6.0);
    expect(compound?.topPool.apyRewardPct).toBe(0.8);
    // aave-v3 reward null → 0.
    const aave = snap.protocols.find((p) => p.protocol === "aave");
    expect(aave?.topPool.apyRewardPct).toBe(0);
  });

  it("Cas B — fetch timeout: returns fallback (source='fallback', stale)", async () => {
    const fetchMock = vi.fn(async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    });
    vi.stubGlobal("fetch", fetchMock);

    const snap = await fetchLendingYields();

    expect(snap.source).toBe("fallback");
    expect(snap.stale).toBe(true);
    expect(snap.protocols.length).toBeGreaterThan(0);
    expect(snap.pools.length).toBeGreaterThan(0);
  });

  it("Cas C — no qualifying pools: returns fallback", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(
        poolsPayload([
          {
            pool: "lido",
            project: "lido",
            chain: "Ethereum",
            symbol: "STETH",
            apy: 2.6,
            apyBase: 2.6,
            apyReward: null,
            tvlUsd: 14_000_000_000,
          },
        ]),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const snap = await fetchLendingYields();
    expect(snap.source).toBe("fallback");
    expect(snap.stale).toBe(true);
  });

  it("Cas D — invalid shape: returns fallback", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ status: "success", data: "not-an-array" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const snap = await fetchLendingYields();
    expect(snap.source).toBe("fallback");
  });

  it("Cas E — cache hit: second call within TTL does not refetch", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(
        poolsPayload([
          {
            pool: "aave-1",
            project: "aave-v3",
            chain: "Ethereum",
            symbol: "USDC",
            apy: 5.4,
            apyBase: 5.4,
            apyReward: null,
            tvlUsd: 1_200_000_000,
          },
        ]),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const first = await fetchLendingYields();
    const second = await fetchLendingYields();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });
});
