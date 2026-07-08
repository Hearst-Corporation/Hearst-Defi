import "server-only";

/**
 * Shared pagination helper for `eth_getLogs` / `getContractEvents` reads.
 *
 * Free-tier RPC providers cap the block range accepted per call (measured:
 * sepolia.base.org=2,000, drpc=10,000, tenderly=100,000, current Alchemy
 * free plan=10). A single `fromBlock=deployBlock` → `toBlock=latest` call
 * over the Proof Center's ~1.14M-block history always exceeds every one of
 * these caps, so it always errors. This module splits that range into
 * bounded windows, fetches them with limited concurrency, and aggregates.
 *
 * Fail-closed by design: if any window still errors after one retry, the
 * whole call rejects — callers must NOT return a partial page silently (a
 * partial on-chain event log with an honest-looking "Live" badge is worse
 * than an honest empty state). `fetchOnChainEvents` / `fetchOnChainAttestations`
 * keep their existing outer try/catch → `[]` contract; this helper is what
 * they call inside that catch boundary.
 */

export const DEFAULT_CHUNK_SIZE = 100_000n;
export const MIN_CHUNK_SIZE = 100n;
export const MAX_CHUNK_SIZE = 500_000n;
export const DEFAULT_CONCURRENCY = 4;

/**
 * Resolves the configured chunk size (blocks per `getLogs` window), clamped
 * to a sane range. `raw` is the parsed env value (or `undefined` when unset
 * — callers pass `env.NEXT_PUBLIC_CHAIN_LOG_CHUNK_SIZE`).
 *
 * Two distinct degrade paths, both non-throwing:
 *  - A value that's invalid as a *number* at all (empty string, "0", a
 *    negative or non-integer value) never reaches this function — the env
 *    schema (`src/lib/env.ts`) uses `.catch(undefined)` so a malformed raw
 *    env var resolves to `undefined` at boot instead of failing the whole
 *    server-env parse. This function then applies `DEFAULT_CHUNK_SIZE` for
 *    that `undefined`, same as if the var were simply unset.
 *  - A value that *is* a valid positive integer but numerically out of the
 *    sane operating range (e.g. an operator fat-fingering a too-small or
 *    too-large override) is clamped to `[MIN_CHUNK_SIZE, MAX_CHUNK_SIZE]`
 *    here, so it degrades gracefully instead of taking down the Proof
 *    Center panels.
 */
export function resolveChunkSize(raw: number | undefined): bigint {
  if (raw === undefined || !Number.isFinite(raw)) return DEFAULT_CHUNK_SIZE;
  const value = BigInt(Math.trunc(raw));
  if (value < MIN_CHUNK_SIZE) return MIN_CHUNK_SIZE;
  if (value > MAX_CHUNK_SIZE) return MAX_CHUNK_SIZE;
  return value;
}

/**
 * Splits `[fromBlock, toBlock]` (inclusive on both ends) into a sequence of
 * inclusive windows of at most `chunkSize` blocks each. Pure — no I/O.
 *
 * Contract:
 *  - Windows cover the full range exactly, no gaps, no overlaps.
 *  - The last window may be a smaller, partial tail.
 *  - `fromBlock === toBlock` yields exactly one single-block window.
 *  - Throws (rather than silently returning `[]`) when `fromBlock > toBlock`
 *    or `chunkSize < 1n` — both are caller bugs, not a valid empty range.
 */
export function computeBlockRanges(
  fromBlock: bigint,
  toBlock: bigint,
  chunkSize: bigint,
): Array<[bigint, bigint]> {
  if (chunkSize < 1n) {
    throw new Error(
      `computeBlockRanges: chunkSize must be >= 1, got ${chunkSize}`,
    );
  }
  if (fromBlock > toBlock) {
    throw new Error(
      `computeBlockRanges: fromBlock (${fromBlock}) must be <= toBlock (${toBlock})`,
    );
  }

  const ranges: Array<[bigint, bigint]> = [];
  let start = fromBlock;
  while (start <= toBlock) {
    const tentativeEnd = start + chunkSize - 1n;
    const end = tentativeEnd < toBlock ? tentativeEnd : toBlock;
    ranges.push([start, end]);
    start = end + 1n;
  }
  return ranges;
}

export interface FetchLogsChunkedOptions {
  fromBlock: bigint;
  toBlock: bigint;
  chunkSize: bigint;
  /** Max windows in flight at once. Defaults to 4. */
  concurrency?: number;
}

/**
 * Runs `fetchWindow` across `[fromBlock, toBlock]`, split into `chunkSize`
 * windows, at most `concurrency` in flight simultaneously. Aggregates results
 * in window order (stable — the order of the ranges themselves, not
 * completion order), then flattens.
 *
 * Each window gets ONE retry on failure. If a window fails twice, this
 * function rejects (does not swallow, does not return the partial results
 * gathered so far) — fail-closed, see module docstring.
 */
export async function fetchLogsChunked<T>(
  fetchWindow: (fromBlock: bigint, toBlock: bigint) => Promise<T[]>,
  opts: FetchLogsChunkedOptions,
): Promise<T[]> {
  const { fromBlock, toBlock, chunkSize, concurrency = DEFAULT_CONCURRENCY } =
    opts;
  const ranges = computeBlockRanges(fromBlock, toBlock, chunkSize);

  const resultsByWindow: T[][] = new Array(ranges.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= ranges.length) return;
      const range = ranges[index];
      if (!range) return;
      const [windowFrom, windowTo] = range;
      resultsByWindow[index] = await fetchWindowWithOneRetry(
        fetchWindow,
        windowFrom,
        windowTo,
      );
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, ranges.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return resultsByWindow.flat();
}

async function fetchWindowWithOneRetry<T>(
  fetchWindow: (fromBlock: bigint, toBlock: bigint) => Promise<T[]>,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<T[]> {
  try {
    return await fetchWindow(fromBlock, toBlock);
  } catch {
    // Single retry — transient RPC hiccups shouldn't blank the whole page.
    // If this also throws, it propagates to the caller (fail-closed).
    return await fetchWindow(fromBlock, toBlock);
  }
}
