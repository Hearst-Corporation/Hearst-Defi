// src/lib/chain/wired-json.ts
//
// The JSON boundary for `Wired<T>` (see ./dynavault). Two jobs, both narrow.
//
//  1. BigInt -> string. `NextResponse.json()` runs `JSON.stringify`, which
//     THROWS `TypeError: Do not know how to serialize a BigInt`. Every vault
//     read is a uint256 -> bigint, so NO vault route can return the adapter's
//     payload untouched. Strings are lossless: a uint256 does not fit in a JS
//     number and `Number(totalAssets)` silently rounds above 2^53 -- a wrong
//     TVL no test would catch. Clients re-hydrate with `BigInt(x)`.
//
//  2. Preserve the honesty envelope VERBATIM. `status` / `source` / `address` /
//     `chainId` / `readAt` / `reason` / `detail` pass through untouched so an
//     RPC outage stays distinguishable from an absence of data ON THE WIRE, not
//     merely in memory. This module never invents a value, never fills a
//     default, never collapses `unavailable` into `null` or `0`.
//
// This module declares no ABI, resolves no address, decodes no tuple --
// `dynavault.ts` stays the single passage point to the chain (its file-header
// contract). Pure serialization, safe to import from any route.

import type { Wired } from "./dynavault";

/**
 * A datum the contract does not expose at all.
 *
 * Distinct from `NOT_SUPPORTED_BY_LEGACY` (the OLD contract can't do it) and
 * from `REVERT` (a call was made and refused): here the v2.1 surface itself has
 * no such read, so no call was attempted. Declared in this shared wire contract
 * rather than in `dynavault.ts`, whose reason vocabulary describes outcomes of
 * reads it PERFORMS. `Wired.reason` is typed `string` precisely so a consumer
 * layer may add a motive without editing the adapter.
 *
 * NOTE for the UI agent: `WiredChip` does not know this motive yet, so it
 * renders as "Motif inconnu" + the raw string. That degradation is honest but
 * ugly -- add a label in `WIRED_UNAVAILABLE_LABELS` when convenient.
 */
export const REASON_NOT_EXPOSED_BY_CONTRACT = "not_exposed_by_contract";

/**
 * Deep bigint->string mapping of a payload type.
 *
 * Conditional order matters: the array branch MUST precede the general `object`
 * branch, otherwise arrays get mapped as records.
 */
export type JsonSafe<T> = T extends bigint
  ? string
  : T extends Date
    ? string
    : T extends readonly (infer U)[]
      ? readonly JsonSafe<U>[]
      : T extends object
        ? { readonly [K in keyof T]: JsonSafe<T[K]> }
        : T;

/** `Wired<T>` after serialization: shape-for-shape identical, bigints stringified. */
export type WiredJson<J> =
  | {
      status: "wired";
      data: J;
      source: "v2" | "legacy";
      address: string;
      chainId: number;
      readAt: string;
    }
  | { status: "unavailable"; reason: string; detail?: string };

/** The successful branch of a serialized read. */
export type WiredJsonOk<J> = Extract<WiredJson<J>, { status: "wired" }>;

/** The successful branch of an adapter read. */
export type WiredOk<T> = Extract<Wired<T>, { status: "wired" }>;

function convert(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(convert);
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
 * Deep-convert a payload to a JSON-safe shape.
 *
 * The single assertion below narrows `unknown` (what `convert` returns by
 * construction) to `JsonSafe<T>`, whose cases `convert` mirrors one for one.
 * TypeScript cannot prove a recursive structural rewrite. This is a direct
 * assertion from `unknown`, not an `as unknown as` laundering of an
 * incompatible type, and this is its only narrowing point.
 */
export function jsonSafe<T>(value: T): JsonSafe<T> {
  return convert(value) as JsonSafe<T>;
}

/** Build an `unavailable` wire payload. Never carries a value. */
export function unavailableJson<J>(
  reason: string,
  detail?: string,
): WiredJson<J> {
  return detail === undefined
    ? { status: "unavailable", reason }
    : { status: "unavailable", reason, detail };
}

/** Serialize an adapter read for the wire, envelope intact. */
export function serializeWired<T>(read: Wired<T>): WiredJson<JsonSafe<T>> {
  if (read.status === "unavailable") {
    return unavailableJson<JsonSafe<T>>(read.reason, read.detail);
  }
  return {
    status: "wired",
    data: jsonSafe(read.data),
    source: read.source,
    address: read.address,
    chainId: read.chainId,
    readAt: read.readAt,
  };
}

/**
 * Wire payload for a value DERIVED from a successful read, reusing that read's
 * provenance envelope.
 *
 * A derived number is not itself read from the chain, but it is computed from
 * data that was -- at that address, on that chain, at that instant. Reusing the
 * envelope is therefore truthful; fabricating a fresh `readAt` would not be.
 * A caller combining SEVERAL reads should override `readAt` with the OLDEST of
 * them: a derived value is only as fresh as its stalest input.
 */
export function derivedFrom<T, J>(source: WiredOk<T>, data: J): WiredJsonOk<J> {
  return {
    status: "wired",
    data,
    source: source.source,
    address: source.address,
    chainId: source.chainId,
    readAt: source.readAt,
  };
}
