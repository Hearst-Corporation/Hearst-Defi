import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Ptai } from "@/components/ui/ptai";
import type { ScenarioOutput } from "@/lib/engine/types";

// ── PTAI string derivation (display-only, no math) ────────────────────────────
//
// All numbers come from the engine output. This module only formats them into
// the 4 PTAI lines required by spec 02-scenario-lab.mdx and
// spec 07-rebalancing-rules.mdx. No arithmetic, no branching on market logic.

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
  // Find the first armed rule-based trigger from btc_tactical and map it to a
  // rebalancing rule ID from spec 07-rebalancing-rules.mdx.
  const armed = output.btc_tactical.triggers.find((t) => t.armed);
  if (!armed) {
    return "No active rule triggered — vault holds current posture.";
  }

  const ruleMap: Record<string, string> = {
    "R-BTC-1": "R-BTC-1",
    "R-BTC-2": "R-BTC-2",
    "R-BTC-3": "R-BTC-3",
    "R-BTC-4": "R-BTC-4",
  };
  const ruleId = ruleMap[armed.id] ?? armed.id;
  return `${ruleId}: ${armed.condition}.`;
}

function deriveAction(output: ScenarioOutput): string {
  const armed = output.btc_tactical.triggers.find((t) => t.armed);
  const lines: string[] = [];

  if (armed && armed.kind !== "hold") {
    lines.push(armed.action);
  }

  // Summarise allocation posture concisely (top 2 buckets by pct).
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

// ── Component ─────────────────────────────────────────────────────────────────

interface PtaiBlockProps {
  output: ScenarioOutput;
  /**
   * "card" → standalone Card with title (default).
   * "embedded" → the bare Ptai primitive, for placement inside a parent
   * decision panel that already owns the section label.
   */
  variant?: "card" | "embedded";
  className?: string;
}

export function PtaiBlock({
  output,
  variant = "card",
  className,
}: PtaiBlockProps) {
  const projection = deriveProjection(output);
  const trigger = deriveTrigger(output);
  const action = deriveAction(output);
  const impact = deriveImpact(output);

  const ptai = (
    <Ptai
      projection={projection}
      trigger={trigger}
      action={action}
      impact={impact}
      className={className}
    />
  );

  if (variant === "embedded") return ptai;

  return (
    <Card>
      <CardHeader className="mb-4">
        <CardTitle>Projection · Trigger · Action · Impact</CardTitle>
      </CardHeader>
      {ptai}
    </Card>
  );
}
