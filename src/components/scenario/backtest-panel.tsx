"use client";

import { useState } from "react";

import { BacktestChart } from "@/components/scenario/backtest-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";
import type { BacktestOutput } from "@/lib/engine/types";

interface BacktestPanelProps {
  output: BacktestOutput;
  isPending: boolean;
}

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Parses an assumption string. If it contains `=`, splits on the first `=` and
 * returns { key, value }. Otherwise returns the full string as value.
 */
function parseAssumption(line: string): { key: string | null; value: string } {
  const eqIdx = line.indexOf("=");
  if (eqIdx === -1) return { key: null, value: line };
  const key = line.slice(0, eqIdx).trim().replace(/_/g, " ");
  const value = line.slice(eqIdx + 1).trim();
  return { key, value };
}

function AssumptionsList({ assumptions }: { assumptions: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const THRESHOLD = 5;
  const shouldTruncate = assumptions.length > THRESHOLD;
  const visible =
    shouldTruncate && !expanded ? assumptions.slice(0, THRESHOLD) : assumptions;

  return (
    <div>
      <ul className="space-y-2">
        {visible.map((line, i) => {
          const { key, value } = parseAssumption(line);
          return (
            <li key={i} className="flex items-start gap-2 body-sm">
              <span
                className="mt-0.5 shrink-0 text-micro ct-text-strong"
                aria-hidden
              >
                ▸
              </span>
              {key !== null ? (
                <span>
                  <span className="font-semibold capitalize ct-text-body">
                    {key}
                  </span>
                  <span className="ct-text-muted">: </span>
                  <span className="mono ct-text-body">
                    {value}
                  </span>
                </span>
              ) : (
                <span className="ct-text-body">{value}</span>
              )}
            </li>
          );
        })}
      </ul>
      {shouldTruncate && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((x) => !x)}
          className="mt-3 ct-text-strong hover:ct-text-strong"
        >
          {expanded
            ? "Show less"
            : `Show ${assumptions.length - THRESHOLD} more`}
        </Button>
      )}
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────────

export function BacktestPanel({ output, isPending }: BacktestPanelProps) {
  const isPositive = output.totalReturnPct >= 0;

  return (
    <div
      className={cn(
        "relative space-y-4 transition-opacity duration-(--ct-dur-fast)",
        isPending && "pointer-events-none opacity-50",
      )}
      aria-busy={isPending}
    >
      {isPending && (
        <div className="pointer-events-none absolute inset-0 z-(--ct-z-overlay) flex items-center justify-center rounded-lg ct-surface-2/60 backdrop-blur-sm">
          <span className="body-sm ct-text-body">Computing backtest…</span>
        </div>
      )}

      {/* ── Section 1: KPIs 2×2 grid ────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        {/* Total Return */}
        <Card>
          <div className="mb-2 flex items-center justify-between gap-2">
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
          <div className="mb-2 flex items-center justify-between gap-2">
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
          <div className="mb-2 flex items-center justify-between gap-2">
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
          <div className="mb-2 flex items-center justify-between gap-2">
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
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="stat-label mb-1">Rule Engine</p>
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
      <p className="border-t border-(--ct-border-soft) pt-4 body-xs italic ct-text-muted">
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
