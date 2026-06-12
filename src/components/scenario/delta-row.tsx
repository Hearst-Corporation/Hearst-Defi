import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";
import {
  apyRangeMidpoint,
  deltaToneClass,
  formatSignedFixed,
} from "@/lib/scenario/compare-metrics";
import type { ScenarioOutput } from "@/lib/engine/types";

// ── Delta row for compare mode ────────────────────────────────────────────────
//
// Shows B − A for: ΔAPY midpoint, ΔRisk score, ΔMining margin.
// "Better" direction is annotated per metric:
//   - ΔAPY: positive = better (green), negative = worse (red)
//   - ΔRisk: negative = better (green), positive = worse (red)
//   - ΔMining margin: positive = better (green), negative = worse (red)

interface DeltaMetric {
  label: string;
  delta: number;
  unit: string;
  betterWhenPositive: boolean;
  precision: number;
}

function buildDeltas(a: ScenarioOutput, b: ScenarioOutput): DeltaMetric[] {
  return [
    {
      label: "ΔAPY",
      delta: apyRangeMidpoint(b) - apyRangeMidpoint(a),
      unit: "pts",
      betterWhenPositive: true,
      precision: 2,
    },
    {
      label: "ΔRisk Score",
      delta: b.risk_score - a.risk_score,
      unit: "/100",
      betterWhenPositive: false,
      precision: 1,
    },
    {
      label: "ΔMining Margin",
      delta: b.mining_margin_score - a.mining_margin_score,
      unit: "/100",
      betterWhenPositive: true,
      precision: 1,
    },
  ];
}

function toneClass(metric: DeltaMetric): string {
  const threshold = metric.label === "ΔAPY" ? 0.05 : 0.5;
  return deltaToneClass(metric.delta, metric.betterWhenPositive, threshold);
}

function formatDelta(metric: DeltaMetric): string {
  return formatSignedFixed(metric.delta, metric.precision);
}

// ── Component ─────────────────────────────────────────────────────────────────

interface DeltaRowProps {
  a: ScenarioOutput;
  b: ScenarioOutput;
}

export function DeltaRow({ a, b }: DeltaRowProps) {
  const metrics = buildDeltas(a, b);

  return (
    <div
      className={cn(
        "glass-panel px-6 py-4",
      )}
      aria-label="Scenario B vs A delta metrics"
    >
      <div className="mb-3 admin-doc-inline-row admin-doc-inline-row--between admin-doc-inline-row--relaxed">
        <p className="eyebrow">B vs A — Delta</p>
        <ProvenanceBadge kind="estimated" />
      </div>

      <div className="scenario-compare-delta__grid">
        {metrics.map((m) => (
          <div key={m.label} className="admin-doc-stack--compact">
            <span className="stat-label">{m.label}</span>
            <span
              className={cn(
                "mono text-2xl font-extrabold tabular-nums",
                toneClass(m),
              )}
            >
              {formatDelta(m)}
            </span>
            <span className="ct-text-micro-size ct-text-muted">
              {m.unit} · midpoint
            </span>
          </div>
        ))}
      </div>

      <p className="mt-3 ct-text-micro-size ct-text-muted">
        Green = Scenario B is better. Red = Scenario B is worse. All deltas are midpoint estimates.
        <span className="ml-1 font-semibold ct-text-body">
          Not guaranteed.
        </span>
      </p>
    </div>
  );
}
