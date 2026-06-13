"use client";

import { AssumptionsList } from "@/components/scenario/assumptions-list";
import { BacktestChart } from "@/components/scenario/backtest-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";
import type { BacktestOutput } from "@/lib/engine/types";

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
        "relative admin-doc-stack--relaxed transition-opacity duration-[var(--ct-dur-fast)]",
        isPending && "pointer-events-none opacity-50",
      )}
      aria-busy={isPending}
    >
      {isPending && (
        <div className="pointer-events-none absolute inset-0 z-[var(--ct-z-overlay)] flex items-center justify-center rounded-lg ct-surface-2/60 backdrop-blur-sm">
          <span className="body-sm ct-text-body">Computing backtest…</span>
        </div>
      )}

      {/* ── Section 1: KPIs 2×2 grid ────────────────────────────────────── */}
      <div className="admin-doc-kpi-grid-2">
        {/* Total Return */}
        <Card>
          <div className="mb-2 admin-doc-inline-row admin-doc-inline-row--between">
            <p className="stat-label">Total Return</p>
            <ProvenanceBadge kind="estimated" />
          </div>
          <p
            className={cn(
              "stat-value",
              isPositive ? "ct-status-success" : "ct-status-danger",
            )}
          >
            {isPositive ? "+" : ""}
            {output.totalReturnPct.toFixed(1)}%
          </p>
          <p className="mt-1 body-xs ct-text-muted">
            {output.startDate} — {output.endDate}
          </p>
        </Card>

        {/* Max Drawdown */}
        <Card>
          <div className="mb-2 admin-doc-inline-row admin-doc-inline-row--between">
            <p className="stat-label">Max Drawdown</p>
            <ProvenanceBadge kind="estimated" />
          </div>
          <p className="stat-value ct-status-danger">
            -{output.maxDrawdownPct.toFixed(1)}%
          </p>
          <p className="mt-1 body-xs ct-text-muted">peak-to-trough</p>
        </Card>

        {/* Worst Month */}
        <Card>
          <div className="mb-2 admin-doc-inline-row admin-doc-inline-row--between">
            <p className="stat-label">Worst Month</p>
            <ProvenanceBadge kind="estimated" />
          </div>
          <p className="stat-value ct-status-warning">
            {output.worstMonthPct.toFixed(1)}%
          </p>
          <p className="mt-1 body-xs ct-text-muted">
            single-month floor
          </p>
        </Card>

        {/* Rebalances */}
        <Card>
          <div className="mb-2 admin-doc-inline-row admin-doc-inline-row--between">
            <p className="stat-label">Rebalances</p>
            <ProvenanceBadge kind="estimated" />
          </div>
          <p className="stat-value ct-text-primary">
            {output.numRebalances}
          </p>
          <p className="mt-1 body-xs ct-text-muted">
            mode triggers
          </p>
        </Card>
      </div>

      {/* ── Section 2: Monthly chart ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="mb-4">
          <CardTitle>Monthly Vault Value</CardTitle>
          <span className="stat-label">USDC</span>
        </CardHeader>
        <BacktestChart series={output.monthlySeries} />
      </Card>

      {/* ── Section 3: Hearst Rules badge ────────────────────────────────── */}
      <Card>
        <div className="admin-doc-inline-row admin-doc-inline-row--between admin-doc-inline-row--relaxed">
          <div>
            <p className="body-xs font-semibold ct-text-body mb-1">Rule Engine</p>
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
        <CardHeader className="mb-4">
          <CardTitle>Assumptions</CardTitle>
        </CardHeader>
        <AssumptionsList assumptions={output.assumptions} />
      </Card>

      {/* ── Disclaimer ───────────────────────────────────────────────────── */}
      <p className="border-t border-[var(--ct-border-soft)] pt-4 body-xs italic ct-text-muted">
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
