// Series1MiningRegister — the operational read behind the accumulation.
//
// Mining figures are kept SEPARATE from the investor outcome (they are an
// operational report, not a return), and every row keeps its own provenance.
// Rows are drawn by Series1DashboardRow, whose separators are per-row borders
// rather than a `gap-px` grid gutter (canon F2).

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { surfaceNoticeWell } from "@/lib/ui/surface-classes";

import {
  Series1DashboardCard,
  Series1DashboardCardHeader,
  Series1DashboardRow,
} from "./Series1DashboardSection";
import { Series1DataState } from "./Series1DataState";

export interface Series1RegisterRow {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  muted?: boolean;
}

/**
 * Telemetry gate for the mining register.
 *
 * Per `docs/series1/endpoint-to-ui-matrix.md`, `getMiningFromBackend` is
 * admin-only and NOT READY (the keeper cron has been stale since 2026-07-07).
 * When the mining telemetry is not `live`, the investor register must not
 * render empty or half-populated rows dressed up as a report — it must state,
 * once, in muted type, WHY the figures are withheld.
 *
 * The state vocabulary is the investor-facing projection of the source health
 * (`live | stale | not_configured | unavailable`); it never carries a
 * fabricated figure, only a reason. No economic metric (cost-per-BTC,
 * break-even hashprice, reserve build rate) is ever synthesised here — the
 * matrix forbids inventing series the backend does not provide.
 */
export interface Series1MiningGate {
  state: "live" | "stale" | "not_configured" | "unavailable";
  /** Optional investor-worded context. Never leaks ops vocabulary. */
  detail?: string;
}

/** The one-line motive shown for a non-live gate. Reason only, never a value. */
const GATE_MOTIVE: Record<Exclude<Series1MiningGate["state"], "live">, string> = {
  stale: "Mining telemetry is stale",
  not_configured: "Mining telemetry is not configured",
  unavailable: "Mining telemetry is unavailable",
};

/** Plain-language explanation of why the figures are withheld — no numbers. */
const GATE_DETAIL: Record<Exclude<Series1MiningGate["state"], "live">, string> = {
  stale:
    "the keeper has not reported recently, so these operational figures are held back rather than shown out of date",
  not_configured:
    "mining reporting is not yet enabled on this network, so no operational figures are available",
  unavailable:
    "the mining read did not answer, so no operational figures can be shown right now",
};

export function Series1MiningRegister({
  title,
  caption,
  rows,
  motive,
  gate,
  trailing,
  className,
}: {
  title: string;
  caption?: ReactNode;
  rows: readonly Series1RegisterRow[];
  /** Stated ONCE for the whole card (canon §5), not per row. */
  motive: string | null;
  /**
   * Telemetry gate. When `state !== "live"` (or a non-live state is passed),
   * the register replaces its figure rows with an honest GATED notice instead
   * of empty lines. Omitted or `{ state: "live" }` → unchanged behaviour
   * (rows render as before), so existing call sites are unaffected.
   */
  gate?: Series1MiningGate;
  trailing?: ReactNode;
  className?: string;
}) {
  // Narrow to the non-live state so the reason/detail maps are indexed by an
  // exact key (TS: "live" is excluded from the record keys).
  const gatedState: Exclude<Series1MiningGate["state"], "live"> | null =
    gate != null && gate.state !== "live" ? gate.state : null;

  return (
    <Series1DashboardCard variant="quiet" className={className}>
      <Series1DashboardCardHeader title={title} caption={caption} trailing={trailing} />
      {gatedState != null ? (
        // GATED state — no figures. A recessed, hairline-topped well (never a
        // second card, never red) states the reason once, in muted type. This
        // is deliberately NOT a row grid: printing "Not reported" against a
        // dozen labels would read as a broken report; withholding the whole
        // band and saying why reads as honest.
        <div
          role="status"
          data-mining-gate={gatedState}
          className={cn(
            surfaceNoticeWell,
            "flex flex-1 flex-col gap-[var(--ct-space-2)] px-[var(--ct-space-5)] py-[var(--ct-space-4)]",
          )}
        >
          <Series1DataState
            motive={GATE_MOTIVE[gatedState]}
            detail={gate?.detail ?? GATE_DETAIL[gatedState]}
          />
        </div>
      ) : (
        <>
          <div className="flex flex-1 flex-col">
            {rows.map((row) => (
              <Series1DashboardRow
                key={row.label}
                label={row.label}
                value={row.value}
                hint={row.hint}
                muted={row.muted}
              />
            ))}
          </div>
          {motive ? (
            <div className={cn(surfaceNoticeWell, "px-[var(--ct-space-5)] py-[var(--ct-space-3)]")}>
              <Series1DataState motive={motive} />
            </div>
          ) : null}
        </>
      )}
    </Series1DashboardCard>
  );
}
