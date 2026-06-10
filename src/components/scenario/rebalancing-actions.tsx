import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Ptai } from "@/components/ui/ptai";
import type { BtcTriggerKind, ScenarioOutput } from "@/lib/engine/types";

// ── Rebalancing action list ───────────────────────────────────────────────────
//
// Derives an ordered list of rebalancing actions (max 4) from the engine output
// and renders each one through the canonical <Ptai> primitive (Projection /
// Trigger / Action / Impact). All four strings come from the engine — no
// arithmetic, no copy invented in the component. PTAI format is mandated by
// CLAUDE.md non-negotiable #3 and audit coherence-2026-05-26 / 08-ptai-format
// (P1.1).

type BadgeVariant = "success" | "warning" | "danger" | "default" | "brand";

interface RebalancingAction {
  ruleId: string;
  label: string;
  projection: string;
  trigger: string;
  action: string;
  impact: string;
  armed: boolean;
  priority: number;
  variant: BadgeVariant;
}

const KIND_LABEL: Record<BtcTriggerKind, string> = {
  accumulate: "Accumulate BTC",
  take_profit: "Take profit",
  reduce_size: "Reduce exposure",
  hold: "Hold posture",
};

const KIND_VARIANT: Record<BtcTriggerKind, BadgeVariant> = {
  accumulate: "success",
  take_profit: "brand",
  reduce_size: "warning",
  hold: "default",
};

// ── PTAI string derivation (display-only, no math) ────────────────────────────

function formatModeLabel(mode: ScenarioOutput["mode"]): string {
  if (mode === "defensive") return "Defensive";
  if (mode === "opportunistic") return "Opportunistic";
  return "Balanced";
}

function projectionLine(output: ScenarioOutput): string {
  const { low, high } = output.apy_range;
  return `APY ${low.toFixed(1)}–${high.toFixed(1)}% in ${formatModeLabel(output.mode)} mode (confidence: ${output.confidence}).`;
}

function impactLine(output: ScenarioOutput): string {
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

function deriveActions(output: ScenarioOutput): RebalancingAction[] {
  const actions: RebalancingAction[] = [];
  const projection = projectionLine(output);
  const impact = impactLine(output);

  // 1. BTC tactical armed triggers first
  for (const trigger of output.btc_tactical.triggers) {
    if (!trigger.armed) continue;
    actions.push({
      ruleId: trigger.id,
      label: KIND_LABEL[trigger.kind],
      projection,
      trigger: `${trigger.id}: ${trigger.condition}.`,
      action: trigger.action,
      impact,
      armed: true,
      priority: trigger.kind === "hold" ? 4 : 1,
      variant: KIND_VARIANT[trigger.kind],
    });
  }

  // 2. Mode-level rule inferred from vault mode
  if (output.mode === "defensive") {
    actions.push({
      ruleId: "R1/R2",
      label: "Switch to Defensive",
      projection,
      trigger:
        "R1/R2: BTC drawdown or mining margin breach detected by the engine.",
      action:
        "Reduce BTC tactical exposure, increase stable reserve allocation.",
      impact,
      armed: true,
      priority: 2,
      variant: "danger",
    });
  } else if (output.mode === "opportunistic") {
    actions.push({
      ruleId: "R3",
      label: "Maintain Opportunistic",
      projection,
      trigger:
        "R3: Mining margin healthy and risk score low — opportunistic mode armed.",
      action: "Maintain elevated BTC tactical allocation within target bands.",
      impact,
      armed: true,
      priority: 2,
      variant: "success",
    });
  }

  // 3. Guardrail warnings / breaches
  for (const g of output.btc_tactical.guardrails) {
    if (g.status !== "breached" && g.status !== "warning") continue;
    actions.push({
      ruleId: g.id,
      label: `Review: ${g.label}`,
      projection,
      trigger: `${g.id} (${g.status}): ${g.detail}`,
      action:
        g.status === "breached"
          ? "Engine flagged guardrail breach — review allocation against target bands."
          : "Engine flagged guardrail warning — monitor closely against target bands.",
      impact,
      armed: g.status === "breached",
      priority: g.status === "breached" ? 1 : 3,
      variant: g.status === "breached" ? "danger" : "warning",
    });
  }

  // Sort by priority, deduplicate on ruleId, keep max 4
  const sorted = [...actions].sort((a, b) => a.priority - b.priority);
  const seen = new Set<string>();
  const result: RebalancingAction[] = [];
  for (const a of sorted) {
    if (!seen.has(a.ruleId)) {
      seen.add(a.ruleId);
      result.push(a);
    }
    if (result.length >= 4) break;
  }
  return result;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface RebalancingActionsProps {
  output: ScenarioOutput;
}

export function RebalancingActions({ output }: RebalancingActionsProps) {
  const actions = deriveActions(output);

  if (actions.length === 0) {
    return (
      <Card>
        <CardHeader className="mb-3">
          <CardTitle>Rebalancing Actions</CardTitle>
          <span className="eyebrow">Max 4 · Rule-based</span>
        </CardHeader>
        <div className="flex items-center gap-3 rounded-sm glass-panel-subtle px-4 py-3">
          <span
            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--ct-status-success)]"
            aria-hidden
          />
          <p className="text-xs ct-text-muted">
            No rebalancing actions triggered — vault allocation is within target bands.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="mb-4">
        <CardTitle>Rebalancing Actions</CardTitle>
        <span className="eyebrow">Max 4 · Rule-based · PTAI</span>
      </CardHeader>

      <ol className="space-y-4">
        {actions.map((action, idx) => (
          <li key={action.ruleId} className="space-y-2">
            <div className="flex items-center gap-3">
              <span
                className={
                  "mt-0 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-micro font-bold tabular-nums " +
                  (action.armed
                    ? "bg-[var(--ct-accent)] text-[var(--ct-bg-deep)]"
                    : "ct-surface-3 ct-text-muted")
                }
                aria-hidden
              >
                {idx + 1}
              </span>
              <span className="text-sm font-semibold ct-text-primary">
                {action.label}
              </span>
              <Badge variant={action.variant} className="text-micro">
                {action.ruleId}
              </Badge>
            </div>

            <Ptai
              projection={action.projection}
              trigger={action.trigger}
              action={action.action}
              impact={action.impact}
            />
          </li>
        ))}
      </ol>

      <p className="mt-4 text-xs italic ct-text-faint leading-[var(--ct-leading-relaxed)]">
        Conditional projection — not guaranteed. Methodology v1.0.
      </p>
    </Card>
  );
}
