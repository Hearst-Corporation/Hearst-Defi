// src/lib/backend/resolved-view.ts
//
// The bridge from the backend's `Resolved<T>` to the Series 1 surfaces'
// `Wired<T>`, so a screen can switch its SOURCE from the frontend's own chain
// adapter to hearst-connect-backend without rewriting its presentation layer
// (`Series1WiredRow`, `wiredMetric`, `selectWired`, the formatters — all keep
// working unchanged).
//
// ── Why a bridge instead of re-typing the screens ────────────────────────────
// The two shapes describe the same idea with different vocabulary:
//
//   Wired<T>     status: "wired" | "unavailable"   + reason: string
//   Resolved<T>  status: LIVE|STALE|PARTIAL|UNAVAILABLE|NOT_CONFIGURED|
//                        NOT_SUPPORTED|PERMISSION_DENIED                + reason?
//
// `Wired.reason` is deliberately typed as an open `string` (see dynavault.ts's
// note: "a consumer layer may add a motive without editing the adapter"), which
// is exactly the extension point this module uses.
//
// ── The honesty rule this module enforces ───────────────────────────────────
// A `Resolved` that carries no value becomes `unavailable` with a reason that
// PRESERVES WHICH KIND OF ABSENCE it was. It never becomes a zero, never a
// fixture, never an empty array posing as "no activity". The backend's own
// NOT_CONFIGURED ("there is honestly nothing there yet") stays distinguishable
// from an outage — and both stay distinguishable from a thrown BackendError
// ("we couldn't reach the data"), which never reaches this module at all: an
// unreachable backend throws in the client and is rendered as an ERROR block by
// the caller. This function only ever sees a response the backend DID send.
//
// This module is PURE: no I/O, no `server-only`, no chain code. Safe on both
// sides of the boundary.

import type { Resolved, DataStatus } from "./contracts";

/** The structural subset of `Wired<T>` this module produces. Declared
 *  structurally rather than imported from `@/lib/chain/dynavault` on purpose:
 *  that module is `server-only` and carries the whole viem/ABI surface, which
 *  this pure mapper must not drag into a client bundle. Assignable to
 *  `Wired<T>` field-for-field. */
export type WiredFromBackend<T> =
  | {
      readonly status: "wired";
      readonly data: T;
      readonly source: "v2";
      readonly address: string;
      readonly chainId: number;
      readonly readAt: string;
    }
  | { readonly status: "unavailable"; readonly reason: string; readonly detail?: string };

/** Runtime facts a backend response carries alongside its `Resolved` blocks —
 *  needed to fill `Wired`'s address/chainId provenance fields. */
export interface BackendRuntimeLike {
  readonly chainId: number | null;
  readonly contractAddress: string | null;
}

/**
 * Reason vocabulary for absences that came FROM the backend.
 *
 * Namespaced `backend:` so an operator reading a UI chip can tell a backend-side
 * absence from the frontend adapter's own `rpc_error`/`not_deployed`. The two
 * paths coexist during the cutover, and collapsing their vocabularies would
 * make the migration untraceable at exactly the moment it matters.
 */
export const BACKEND_REASONS = {
  /** The backend answered honestly: nothing is configured/deployed yet. */
  NOT_CONFIGURED: "backend:not_configured",
  /** The contract/service does not expose this fact at all. */
  NOT_SUPPORTED: "backend:not_supported",
  /** Authenticated, but this caller may not read this surface (admin-only). */
  PERMISSION_DENIED: "backend:permission_denied",
  /** The backend tried and could not get the value (upstream read failed). */
  UNAVAILABLE: "backend:unavailable",
  /** Status said a value should exist, but `value` was null — a contract
   *  violation on the backend's side. Surfaced, never papered over. */
  MISSING_VALUE: "backend:missing_value",
} as const;

/** Maps a value-less `DataStatus` to this module's reason vocabulary. */
function reasonForStatus(status: DataStatus): string {
  switch (status) {
    case "NOT_CONFIGURED":
      return BACKEND_REASONS.NOT_CONFIGURED;
    case "NOT_SUPPORTED":
      return BACKEND_REASONS.NOT_SUPPORTED;
    case "PERMISSION_DENIED":
      return BACKEND_REASONS.PERMISSION_DENIED;
    case "UNAVAILABLE":
      return BACKEND_REASONS.UNAVAILABLE;
    case "LIVE":
    case "STALE":
    case "PARTIAL":
      // Reached only when the backend sent a value-bearing status with a null
      // value. That is the backend contradicting itself; say so rather than
      // inventing a plausible motive.
      return BACKEND_REASONS.MISSING_VALUE;
  }
}

/**
 * `Resolved<T>` → `Wired<T>`.
 *
 * STALE and PARTIAL map to `wired`: the value is real and measured, merely old
 * or incomplete — hiding it would be its own dishonesty. The freshness stamp
 * rides along in `readAt`, and the backend's `meta.status` still reports the
 * composite worst-field-first status for callers that surface it.
 *
 * A null value ALWAYS yields `unavailable`, whatever the status claimed.
 */
export function resolvedToWired<T>(
  block: Resolved<T>,
  runtime: BackendRuntimeLike,
): WiredFromBackend<T> {
  if (block.value == null) {
    const reason = block.reason ? `${reasonForStatus(block.status)}:${block.reason}` : reasonForStatus(block.status);
    return { status: "unavailable", reason };
  }

  return {
    status: "wired",
    data: block.value,
    source: "v2",
    address: runtime.contractAddress ?? "",
    chainId: runtime.chainId ?? 0,
    readAt: block.freshness.asOf ?? new Date().toISOString(),
  };
}

/**
 * Contract mode as an investor-facing sentence, from what the BACKEND reports
 * actually answered — not from the frontend's own env.
 *
 * "v2-fork" is deliberately named as a preprod environment rather than dressed
 * up as production. The figures it serves live on an ephemeral fork: real
 * numbers from a real contract, but not a durable chain and not a record an
 * investor should read as their position. Saying "fork" on the surface is the
 * honest version of that.
 */
export function vaultModeLabel(runtime: { readonly mode: string }): string {
  switch (runtime.mode) {
    case "v2-mainnet":
      return "PermissionedDynaVault v2.1";
    case "v2-testnet":
      return "PermissionedDynaVault v2.1 · testnet";
    case "v2-fork":
      return "PermissionedDynaVault v2.1 · preprod fork";
    case "not_configured":
      return "Contract not configured";
    default:
      return runtime.mode;
  }
}

/**
 * Project one field out of a bridged read, keeping the envelope verbatim.
 *
 * The `Resolved` analogue of `selectWired`: one backend call feeds many rows,
 * and when it is unavailable every row must say so with the SAME reason rather
 * than some of them quietly becoming "no data".
 */
export function selectFromWired<T, U>(
  read: WiredFromBackend<T>,
  select: (data: T) => U,
): WiredFromBackend<U> {
  if (read.status === "unavailable") return read;
  return { ...read, data: select(read.data) };
}

/**
 * Project a field the contract MAY NOT EXPOSE (null inside a present value).
 *
 * The `Resolved` analogue of `selectExposed`: a null field is "this contract
 * has no such view", never zero and never false. `pocketAssets` on
 * `/api/v1/rwa-vault` is the canonical case — always null by contract limit
 * (VAULT_SPEC_V2.1.md §5 vs §3), and rendering it as 0 would state that a
 * pocket holds nothing.
 */
export function selectExposedFromWired<T, U>(
  read: WiredFromBackend<T>,
  select: (data: T) => U | null | undefined,
): WiredFromBackend<U> {
  if (read.status === "unavailable") return read;

  const value = select(read.data);
  if (value == null) {
    return { status: "unavailable", reason: BACKEND_REASONS.NOT_SUPPORTED };
  }
  return { ...read, data: value };
}
