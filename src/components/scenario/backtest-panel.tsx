"use client";

import { AssumptionsList } from "@/components/scenario/assumptions-list";
import { BacktestChart } from "@/components/scenario/backtest-chart";
import { ScenarioPendingOverlay } from "@/components/scenario/scenario-feedback";
import { BentoBadge as Badge } from "@/components/catalyst/bento-badge";
import { Card, CardHeader, CardTitle } from "@/components/catalyst/card";
import { Metric } from "@/components/catalyst/metric";
import { cn } from "@/lib/cn";
import type { BacktestOutput } from "@/lib/engine/types";

import { MetricGrid } from "@/components/catalyst/nested-panel";

interface BacktestPanelProps {
  output: BacktestOutput;
  isPending: boolean;
}

// ── main component ─────────────────────────────────────────────────────────────

export function BacktestPanel({ output, isPending }: BacktestPanelProps) {
  const isPositive = output.totalReturnPct >= 0;

  return (
    <div
      className={cn(
        "relative admin-doc-stack--relaxed transition-opacity ease-[var(--ct-ease)] duration-[var(--ct-dur-fast)]",
        isPending && "pointer-events-none opacity-[var(--ct-opacity-50)]",
      )}
      aria-busy={isPending}
    >
      {isPending ? <ScenarioPendingOverlay message="Computing backtest…" /> : null}

      {/* ── Section 1: KPIs 2×2 grid ────────────────────────────────────── */}
      {/* NOTE: Total Return / Max Drawdown / Worst Month previously carried
          success/danger/warning value coloring. `Metric` renders values neutral
          (ct-text-strong) and can't express per-value status color, so the
          semantic +/- sign is kept in the value but the color cue is dropped. */}
      <MetricGrid columns={2} className="mb-[var(--ct-space-4)]">
        <Metric
          variant="plain"
          label="Total Return"
          value={`${isPositive ? "+" : ""}${output.totalReturnPct.toFixed(1)}%`}
          provenance="estimated"
          sublabel={`${output.startDate} — ${output.endDate}`}
        />
        <Metric
          variant="plain"
          label="Max Drawdown"
          value={`-${output.maxDrawdownPct.toFixed(1)}%`}
          provenance="estimated"
          sublabel="peak-to-trough"
        />
        <Metric
          variant="plain"
          label="Worst Month"
          value={`${output.worstMonthPct.toFixed(1)}%`}
          provenance="estimated"
          sublabel="single-month floor"
        />
        <Metric
          variant="plain"
          label="Rebalances"
          value={output.numRebalances}
          provenance="estimated"
          sublabel="mode triggers"
        />
      </MetricGrid>

      {/* ── Section 2: Monthly chart ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="mb-[var(--ct-space-4)]">
          <CardTitle>Monthly Vault Value</CardTitle>
          <span className="stat-label">USDC</span>
        </CardHeader>
        <BacktestChart series={output.monthlySeries} />
      </Card>

      {/* ── Section 3: Hearst Rules badge ────────────────────────────────── */}
      <Card>
        <div className="admin-doc-inline-row admin-doc-inline-row--between admin-doc-inline-row--relaxed">
          <div>
            <p className="body-xs font-semibold ct-text-body mb-[var(--ct-space-1)]">Rule Engine</p>
            <p className="body-xs ct-text-muted">
              Rule-based rebalancing enabled
            </p>
          </div>
          <Badge variant={output.hearstRulesMode ? "success" : "default"}>
            {output.hearstRulesMode ? "Rules Active" : "Rules Off"}
          </Badge>
        </div>
      </Card>

      {/* ── Section 4: Assumptions ───────────────────────────────────────── */}
      <Card>
        <CardHeader className="mb-[var(--ct-space-4)]">
          <CardTitle>Assumptions</CardTitle>
        </CardHeader>
        <AssumptionsList assumptions={output.assumptions} />
      </Card>

      {/* ── Disclaimer ───────────────────────────────────────────────────── */}
      <p className="border-t border-[var(--ct-border-soft)] pt-[var(--ct-space-4)] body-xs italic ct-text-muted">
        <span className="font-semibold not-italic ct-text-body">
          Not guaranteed.
        </span>{" "}
        Historical simulation based on stated assumptions. Past performance does
        not predict future returns. Methodology v1.0. This is not a projection
        of future performance.
      </p>
    </div>
  );
}
