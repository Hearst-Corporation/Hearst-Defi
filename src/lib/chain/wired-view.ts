// src/lib/chain/wired-view.ts
//
// The glue between the chain adapter and the blue UI primitives: the
// `Wired<T>` -> `WiredLike<T>` bridge, the bigint -> display formatters, and the
// two projections that let a surface pull ONE field out of ONE grouped read.
//
// Two shapes describe the same thing on purpose:
//   • `Wired<T>`     (src/lib/chain/dynavault.ts)      -> `.data`, + address/chainId/readAt
//   • `WiredLike<T>` (src/components/catalyst/wired-value.tsx) -> `.value`, structural
// `WiredValue` keeps its props structural so it stays mountable from any surface
// without importing a `server-only` module. `toWiredLike` is the one-line bridge.
//
// ── Why the projections live here ────────────────────────────────────────────
// `readVaultCore()` returns the whole core in ONE grouped RPC read. A surface
// that wants six rows out of it needs to turn `Wired<VaultCore>` into six
// `Wired<field>` WITHOUT losing the honesty envelope (source/address/chainId/
// readAt on success, reason/detail on failure). That is `selectWired`. It is a
// pure re-shaping of a read this module did not perform — it declares no ABI,
// resolves no address and calls no chain, so `dynavault.ts` stays the single
// passage point (its file-header contract).
//
// This module is PURE: no `server-only`, no I/O. It imports only constants and
// types, so it is safe on both sides.

import type { WiredLike } from "@/components/catalyst/wired-value";

import {
  UNAVAILABLE_REASONS,
  USDC_DECIMALS,
  type Wired,
} from "./dynavault";
import { REASON_NOT_EXPOSED_BY_CONTRACT } from "./wired-json";

/** Adapter read → UI prop. Drops address/chainId/readAt, keeps status/source/reason. */
export function toWiredLike<T>(read: Wired<T>): WiredLike<T> {
  if (read.status === "wired") {
    return { status: "wired", value: read.data, source: read.source };
  }
  return { status: "unavailable", reason: read.reason };
}

// ---------------------------------------------------------------------------
// Projections — one grouped read, many rows
// ---------------------------------------------------------------------------

/**
 * Pull one ALWAYS-PRESENT field out of a grouped read.
 *
 * The envelope is carried through verbatim: a wired core yields a wired field
 * with the same source/address/chainId/readAt; an unavailable core yields the
 * SAME reason and detail on every field it fed. That last part matters — six
 * rows sharing one read must all say "Lecture chaîne indisponible" when the RPC
 * is down, and none of them may quietly become "no data".
 */
export function selectWired<T, U>(
  read: Wired<T>,
  select: (data: T) => U,
): Wired<U> {
  if (read.status === "unavailable") return read;
  return { ...read, data: select(read.data) };
}

/**
 * Pull a field the contract MAY NOT EXPOSE AT ALL (`null` in `VaultCore`).
 *
 * `null` never means `false` and never means zero — it means "this contract has
 * no such view". So a null is rendered as `unavailable` with a reason, never as
 * a value. The reason is derived from WHICH contract answered, because the two
 * cases are genuinely different facts:
 *
 *   • source "legacy" -> `not_supported_by_legacy`
 *     e.g. `tvlCap`: the deployed HearstYieldVault has no cap function.
 *     This is the ONLY case that can render today, and this reason is the one
 *     `WiredChip` already labels ("Non supporté par le contrat actuel").
 *   • source "v2" -> `not_exposed_by_contract`
 *     e.g. `paused`: the v2.1 spec declares no `paused()`. It is NOT aliased
 *     onto `isCurtailed()` — a mining halt is not a deposit pause, and
 *     conflating them would be inventing data.
 *
 * No `detail` is attached: this is a support boundary known UP FRONT, not the
 * after-the-fact diagnostic of a failed call. Surfaces explain it with a `note`.
 */
export function selectExposed<T, U>(
  read: Wired<T>,
  select: (data: T) => U | null,
): Wired<U> {
  if (read.status === "unavailable") return read;

  const value = select(read.data);
  if (value === null) {
    return {
      status: "unavailable",
      reason:
        read.source === "legacy"
          ? UNAVAILABLE_REASONS.NOT_SUPPORTED_BY_LEGACY
          : REASON_NOT_EXPOSED_BY_CONTRACT,
    };
  }

  return { ...read, data: value };
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

/**
 * Thousands separators, done by hand.
 *
 * Deliberately NOT `toLocaleString`: these strings are rendered on the server and
 * hydrated on the client, and a locale-dependent formatter is a classic
 * server/client mismatch. This is deterministic everywhere.
 */
function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Render a raw fixed-point integer as a decimal string.
 *
 * TRUNCATES, never rounds — a NAV must not be nudged upward by a formatter.
 * Matches the legacy `formatNavPerShare` behaviour (1_000_000n → "1.0000").
 */
function formatScaled(
  raw: bigint,
  decimals: number,
  fractionDigits: number,
): string {
  const negative = raw < 0n;
  const abs = negative ? -raw : raw;
  const scale = 10n ** BigInt(decimals);
  const sign = negative ? "-" : "";
  const whole = groupThousands((abs / scale).toString());

  const digits = Math.min(fractionDigits, decimals);
  if (digits <= 0) return `${sign}${whole}`;

  const frac = (abs % scale)
    .toString()
    .padStart(decimals, "0")
    .slice(0, digits);
  return `${sign}${whole}.${frac}`;
}

/** Raw 6-decimal USDC → "12.00" (no unit). */
export function formatUsdcRaw(raw: bigint, fractionDigits = 2): string {
  return formatScaled(raw, USDC_DECIMALS, fractionDigits);
}

/** Raw 6-decimal USDC → "12.00 USDC". */
export function formatUsdcAmount(raw: bigint): string {
  return `${formatUsdcRaw(raw)} USDC`;
}

/** Raw 6-decimal USDC → "1.0000 USDC / share" (4 dp, truncated). */
export function formatNavPerShare(raw: bigint): string {
  return `${formatUsdcRaw(raw, 4)} USDC / share`;
}

/**
 * Raw share units → human count. `decimals` is passed in (not assumed) because
 * the v2 share unit is unconfirmed — see `SHARE_DECIMALS` in the adapter.
 */
export function formatShareAmount(raw: bigint, decimals: number): string {
  return formatScaled(raw, decimals, 2);
}
