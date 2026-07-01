"use client";

/**
 * Sensitivity Analysis, Trigger Analytics, and Event Timeline panels
 * for Strategy Lab. Extracted from strategy-data-lab.tsx so that W4
 * can own the main file without merge conflicts.
 *
 * Exports: SensitivityPanel, TriggerAnalyticsPanel, EventTimeline
 */

import { BarChart, Bar, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Metric } from "@/components/catalyst/metric";
import { cn } from "@/lib/cn";
import type {
  SensitivityAnalyzer,
  BacktestRunner,
  TriggerAnalyticsReport,
} from "@/lib/strategy-data-lab";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bpsToPercent(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

function formatBtc(delta: number): string {
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(4)} BTC`;
}

function formatUsdc(delta: number): string {
  return `${delta >= 0 ? "+" : ""}$${Math.abs(delta).toLocaleString("en-US", { maximumFractionDigits: 0 })} USDC`;
}

// ---------------------------------------------------------------------------
// 1. SensitivityPanel
// ---------------------------------------------------------------------------

type SensitivityReport = ReturnType<InstanceType<typeof SensitivityAnalyzer>["run"]>;

/** Tornado chart + detail table for a SensitivityReport. */
export function SensitivityPanel({ report }: { report: SensitivityReport }) {
  const { rows, topRoiDrivers, topRiskDrivers } = report;

  // Sort rows descending by roiImpactBps for the tornado.
  const sorted = [...rows].sort((a, b) => b.roiImpactBps - a.roiImpactBps);

  const chartData = sorted.map((r) => ({
    variable: r.variable,
    impact: r.roiImpactBps,
    riskImpact: r.riskImpactBps,
  }));

  const chartConfig: ChartConfig = {
    impact: {
      label: "ROI Impact (bps)",
      color: "var(--ct-chart-series-1)",
    },
  };

  const topRoi = topRoiDrivers[0] ?? "—";
  const topRisk = topRiskDrivers[0] ?? "—";

  return (
    <div className="flex flex-col gap-(--ct-space-4)">
      {/* Header — same grammar as the other lab mode bodies */}
      <div className="flex flex-col gap-(--ct-space-1)">
        <span className="ct-section-label ct-text-strong">Sensitivity Analysis</span>
        <p className="text-[length:var(--ct-text-xs)] ct-text-tertiary">
          ROI sensitivity ranked by impact — which inputs move the needle most
        </p>
      </div>

      {/* Tornado chart */}
      {chartData.length > 0 ? (
        <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
          >
            <XAxis
              type="number"
              tick={{ fill: "var(--ct-text-muted)", fontSize: 11 }}
              tickFormatter={(v: number) => `${v}bps`}
            />
            <YAxis
              type="category"
              dataKey="variable"
              width={120}
              tick={{ fill: "var(--ct-text-body)", fontSize: 11 }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value: unknown) => [`${String(value)} bps`, "ROI Impact"]}
                />
              }
            />
            <Bar
              dataKey="impact"
              fill="var(--ct-chart-series-1)"
              radius={[0, 3, 3, 0]}
            />
          </BarChart>
        </ChartContainer>
      ) : (
        <div className="text-[length:var(--ct-text-sm)] ct-text-faint italic">
          No sensitivity data available.
        </div>
      )}

      {/* Detail table */}
      {sorted.length > 0 && (
        <div className="overflow-x-auto rounded-[var(--ct-radius-md)] border border-[var(--ct-border-soft)]">
          <table className="w-full text-[length:var(--ct-text-sm)]">
            <thead>
              <tr className="border-b border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)]">
                <th className="p-(--ct-space-3) text-left font-medium ct-text-muted">
                  Variable
                </th>
                <th className="p-(--ct-space-3) text-right font-medium ct-text-muted">
                  ROI Impact (bps)
                </th>
                <th className="p-(--ct-space-3) text-right font-medium ct-text-muted">
                  Risk Impact (bps)
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, idx) => (
                <tr
                  key={row.variable}
                  className={cn(
                    "border-b border-[var(--ct-border-soft)] last:border-0",
                    idx === 0 && "bg-[var(--ct-surface-inset)]",
                  )}
                >
                  <td className="p-(--ct-space-3) font-mono text-[length:var(--ct-text-xs)] ct-text-body">
                    {row.variable}
                  </td>
                  <td
                    className={cn(
                      "p-(--ct-space-3) text-right font-semibold",
                      idx === 0 ? "ct-text-accent" : "ct-text-strong",
                    )}
                  >
                    {row.roiImpactBps.toLocaleString()}
                  </td>
                  <td className="p-(--ct-space-3) text-right ct-text-body">
                    {row.riskImpactBps.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary footer */}
      <p className="text-[length:var(--ct-text-2xs)] ct-text-muted border-t border-[var(--ct-border-soft)] pt-(--ct-space-2)">
        Top ROI driver:{" "}
        <span className="ct-text-accent font-medium">{topRoi}</span>
        {" · "}
        Top risk driver:{" "}
        <span className="text-[color:var(--ct-status-warning)] font-medium">{topRisk}</span>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. TriggerAnalyticsPanel
// ---------------------------------------------------------------------------

type BacktestReport = ReturnType<InstanceType<typeof BacktestRunner>["run"]>;

/** Trigger analytics panel: liquidation/repurchase frequency + per-run table. */
export function TriggerAnalyticsPanel({
  report,
  insights,
}: {
  report: BacktestReport;
  /** Rule-level analytics for the base run (analyzeTriggers) — optional. */
  insights?: TriggerAnalyticsReport | null;
}) {
  const { runs, summary } = report;

  const liqFreqPct = (summary.liquidationFrequencyBps / 100).toFixed(1);
  const repFreqPct = (summary.repurchaseFrequencyBps / 100).toFixed(1);

  return (
    <div className="flex flex-col gap-(--ct-space-4)">
      {/* Header — same grammar as the other lab mode bodies */}
      <div className="flex flex-col gap-(--ct-space-1)">
        <span className="ct-section-label ct-text-strong">Trigger Analytics</span>
        <p className="text-[length:var(--ct-text-xs)] ct-text-tertiary">
          Liquidation and repurchase trigger frequency across market regimes
        </p>
      </div>

      {/* Rule-level insights — base run, deterministic */}
      {insights ? (
        <div className="grid grid-cols-1 gap-(--ct-space-3) sm:grid-cols-3">
          <Metric
            variant="nested"
            label="Most frequent trigger"
            value={
              // Persisted rule ids are composite "<strategyId>::<ruleId>" —
              // show only the human-scale rule part.
              insights.mostFrequentTriggerRuleId?.split("::").pop() ?? "None"
            }
            sublabel="base run · rule id"
          />
          <Metric
            variant="nested"
            label="First liquidation"
            value={
              insights.firstLiquidationMonth !== null
                ? `Month ${insights.firstLiquidationMonth}`
                : "None"
            }
            sublabel={`${insights.liquidationCount} liquidation event${insights.liquidationCount === 1 ? "" : "s"}`}
          />
          <Metric
            variant="nested"
            label="Typical sequence"
            value={insights.typicalSequence || "No events"}
            sublabel={`${insights.repurchaseCount} repurchase event${insights.repurchaseCount === 1 ? "" : "s"}`}
          />
        </div>
      ) : null}

      {/* Global KPIs */}
      <div className="grid grid-cols-2 gap-(--ct-space-3)">
        <div className="flex flex-col gap-(--ct-space-1) rounded-[var(--ct-radius-md)] border border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)] p-(--ct-space-4)">
          <span className="text-[length:var(--ct-text-2xs)] font-medium uppercase tracking-wide ct-text-muted">
            Liquidation freq.
          </span>
          <span className="text-[length:var(--ct-text-2xl)] font-semibold leading-tight text-[color:var(--ct-status-danger)]">
            {liqFreqPct}%
          </span>
          <span className="text-[length:var(--ct-text-xs)] ct-text-faint">
            of runs with ≥1 liquidation
          </span>
        </div>
        <div className="flex flex-col gap-(--ct-space-1) rounded-[var(--ct-radius-md)] border border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)] p-(--ct-space-4)">
          <span className="text-[length:var(--ct-text-2xs)] font-medium uppercase tracking-wide ct-text-muted">
            Repurchase freq.
          </span>
          <span className="text-[length:var(--ct-text-2xl)] font-semibold leading-tight ct-text-accent">
            {repFreqPct}%
          </span>
          <span className="text-[length:var(--ct-text-xs)] ct-text-faint">
            of runs with ≥1 repurchase
          </span>
        </div>
      </div>

      {/* Per-run table */}
      {runs.length > 0 ? (
        <div className="overflow-x-auto rounded-[var(--ct-radius-md)] border border-[var(--ct-border-soft)]">
          <table className="w-full text-[length:var(--ct-text-sm)]">
            <thead>
              <tr className="border-b border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)]">
                <th className="p-(--ct-space-3) text-left font-medium ct-text-muted">
                  Regime
                </th>
                <th className="p-(--ct-space-3) text-left font-medium ct-text-muted">
                  Scenario
                </th>
                <th className="p-(--ct-space-3) text-right font-medium ct-text-muted">
                  Liq Events
                </th>
                <th className="p-(--ct-space-3) text-right font-medium ct-text-muted">
                  Rep Events
                </th>
                <th className="p-(--ct-space-3) text-right font-medium ct-text-muted">
                  Max LTV
                </th>
                <th className="p-(--ct-space-3) text-right font-medium ct-text-muted">
                  Min Liq Dist
                </th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run, idx) => {
                const maxLtvBps = run.metrics.maxLtvBps;
                const minDist = run.metrics.minLiquidationDistanceBps;
                const isHighLtv = maxLtvBps > 7000;

                return (
                  <tr
                    key={idx}
                    className="border-b border-[var(--ct-border-soft)] last:border-0"
                  >
                    <td className="p-(--ct-space-3) ct-text-body">
                      {run.regimeLabel}
                    </td>
                    <td className="p-(--ct-space-3) font-mono text-[length:var(--ct-text-xs)] ct-text-muted">
                      {run.scenario}
                    </td>
                    <td className="p-(--ct-space-3) text-right">
                      <span
                        className={cn(
                          "font-medium",
                          run.report.liquidationCount > 0
                            ? "text-[color:var(--ct-status-danger)]"
                            : "ct-text-body",
                        )}
                      >
                        {run.report.liquidationCount}
                      </span>
                    </td>
                    <td className="p-(--ct-space-3) text-right">
                      <span
                        className={cn(
                          "font-medium",
                          run.report.repurchaseCount > 0
                            ? "ct-text-accent"
                            : "ct-text-body",
                        )}
                      >
                        {run.report.repurchaseCount}
                      </span>
                    </td>
                    <td className="p-(--ct-space-3) text-right">
                      <span
                        className={cn(
                          "font-medium",
                          isHighLtv
                            ? "text-[color:var(--ct-status-danger)]"
                            : "ct-text-body",
                        )}
                      >
                        {bpsToPercent(maxLtvBps)}
                      </span>
                    </td>
                    <td className="p-(--ct-space-3) text-right ct-text-body">
                      {minDist.toLocaleString()} bps
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-[length:var(--ct-text-sm)] ct-text-faint italic">
          No backtest runs available.
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-[length:var(--ct-text-2xs)] ct-text-faint border-t border-[var(--ct-border-soft)] pt-(--ct-space-2)">
        Trigger counts reflect the deterministic rule engine — conditional on assumptions.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. EventTimeline
// ---------------------------------------------------------------------------

type TimelineEventType = "LIQUIDATE" | "REPURCHASE" | "WATCH";

interface TimelineEvent {
  month: number;
  type: TimelineEventType;
  btcDelta?: number;
  usdcDelta?: number;
}

const EVENT_DOT_CLASS: Record<TimelineEventType, string> = {
  LIQUIDATE: "bg-[var(--ct-status-danger)]",
  REPURCHASE: "bg-[var(--ct-accent)]",
  WATCH: "bg-[var(--ct-status-warning)]",
};

const EVENT_LABEL_CLASS: Record<TimelineEventType, string> = {
  LIQUIDATE: "text-[color:var(--ct-status-danger)]",
  REPURCHASE: "ct-text-accent",
  WATCH: "text-[color:var(--ct-status-warning)]",
};

/** Vertical event timeline for projection event sequences. */
export function EventTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-[length:var(--ct-text-sm)] ct-text-faint italic">
        No events in this projection.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-(--ct-space-2)">
      {events.map((event, idx) => {
        const isLast = idx === events.length - 1;

        return (
          <div key={idx} className="flex items-start gap-(--ct-space-3)">
            {/* Dot + connector */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "h-2.5 w-2.5 shrink-0 rounded-full mt-[3px]",
                  EVENT_DOT_CLASS[event.type],
                )}
              />
              {!isLast && (
                <div className="mt-1 h-full min-h-[24px] w-px bg-[var(--ct-border-soft)]" />
              )}
            </div>

            {/* Content */}
            <div className="flex flex-col gap-(--ct-space-1) pb-(--ct-space-2)">
              <span
                className={cn(
                  "text-[length:var(--ct-text-sm)] font-medium",
                  EVENT_LABEL_CLASS[event.type],
                )}
              >
                Month {event.month} · {event.type}
              </span>
              {(event.btcDelta !== undefined || event.usdcDelta !== undefined) && (
                <span className="text-[length:var(--ct-text-xs)] ct-text-faint">
                  {event.btcDelta !== undefined && formatBtc(event.btcDelta)}
                  {event.btcDelta !== undefined && event.usdcDelta !== undefined && " · "}
                  {event.usdcDelta !== undefined && formatUsdc(event.usdcDelta)}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
