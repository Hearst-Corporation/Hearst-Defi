import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetProtocolTvlCacheForTests,
  fetchProtocolTvl,
} from "@/lib/data/protocol-tvl";

/**
 * The protocol-TVL loader calls DeFiLlama /tvl/{slug} once per protocol, each
 * returning a bare JSON number. We stub `fetch` per-URL and reset the cache.
 *
 * NOTE: never imports from `Dev/hearst-connect` — recoded from scratch here.
 */

function numberResponse(n: number, status = 200): Response {
  return new Response(JSON.stringify(n), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Maps a slug → TVL number for the mock; missing slug → 404. */
function tvlFetchMock(bySlug: Record<string, number>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const slug = url.split("/tvl/")[1] ?? "";
    const n = bySlug[slug];
    if (typeof n !== "number") {
      return new Response("not found", { status: 404 });
    }
    return numberResponse(n);
  });
}

beforeEach(() => {
  __resetProtocolTvlCacheForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchProtocolTvl", () => {
  it("Cas A — all slugs OK: per-protocol live TVL + summed total", async () => {
    const fetchMock = tvlFetchMock({
      "aave-v3": 11_800_000_000,
      "compound-v3": 1_035_000_000,
      "morpho-blue": 6_540_000_000,
    });
    vi.stubGlobal("fetch", fetchMock);

    const snap = await fetchProtocolTvl();

    expect(snap.source).toBe("live");
    expect(snap.stale).toBe(false);
    expect(snap.protocols).toHaveLength(3);
    expect(snap.protocols.every((p) => p.provenance === "live")).toBe(true);
    expect(snap.totalTvlUsd).toBe(11_800_000_000 + 1_035_000_000 + 6_540_000_000);
    const morpho = snap.protocols.find((p) => p.protocol === "morpho");
    expect(morpho?.slug).toBe("morpho-blue");
    expect(morpho?.tvlUsd).toBe(6_540_000_000);
  });

  it("Cas B — partial failure: failed slug is stale, others live", async () => {
    const fetchMock = tvlFetchMock({
      "aave-v3": 11_800_000_000,
      "morpho-blue": 6_540_000_000,
      // compound-v3 missing → 404 → stale
    });
    vi.stubGlobal("fetch", fetchMock);

    const snap = await fetchProtocolTvl();

    expect(snap.source).toBe("live"); // ≥1 live
    expect(snap.stale).toBe(false);
    const compound = snap.protocols.find((p) => p.protocol === "compound");
    expect(compound?.provenance).toBe("stale");
    expect(compound?.tvlUsd).toBe(0);
    // Total excludes the failed slug.
    expect(snap.totalTvlUsd).toBe(11_800_000_000 + 6_540_000_000);
  });

  it("Cas C — every slug fails: returns fallback, all stale", async () => {
    const fetchMock = tvlFetchMock({}); // every slug 404
    vi.stubGlobal("fetch", fetchMock);

    const snap = await fetchProtocolTvl();

    expect(snap.source).toBe("fallback");
    expect(snap.stale).toBe(true);
    expect(snap.totalTvlUsd).toBe(0);
    expect(snap.protocols.every((p) => p.provenance === "stale")).toBe(true);
  });

  it("Cas D — network throws: returns fallback", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    });
    vi.stubGlobal("fetch", fetchMock);

    const snap = await fetchProtocolTvl();
    expect(snap.source).toBe("fallback");
    expect(snap.stale).toBe(true);
  });

  it("Cas E — cache hit: second call within TTL does not refetch", async () => {
    const fetchMock = tvlFetchMock({
      "aave-v3": 11_800_000_000,
      "compound-v3": 1_035_000_000,
      "morpho-blue": 6_540_000_000,
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = await fetchProtocolTvl();
    const callsAfterFirst = fetchMock.mock.calls.length;
    const second = await fetchProtocolTvl();

    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);
    expect(second).toBe(first);
  });
});
