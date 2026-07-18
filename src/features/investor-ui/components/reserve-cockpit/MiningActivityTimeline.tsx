// src/features/investor-ui/components/reserve-cockpit/MiningActivityTimeline.tsx
//
// MiningActivityTimeline — a frieze of the fleet's operating state over time:
// active (hashing) vs curtailed (powered down, usually to protect the reserve or
// respond to grid/economics). Curtailment is a deliberate reserve operation in
// the Series 1 narrative, so it is surfaced honestly — never hidden as downtime.
//
// Pure SVG band chart with per-interval `<title>` for accessible hover. Each
// interval's width is its share of the total span. Token-only; null/empty →
// DataUnavailable, no fabricated intervals.

import type { HcSourceStatus } from "@/components/dataviz/his";

import { ReserveBlockFrame } from "./block-frame";
import { DataUnavailable } from "../states/data-states";

export type FleetState = "active" | "curtailed";

export interface MiningInterval {
  readonly label: string;
  readonly state: FleetState;
  /** Relative duration weight of this interval (e.g. days, hours). Must be > 0. */
  readonly durationWeight: number;
}

export interface MiningActivityTimelineProps {
  intervals: readonly MiningInterval[] | null;
  source?: HcSourceStatus;
  className?: string;
}

const STATE_STYLE: Record<FleetState, { fill: string; label: string }> = {
  active: { fill: "var(--ct-accent)", label: "Active" },
  curtailed: { fill: "var(--ct-status-warning)", label: "Curtailed" },
};

export function MiningActivityTimeline({
  intervals,
  source = "attested",
  className,
}: MiningActivityTimelineProps) {
  const clean = (intervals ?? []).filter(
    (iv) => Number.isFinite(iv.durationWeight) && iv.durationWeight > 0,
  );

  if (clean.length === 0) {
    return (
      <ReserveBlockFrame title="Mining Activity" source={source} className={className}>
        <DataUnavailable
          label="Mining activity"
          detail="No fleet operating history has resolved yet."
        />
      </ReserveBlockFrame>
    );
  }

  const total = clean.reduce((s, iv) => s + iv.durationWeight, 0) || 1;
  const activeWeight = clean
    .filter((iv) => iv.state === "active")
    .reduce((s, iv) => s + iv.durationWeight, 0);
  const uptimePct = (activeWeight / total) * 100;

  return (
    <ReserveBlockFrame
      title="Mining Activity"
      source={source}
      subtitle="Fleet active vs curtailed over the reporting window"
      headerRight={
        <span
          className="rounded-[var(--ct-radius-full)] border border-[var(--ct-border-accent)] bg-[var(--ct-surface-inset)] px-[var(--ct-space-3)] py-[var(--ct-space-1)]"
          style={{
            fontSize: "var(--ct-text-2xs)",
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            color: "var(--ct-accent-strong)",
          }}
        >
          {uptimePct.toFixed(0)}% active
        </span>
      }
      className={className}
      footnote="Curtailment is a deliberate operating decision (grid, economics, or reserve protection), not an outage. Values are attested from operations logs."
    >
      <div className="flex flex-col gap-[var(--ct-space-3)]">
        {/* Segmented frieze — each interval sized to its share of the window. */}
        <div
          role="img"
          aria-label="Fleet active and curtailed intervals across the reporting window"
          className="flex w-full overflow-hidden rounded-[var(--ct-radius-full)] bg-[var(--ct-surface-inset)]"
          style={{ height: 16 }}
        >
          {clean.map((iv, i) => {
            const pct = (iv.durationWeight / total) * 100;
            const st = STATE_STYLE[iv.state];
            return (
              <span
                key={`${iv.label}-${i}`}
                title={`${iv.label}: ${st.label} (${pct.toFixed(1)}% of window)`}
                data-fleet-state={iv.state}
                style={{
                  width: `${pct}%`,
                  background: st.fill,
                  opacity: iv.state === "curtailed" ? 0.85 : 1,
                }}
              />
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-[var(--ct-space-4)]">
          <LegendSwatch color={STATE_STYLE.active.fill} label="Active" />
          <LegendSwatch color={STATE_STYLE.curtailed.fill} label="Curtailed" />
        </div>
      </div>
    </ReserveBlockFrame>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="flex items-center gap-[var(--ct-space-2)]"
      style={{ fontSize: "var(--ct-text-nano)", color: "var(--ct-text-muted)" }}
    >
      <span
        aria-hidden="true"
        style={{ width: 10, height: 10, borderRadius: "var(--ct-radius-xs)", background: color }}
      />
      {label}
    </span>
  );
}
