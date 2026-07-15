import "server-only";

import { logger } from "@/lib/logger";

/**
 * JSON boundary for the `Wired<T>` envelope produced by
 * `src/lib/chain/dynavault.ts`.
 *
 * Three boring jobs, on purpose:
 *
 *  1. **bigint → decimal string.** `JSON.stringify` THROWS on a bigint, so every
 *     chain-read amount has to cross this line converted. It is converted to a
 *     STRING, never to a `Number`: `totalAssets` / `totalShares` are uint256 and
 *     a `Number` silently loses precision past 2^53 — a wrong balance that looks
 *     right is exactly the failure mode this repo forbids.
 *  2. **Keep the envelope.** Routes forward `Wired<T>` UN-FLATTENED: a consumer
 *     must always be able to read `status` / `source` / `address` / `chainId` /
 *     `readAt`. These helpers only ever rewrite `data` — they never invent one,
 *     and they never turn an `unavailable` into a value.
 *  3. **Contain a throw.** The adapter is contractually total (it returns
 *     `unavailable` rather than throwing), but a route must not 500 the whole
 *     aggregate because one read broke its contract. `safeRead` degrades that
 *     single block and logs the cause server-side.
 *
 * The accepted type is STRUCTURAL (`WiredLike<T>`) rather than an import of
 * `Wired<T>`: dynavault is a client-safe module and this one is a route-only
 * concern. A `Wired<T>` is assignable to `WiredLike<T>` as-is — same shape, and
 * viem's `Address` (`0x${string}`) is a subtype of `string`. Same rationale as
 * `src/components/catalyst/wired-value.tsx`.
 */

/** Where a successful read came from. Mirrors `WiredSource` in dynavault. */
export type WiredJsonSource = "v2" | "legacy";

/**
 * Structural mirror of `Wired<T>`. `reason` is deliberately `string`, not a
 * closed union: the adapter owns the reason vocabulary and may grow it, and an
 * unknown reason must degrade honestly (see `WIRED_UNAVAILABLE_LABELS` in
 * `src/components/catalyst/wired-chip.tsx`) rather than break a route.
 */
export type WiredLike<T> =
  | {
      status: "wired";
      data: T;
      source: WiredJsonSource;
      address: string;
      chainId: number;
      readAt: string;
    }
  | { status: "unavailable"; reason: string; detail?: string };

/**
 * A read that threw instead of returning `unavailable` — i.e. the adapter broke
 * its own contract. Distinct from the adapter's `rpc_error` on purpose: this is
 * OUR bug, not the chain's, and conflating the two would hide it.
 */
export const READ_FAILED_REASON = "read_failed";

/**
 * The JSON-safe projection of `T`: every `bigint` becomes a decimal `string`,
 * recursively, through arrays, objects and unions (the naked `T` distributes).
 */
export type JsonSafe<T> = T extends bigint
  ? string
  : T extends string | number | boolean | null | undefined
    ? T
    : T extends readonly (infer E)[]
      ? JsonSafe<E>[]
      : T extends object
        ? { [K in keyof T]: JsonSafe<T[K]> }
        : never;

function convert(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();

  if (Array.isArray(value)) {
    // Widen away the implicit `any[]` that `Array.isArray` narrows to.
    const items: readonly unknown[] = value;
    return items.map((item) => convert(item));
  }

  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      out[key] = convert(inner);
    }
    return out;
  }

  return value;
}

/**
 * Recursively replaces every `bigint` with its decimal string form.
 *
 * The single assertion below is the serialisation boundary: `convert` is total
 * over the shapes `JsonSafe<T>` describes, but TypeScript cannot follow a
 * recursive `unknown`-walker back into a conditional type. Contained here so no
 * route needs one.
 */
export function toJsonSafe<T>(value: T): JsonSafe<T> {
  return convert(value) as JsonSafe<T>;
}

/** Builds an `unavailable` envelope. No value, ever — that is the whole point. */
export function unavailable<T = never>(
  reason: string,
  detail?: string,
): WiredLike<T> {
  return detail === undefined
    ? { status: "unavailable", reason }
    : { status: "unavailable", reason, detail };
}

/**
 * Rewrites `data` while preserving the provenance of the read. An `unavailable`
 * passes through untouched — a projection cannot manufacture a value.
 */
export function mapWired<T, U>(
  wired: WiredLike<T>,
  project: (data: T) => U,
): WiredLike<U> {
  if (wired.status === "unavailable") return wired;
  return { ...wired, data: project(wired.data) };
}

/** `mapWired` specialised to the JSON boundary. */
export function jsonWired<T>(wired: WiredLike<T>): WiredLike<JsonSafe<T>> {
  return mapWired(wired, toJsonSafe);
}

/**
 * Runs a chain read, converting a contract-breaking throw into an honest
 * `unavailable`.
 *
 * The error message is logged SERVER-SIDE ONLY and never placed in `detail`:
 * responses carry no exception text. (The `detail` the adapter itself sets is
 * part of its published contract — a short, capped diagnostic — and is
 * forwarded as-is.)
 */
export async function safeRead<T>(
  label: string,
  read: () => Promise<WiredLike<T>>,
): Promise<WiredLike<T>> {
  try {
    return await read();
  } catch (err) {
    logger.error(
      "chain read threw instead of returning an unavailable envelope",
      { label },
      err instanceof Error ? err : undefined,
    );
    return unavailable<T>(READ_FAILED_REASON);
  }
}
