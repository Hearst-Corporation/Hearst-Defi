/**
 * Wire format helpers for the mining read routes.
 *
 * Two jobs, both about not lying and not crashing:
 *
 * 1. `jsonSafe` — viem decodes `uint256` as a **bigint**, and `JSON.stringify`
 *    THROWS on bigint ("Do not know how to serialize a BigInt"). A route that
 *    returns a chain read unfiltered would 500 the moment the chain answers —
 *    i.e. it would fail exactly when it finally works. This walks the value and
 *    renders bigints as decimal STRINGS (never `Number(...)`: a uint256 blows
 *    past Number.MAX_SAFE_INTEGER and would silently round).
 *
 *    It deliberately does NOT flatten: a `Wired<T>` envelope goes through with
 *    its `status` / `source` / `address` / `chainId` / `readAt` intact, because
 *    the envelope IS the provenance. Flattening it would strip the very thing
 *    that lets a caller tell "read from 0x… at 14:03" apart from "we have no
 *    idea".
 *
 * 2. `toBigInt` — the adapter is the single decoder, but whether it hands back a
 *    `bigint` or an already-stringified decimal is its business, not ours. This
 *    accepts either and returns `null` on anything else, so a shape change
 *    surfaces as an explicit `decode_error` rather than a NaN that quietly
 *    poisons a countdown.
 *
 * Pure: no I/O, no prisma, no env — hence no `server-only`.
 */

export type JsonSafe =
  | string
  | number
  | boolean
  | null
  | JsonSafe[]
  | { [key: string]: JsonSafe };

/**
 * Recursively render `value` as something `JSON.stringify` accepts.
 *
 * - `bigint`        → decimal string (lossless; `Number()` would not be)
 * - non-finite number → `null` (NaN/Infinity are not JSON; we blank them rather
 *   than emit a fabricated finite number)
 * - `undefined` keys → dropped, matching JSON.stringify's own behaviour
 * - functions/symbols → `null` (never expected here; blanked, not invented)
 */
export function jsonSafe(value: unknown): JsonSafe {
  if (value === null) return null;

  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  if (Array.isArray(value)) return value.map((item) => jsonSafe(item));

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const out: Record<string, JsonSafe> = {};
    for (const key of Object.keys(record)) {
      const item = record[key];
      if (item === undefined) continue;
      out[key] = jsonSafe(item);
    }
    return out;
  }

  return null;
}

/**
 * Coerce a chain-decoded numeric into a bigint, or `null` when the value is not
 * a whole non-negative number. Accepts `bigint` (viem's native decoding) and a
 * decimal `string` (an adapter that pre-serialises). Rejects everything else —
 * including floats, which a uint256 can never legitimately be.
 */
export function toBigInt(value: unknown): bigint | null {
  if (typeof value === "bigint") return value;

  if (typeof value === "number") {
    return Number.isSafeInteger(value) ? BigInt(value) : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return /^\d+$/.test(trimmed) ? BigInt(trimmed) : null;
  }

  return null;
}
