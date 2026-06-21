import {
  deriveScenarioImpact,
  deriveScenarioProjection,
} from "@/components/scenario/ptai-derive";
import { Badge } from "@/components/ui/badge";
import { PanelStatus } from "@/components/ui/panel-status";
import type { BtcTriggerKind, ScenarioOutput } from "@/lib/engine/types";

type BadgeVariant = "success" | "warning" | "danger" | "default" | "brand";

export interface RebalancingAction {
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

export function deriveActions(output: ScenarioOutput): RebalancingAction[] {
  const actions: RebalancingAction[] = [];
  const projection = deriveScenarioProjection(output);
  const impact = deriveScenarioImpact(output);

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

function ActionsBody({ actions }: { actions: RebalancingAction[] }) {
  if (actions.length === 0) {
    return (
      <div className="admin-doc-inline-row admin-doc-inline-row--actions">
        <span
          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--ct-status-success)]"
          aria-hidden
        />
        <PanelStatus message="No rebalancing actions triggered — vault allocation is within target bands." />
      </div>
    );
  }

  return (
    <ol className="admin-doc-stack--actions">
      {actions.map((action, idx) => (
        <li
          key={action.ruleId}
          className="border-l-2 border-[var(--ct-border-soft)] pl-[var(--ct-space-6)] py-[var(--ct-space-1)]"
        >
          <div className="admin-doc-inline-row admin-doc-inline-row--start flex-nowrap">
            <span
              className={
                "stat-label flex h-6 w-6 shrink-0 items-center justify-center rounded-full tabular-nums " +
                (action.armed
                  ? "bg-[var(--ct-accent)] ct-text-on-accent"
                  : "ct-surface-3 ct-text-muted")
              }
              aria-hidden
            >
              {idx + 1}
            </span>
            <div className="admin-doc-stack admin-doc-stack--tight flex-1 min-w-0">
              <div className="admin-doc-inline-row admin-doc-inline-row--between">
                <span className="body-sm font-semibold ct-text-primary">
                  {action.label}
                </span>
                <Badge variant={action.variant} className="ml-auto">
                  {action.ruleId}
                </Badge>
              </div>
              <p className="mt-[var(--ct-space-2)] body-xs ct-text-muted">{action.trigger}</p>
              <p className="mt-[var(--ct-space-1)] body-sm ct-text-body">{action.action}</p>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

interface RebalancingActionsProps {
  output: ScenarioOutput;
  className?: string;
}

/** Compact rebalancing list — parent panel owns header + disclaimer. */
export function RebalancingActions({ output, className }: RebalancingActionsProps) {
  return (
    <div className={className}>
      <ActionsBody actions={deriveActions(output)} />
    </div>
  );
}
