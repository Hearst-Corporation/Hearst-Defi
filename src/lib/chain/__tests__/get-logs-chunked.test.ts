import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_CHUNK_SIZE,
  MAX_CHUNK_SIZE,
  MIN_CHUNK_SIZE,
  computeBlockRanges,
  fetchLogsChunked,
  resolveChunkSize,
} from "@/lib/chain/get-logs-chunked";

// ---------------------------------------------------------------------------
// computeBlockRanges — pure, exhaustive.
// ---------------------------------------------------------------------------

describe("computeBlockRanges", () => {
  it("range smaller than chunk size → a single partial window", () => {
    expect(computeBlockRanges(0n, 5n, 100n)).toEqual([[0n, 5n]]);
  });

  it("range exactly one chunk → a single full window", () => {
    expect(computeBlockRanges(0n, 99n, 100n)).toEqual([[0n, 99n]]);
  });

  it("range exactly a multiple of chunk size → N equal windows, no remainder", () => {
    const ranges = computeBlockRanges(0n, 299n, 100n);
    expect(ranges).toEqual([
      [0n, 99n],
      [100n, 199n],
      [200n, 299n],
    ]);
  });

  it("range = multiple chunks + 1 → trailing single-block window", () => {
    const ranges = computeBlockRanges(0n, 200n, 100n);
    expect(ranges).toEqual([
      [0n, 99n],
      [100n, 199n],
      [200n, 200n],
    ]);
  });

  it("fromBlock === toBlock → exactly one single-block window", () => {
    expect(computeBlockRanges(42n, 42n, 100n)).toEqual([[42n, 42n]]);
  });

  it("chunkSize = 1 → one window per block", () => {
    const ranges = computeBlockRanges(10n, 13n, 1n);
    expect(ranges).toEqual([
      [10n, 10n],
      [11n, 11n],
      [12n, 12n],
      [13n, 13n],
    ]);
  });

  it("realistic scale: deploy-block-ish range at 100k chunk → ~12 windows, exact coverage", () => {
    const fromBlock = 42_743_173n;
    const toBlock = 43_883_173n; // +1.14M blocks, matches the mission's measured span
    const ranges = computeBlockRanges(fromBlock, toBlock, 100_000n);

    // No gaps, no overlaps: each window's end + 1 === next window's start.
    for (let i = 1; i < ranges.length; i++) {
      const prevEnd = ranges[i - 1]![1];
      const currStart = ranges[i]![0];
      expect(currStart).toBe(prevEnd + 1n);
    }
    expect(ranges[0]![0]).toBe(fromBlock);
    expect(ranges.at(-1)![1]).toBe(toBlock);
    expect(ranges.length).toBeGreaterThanOrEqual(11);
    expect(ranges.length).toBeLessThanOrEqual(13);
  });

  it("throws when fromBlock > toBlock (caller bug, not a valid empty range)", () => {
    expect(() => computeBlockRanges(10n, 5n, 100n)).toThrow(
      /fromBlock .* must be <= toBlock/,
    );
  });

  it("throws when chunkSize < 1", () => {
    expect(() => computeBlockRanges(0n, 10n, 0n)).toThrow(
      /chunkSize must be >= 1/,
    );
  });
});

// ---------------------------------------------------------------------------
// resolveChunkSize — env clamp, never rejects.
// ---------------------------------------------------------------------------

describe("resolveChunkSize", () => {
  it("defaults to 100,000 when raw is undefined", () => {
    expect(resolveChunkSize(undefined)).toBe(DEFAULT_CHUNK_SIZE);
  });

  it("passes through a value inside the [100, 500_000] range", () => {
    expect(resolveChunkSize(50_000)).toBe(50_000n);
  });

  it("clamps below MIN_CHUNK_SIZE up to the floor", () => {
    expect(resolveChunkSize(1)).toBe(MIN_CHUNK_SIZE);
  });

  it("clamps above MAX_CHUNK_SIZE down to the ceiling", () => {
    expect(resolveChunkSize(10_000_000)).toBe(MAX_CHUNK_SIZE);
  });

  it("truncates a non-integer input rather than throwing", () => {
    expect(resolveChunkSize(123.9)).toBe(123n);
  });
});

// ---------------------------------------------------------------------------
// fetchLogsChunked — pagination + concurrency + fail-closed semantics.
// ---------------------------------------------------------------------------

describe("fetchLogsChunked", () => {
  it("aggregates results from every window in range order", async () => {
    const fetchWindow = vi.fn(async (from: bigint, to: bigint) => [
      `${from}-${to}`,
    ]);

    const result = await fetchLogsChunked(fetchWindow, {
      fromBlock: 0n,
      toBlock: 249n,
      chunkSize: 100n,
    });

    expect(result).toEqual(["0-99", "100-199", "200-249"]);
    expect(fetchWindow).toHaveBeenCalledTimes(3);
  });

  it("never issues more than `concurrency` calls concurrently", async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    const fetchWindow = vi.fn(async (from: bigint, to: bigint) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
      return [`${from}-${to}`];
    });

    await fetchLogsChunked(fetchWindow, {
      fromBlock: 0n,
      toBlock: 999n, // 10 windows of 100 blocks
      chunkSize: 100n,
      concurrency: 4,
    });

    expect(maxInFlight).toBeLessThanOrEqual(4);
    expect(fetchWindow).toHaveBeenCalledTimes(10);
  });

  it("defaults to concurrency=4 when not specified", async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    const fetchWindow = vi.fn(async (from: bigint, to: bigint) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
      return [`${from}-${to}`];
    });

    await fetchLogsChunked(fetchWindow, {
      fromBlock: 0n,
      toBlock: 799n, // 8 windows
      chunkSize: 100n,
    });

    expect(maxInFlight).toBeLessThanOrEqual(4);
  });

  it("retries a failing window exactly once, then succeeds if the retry passes", async () => {
    let calls = 0;
    const fetchWindow = vi.fn(async (from: bigint, to: bigint) => {
      calls++;
      if (calls === 1) throw new Error("transient RPC hiccup");
      return [`${from}-${to}`];
    });

    const result = await fetchLogsChunked(fetchWindow, {
      fromBlock: 0n,
      toBlock: 50n,
      chunkSize: 100n,
    });

    expect(result).toEqual(["0-50"]);
    expect(fetchWindow).toHaveBeenCalledTimes(2);
  });

  it("fails closed (rejects, no partial results) when a window errors twice", async () => {
    const fetchWindow = vi.fn(async (from: bigint, to: bigint) => {
      if (from === 100n) throw new Error("window permanently down");
      return [`${from}-${to}`];
    });

    await expect(
      fetchLogsChunked(fetchWindow, {
        fromBlock: 0n,
        toBlock: 299n, // windows: [0,99] ok, [100,199] fails twice, [200,299] ok
        chunkSize: 100n,
        concurrency: 1, // deterministic ordering for this assertion
      }),
    ).rejects.toThrow("window permanently down");

    // The failing window was attempted exactly twice (1 try + 1 retry).
    const failingCalls = fetchWindow.mock.calls.filter(
      ([from]) => from === 100n,
    );
    expect(failingCalls).toHaveLength(2);
  });

  it("single-block range (fromBlock === toBlock) produces one window, one call", async () => {
    const fetchWindow = vi.fn(async () => ["only"]);

    const result = await fetchLogsChunked(fetchWindow, {
      fromBlock: 42n,
      toBlock: 42n,
      chunkSize: 100_000n,
    });

    expect(result).toEqual(["only"]);
    expect(fetchWindow).toHaveBeenCalledTimes(1);
  });
});
