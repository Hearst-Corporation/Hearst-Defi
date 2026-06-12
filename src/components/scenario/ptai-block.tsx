import { Ptai } from "@/components/ui/ptai";
import type { ScenarioOutput } from "@/lib/engine/types";

// ── PTAI string derivation (display-only, no math) ────────────────────────────

function deriveProjection(output: ScenarioOutput): string {
  const { low, high } = output.apy_range;
  const modeLabel =
    output.mode === "defensive"
      ? "Defensive"
      : output.mode === "opportunistic"
        ? "Opportunistic"
        : "Balanced";
  return `APY ${low.toFixed(1)}–${high.toFixed(1)}% in ${modeLabel} mode (confidence: ${output.confidence}).`;
}

function deriveTrigger(output: ScenarioOutput): string {
  const armed = output.btc_tactical.triggers.find((t) => t.armed);
  if (!armed) {
    return "No active rule triggered — vault holds current posture.";
  }
  return `${armed.id}: ${armed.condition}.`;
}

function deriveAction(output: ScenarioOutput): string {
  const armed = output.btc_tactical.triggers.find((t) => t.armed);
  const lines: string[] = [];

  if (armed && armed.kind !== "hold") {
    lines.push(armed.action);
  }

  const sorted = [...output.allocations].sort((a, b) => b.pct - a.pct);
  const top = sorted.slice(0, 2);
  const bucketLabel: Record<string, string> = {
    mining: "Mining",
    btc_tactical: "BTC tactical",
    usdc_base: "USDC base",
    stable_reserve: "Stable reserve",
  };
  const allocationLine = top
    .map((a) => `${bucketLabel[a.bucket] ?? a.bucket} ${a.pct}%`)
    .join(", ");
  lines.push(`Allocation posture: ${allocationLine} (top 2 buckets).`);

  return lines.join(" ");
}

function deriveImpact(output: ScenarioOutput): string {
  const { low, high } = output.apy_range;
  const stressed = output.stressed_apy.toFixed(1);
  const riskLabel =
    output.risk_score > 70
      ? "elevated"
      : output.risk_score > 40
        ? "moderate"
        : "low";
  return `APY range ${low.toFixed(1)}–${high.toFixed(1)}%; stressed floor ${stressed}%. Risk score ${output.risk_score.toFixed(0)}/100 (${riskLabel}).`;
}

interface PtaiBlockProps {
  output: ScenarioOutput;
  className?: string;
}

/** Scenario-level PTAI — embedded inside DecisionPanel (parent owns the label). */
export function PtaiBlock({ output, className }: PtaiBlockProps) {
  return (
    <Ptai
      projection={deriveProjection(output)}
      trigger={deriveTrigger(output)}
      action={deriveAction(output)}
      impact={deriveImpact(output)}
      className={className}
    />
  );
}
