import type { ScenarioOutput } from "@/lib/engine/types";

function formatModeLabel(mode: ScenarioOutput["mode"]): string {
  if (mode === "defensive") return "Defensive";
  if (mode === "opportunistic") return "Opportunistic";
  return "Balanced";
}

export function deriveScenarioProjection(output: ScenarioOutput): string {
  const { low, high } = output.apy_range;
  return `APY ${low.toFixed(1)}–${high.toFixed(1)}% in ${formatModeLabel(output.mode)} mode (confidence: ${output.confidence}).`;
}

export function deriveScenarioTrigger(output: ScenarioOutput): string {
  const armed = output.btc_tactical.triggers.find((t) => t.armed);
  if (!armed) {
    return "No active rule triggered — vault holds current posture.";
  }
  return `${armed.id}: ${armed.condition}.`;
}

export function deriveScenarioAction(output: ScenarioOutput): string {
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

export function deriveScenarioImpact(output: ScenarioOutput): string {
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
