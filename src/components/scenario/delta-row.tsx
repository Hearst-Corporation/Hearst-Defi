import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";
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
  const apyMidA = (a.apy_range.low + a.apy_range.high) / 2;
  const apyMidB = (b.apy_range.low + b.apy_range.high) / 2;

  return [
    {
      label: "ΔAPY",
      delta: apyMidB - apyMidA,
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
  const THRESHOLD = 0.05;
  const isBetter = metric.betterWhenPositive
    ? metric.delta > THRESHOLD
    : metric.delta < -THRESHOLD;
  const isWorse = metric.betterWhenPositive
    ? metric.delta < -THRESHOLD
    : metric.delta > THRESHOLD;

  if (isBetter) return "ct-status-success";
  if (isWorse) return "ct-status-danger";
  return "ct-text-body";
}

function formatDelta(metric: DeltaMetric): string {
  const abs = Math.abs(metric.delta).toFixed(metric.precision);
  if (metric.delta > 0.005) return `+${abs}`;
  if (metric.delta < -0.005) return `−${abs}`;
  return `±${abs}`;
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
      <div className="mb-3 flex items-center justify-between gap-4">
        <p className="eyebrow">B vs A — Delta</p>
        <ProvenanceBadge kind="estimated" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="flex flex-col gap-1">
            <span className="stat-label text-micro">{m.label}</span>
            <span
              className={cn(
                "mono text-2xl font-extrabold tabular-nums",
                toneClass(m),
              )}
            >
              {formatDelta(m)}
            </span>
            <span className="text-micro ct-text-muted">
              {m.unit} · midpoint
            </span>
          </div>
        ))}
      </div>

      <p className="mt-3 text-micro ct-text-muted">
        Green = Scenario B is better. Red = Scenario B is worse. All deltas are midpoint estimates.
        <span className="ml-1 font-semibold ct-text-body">
          Not guaranteed.
        </span>
      </p>
    </div>
  );
}
