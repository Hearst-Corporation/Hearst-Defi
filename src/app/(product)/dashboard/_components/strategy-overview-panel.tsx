// StrategyOverviewPanel — the analytical companion to the accumulation chart
// (Zone 2, right). A thick concentric health ring with a shield core on the
// left; four qualitative strategy signals + an overall verdict on the right.
//
// Honesty contract: this is a QUALITATIVE strategy read-out, not a return
// figure — no APY, no yield, no promise. Every signal maps to a discrete
// status ("Aligned" / "On track" / "Strong" / "Excellent"), and the panel
// carries its OWN simulated provenance badge in the header (per-card
// provenance, same pattern as OpsStatCard). The ring fraction is derived from
// the count of signals in a positive state — it is a composite indicator, not
// a measured percentage, and is labelled as such. With ZERO signals the panel
// never renders a verdict — it shows an honest "—" + "No strategy signals
// available." instead.

import { Card } from "@/components/catalyst/card";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";

export interface StrategySignal {
  readonly label: string;
  readonly status: string;
  /** Tone drives the dot + status colour. */
  readonly tone?: "positive" | "neutral" | "warn";
}

const DOT_TONE: Record<NonNullable<StrategySignal["tone"]>, string> = {
  positive: "var(--ct-accent)",
  neutral: "var(--ct-chart-neutral)",
  warn: "var(--ct-status-warning)",
};

const STATUS_TONE: Record<NonNullable<StrategySignal["tone"]>, string> = {
  positive: "ct-text-accent",
  neutral: "ct-text-muted",
  warn: "ct-text-strong",
};

interface StrategyOverviewPanelProps {
  signals: readonly StrategySignal[];
  /** Overall verdict headline, e.g. "Excellent". */
  verdict: string;
  /** One-line supporting statement under the verdict. */
  verdictDetail: string;
}

// Geometry for the concentric ring (viewBox 0 0 200 200).
const R_TRACK = 78;
const R_ARC = 78;
const C = 2 * Math.PI * R_ARC;

export function StrategyOverviewPanel({ signals, verdict, verdictDetail }: StrategyOverviewPanelProps) {
  const hasSignals = signals.length > 0;
  const positives = signals.filter((s) => (s.tone ?? "positive") === "positive").length;
  const fraction = hasSignals ? positives / signals.length : 0;
  const dashOffset = C * (1 - fraction);

  // Concentric decorative tick ring — 12 marks.
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const inner = 58;
    const outer = 64;
    return {
      x1: 100 + Math.cos(angle) * inner,
      y1: 100 + Math.sin(angle) * inner,
      x2: 100 + Math.cos(angle) * outer,
      y2: 100 + Math.sin(angle) * outer,
    };
  });

  return (
    <Card className="w-full h-full flex flex-col p-[var(--ct-space-5)] gap-[var(--ct-space-5)]">
      <div className="flex items-center justify-between gap-[var(--ct-space-2)]">
        <span className="ct-bento-label">Strategy overview</span>
        <ProvenanceBadge kind="simulated" variant="compact" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-[var(--ct-space-3)] min-w-0">
        {/* Concentric ring + shield */}
        <div className="dash-ring shrink-0" style={{ ["--ring-size" as string]: "150px" }} aria-hidden>
          <svg viewBox="0 0 200 200" role="presentation">
            {/* outer thin guide */}
            <circle className="dash-ring-track" cx="100" cy="100" r="92" strokeWidth="1" opacity="0.5" />
            {/* decorative ticks */}
            {ticks.map((t, i) => (
              <line key={i} className="dash-ring-tick" {...t} strokeWidth="1.5" />
            ))}
            {/* main track */}
            <circle className="dash-ring-track" cx="100" cy="100" r={R_TRACK} strokeWidth="7" />
            {/* value arc */}
            <circle
              className="dash-ring-arc"
              cx="100"
              cy="100"
              r={R_ARC}
              strokeWidth="7"
              strokeDasharray={C}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 100 100)"
            />
            {/* shield core */}
            <path
              className="dash-ring-shield"
              strokeWidth="1.5"
              d="M100 66 L124 76 V100 C124 116 113 128 100 134 C87 128 76 116 76 100 V76 Z"
            />
            <path
              d="M92 100 l6 6 12 -14"
              fill="none"
              stroke="var(--ct-accent)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Signals */}
        <ul className="flex-1 min-w-0 flex flex-col gap-[var(--ct-space-3)] m-0 p-0 list-none w-full">
          {signals.map((s) => {
            const tone = s.tone ?? "positive";
            return (
              <li key={s.label} className="flex items-center gap-[var(--ct-space-2_5)] min-w-0">
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: DOT_TONE[tone] }}
                />
                <span className="body-xs ct-text-muted flex-1 min-w-0 truncate">{s.label}</span>
                <span className={`body-xs font-medium ${STATUS_TONE[tone]}`}>{s.status}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Verdict — honest guard: no verdict without at least one signal. */}
      <div className="mt-auto pt-[var(--ct-space-4)] border-t border-[var(--ct-border-soft)] flex flex-col gap-[var(--ct-space-1)]">
        <span className="ct-metric-caption">Overall strategy health</span>
        {hasSignals ? (
          <>
            <span className="ct-text-accent text-[length:var(--ct-text-xl)] font-semibold leading-none">
              {verdict}
            </span>
            <span className="body-xs ct-text-muted">{verdictDetail}</span>
          </>
        ) : (
          <>
            <span className="ct-text-muted text-[length:var(--ct-text-xl)] font-semibold leading-none">—</span>
            <span className="body-xs ct-text-muted">No strategy signals available.</span>
          </>
        )}
      </div>
    </Card>
  );
}
