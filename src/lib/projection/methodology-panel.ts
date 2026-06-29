/**
 * Methodology panel view-model — pure, read-only.
 *
 * Surfaces the CONFIGURED company assumptions + methodology version that an admin
 * MUST review before running a projection study. It only READS the in-code
 * assumptions accessor (`getProjectionCompanyAssumptions`) and formats them for
 * display — no LLM, no fetch, no DB, no Date.now(), no business number invented.
 *
 * The values shown are exactly the ones the engine already uses (markup,
 * revenue-share, borrow APR, fees, BTC scenario band). They are tagged with their
 * provenance status (CONFIGURED) so the UI can be honest: these are code-baked
 * hypotheses, not validated/live/investor-facing numbers.
 */

import {
  getProjectionCompanyAssumptions,
  type ProjectionAssumptionStatus,
} from "@/lib/projection/company-assumptions";

/** The methodology version the projection pipeline currently pins (v1.0). */
export const PROJECTION_METHODOLOGY_VERSION = "v1.0";

export interface MethodologyAssumptionRow {
  label: string;
  /** Pre-formatted display value (e.g. "15%", "-20% / +40% / +120%"). */
  value: string;
  status: ProjectionAssumptionStatus;
}

export interface MethodologyPanel {
  methodologyVersion: string;
  /** Provenance of the whole assumption set (CONFIGURED today). */
  status: ProjectionAssumptionStatus;
  /** Where the assumptions are sourced from (code path today). */
  source: string;
  rows: MethodologyAssumptionRow[];
  /** Honest notes carried verbatim from the assumptions metadata. */
  notes: string[];
}

function pct(n: number): string {
  return `${n}%`;
}

/**
 * Build the methodology panel view-model from the in-code assumptions.
 *
 * Pure: deterministic, no I/O. Safe to call from a Server Component render.
 */
export function buildMethodologyPanel(): MethodologyPanel {
  const a = getProjectionCompanyAssumptions();
  const status = a.metadata.status;

  const rows: MethodologyAssumptionRow[] = [
    { label: "Machine-cost markup", value: pct(a.markupPct), status },
    { label: "Revenue share", value: pct(a.revenueSharePct), status },
    { label: "Borrow APR (USDC vs BTC)", value: pct(a.borrowAprPct), status },
    { label: "Management + performance fees", value: pct(a.feePct), status },
    {
      label: "BTC scenario band (bear / base / bull)",
      value: `${pct(a.btcScenarios.bearPct)} / ${pct(a.btcScenarios.basePct)} / ${pct(a.btcScenarios.bullPct)}`,
      status,
    },
  ];

  return {
    methodologyVersion: PROJECTION_METHODOLOGY_VERSION,
    status,
    source: a.metadata.source,
    rows,
    notes: a.metadata.notes,
  };
}
