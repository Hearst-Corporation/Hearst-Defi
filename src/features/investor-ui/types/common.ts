// src/features/investor-ui/types/common.ts
//
// Shared presentation-layer primitives for the Investor UI V2 refonte. These
// are PRESENTATION types — independent of Prisma, viem/ABI, and the GPU1
// backend's own `Resolved<T>` wire shape (hearst-connect-backend/src/domain). They exist
// so every screen (Dashboard/BTC/Mining/Profile) renders honesty the same
// way: every block on screen carries its own status, never a fabricated
// number, never a silent fallback to "LIVE".
//
// Mirrors (does not import) the GPU1 DashboardDTO shape documented in
// hearst-connect-backend/src/domain/index.ts (~L18-41, ~L300-331) so the day the real
// endpoint is wired, the field names line up. If hearst-connect-backend's DataStatus /
// SourceProvenance ever diverge from this file, this file wins for anything
// UI-facing — it is allowed a couple of EXTRA statuses ("FIXTURE", "ERROR")
// that the backend DTO doesn't need because a fixture/error never crosses
// that boundary.

/**
 * Presentation-level data status. Superset of the GPU1 DTO's `DataStatus`
 * (LIVE/STALE/PARTIAL/UNAVAILABLE/NOT_CONFIGURED are shared 1:1) plus two
 * UI-only additions:
 *  - "FIXTURE": explicitly fixture-sourced data (dev/demo) — must NEVER be
 *    confused with "LIVE" in a screenshot or a bug report.
 *  - "ERROR": the data source itself threw / failed to resolve (distinct
 *    from "UNAVAILABLE", which means "the source answered honestly with
 *    nothing yet", e.g. contract not deployed).
 */
export type DataStatus =
  | "LIVE"
  | "FIXTURE"
  | "STALE"
  | "PARTIAL"
  | "UNAVAILABLE"
  | "NOT_CONFIGURED"
  | "ERROR";

/**
 * Wrapper around a single presentation block. Every screen composes SEVERAL
 * of these (one per logical block: identity, position, mining, etc.) — never
 * one flat object for the whole screen — because each block can independently
 * be LIVE while another is NOT_CONFIGURED or STALE.
 */
export type ResolvedViewModel<T> = {
  readonly status: DataStatus;
  readonly value: T | null;
  /** Where this came from — e.g. "fixture", "gpu1:/api/v1/dashboard", "db". */
  readonly provenance?: string;
  /** Human-readable freshness, e.g. "as of 2 min ago" or "unavailable". */
  readonly freshness?: string;
  /** ISO timestamp this block/DTO was assembled — the "as of" the UI shows. */
  readonly generatedAt?: string;
  /** Machine reason when value is null / status is not LIVE-ish. */
  readonly error?: { code: string; message: string } | null;
};

/** Convenience constructor — keeps fixtures/data-sources from hand-rolling
 *  the same 5 fields with inconsistent defaults. */
export function resolved<T>(
  status: DataStatus,
  value: T | null,
  extra?: Omit<ResolvedViewModel<T>, "status" | "value">,
): ResolvedViewModel<T> {
  return { status, value, ...extra };
}
