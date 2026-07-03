"use client";

import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { CollateralTimelineRow } from "@/lib/strategy-data-lab";
import { HcChartCard } from "@/components/dataviz/his/HcChartCard";
import {
  SegmentedControl,
  type SegmentedItem,
} from "@/components/catalyst/segmented-control";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/catalyst/table";
import { cn } from "@/lib/cn";

type TimelineMetric = "price" | "ltv" | "debt";

const TIMELINE_METRIC_ITEMS: ReadonlyArray<SegmentedItem<TimelineMetric>> = [
  { value: "price", label: "BTC vs Liq." },
  { value: "ltv", label: "LTV" },
  { value: "debt", label: "Debt vs Reserve" },
];

function usd(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function usdCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${Math.round(value / 1_000)}k`;
  }
  return usd(value);
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function CollateralTimeline({
  rows,
  deRiskTriggerLtvPct,
  liquidationLtvPct,
  minimumReserveUsdc,
  initialOpenAdvanced = false,
}: {
  rows: readonly CollateralTimelineRow[];
  deRiskTriggerLtvPct: number;
  liquidationLtvPct: number;
  minimumReserveUsdc: number;
  initialOpenAdvanced?: boolean;
}) {
  const [metric, setMetric] = useState<TimelineMetric>("price");

  const chartData = useMemo(
    () =>
      rows.map((row) => ({
        month: row.month,
        btcPriceUsd: row.btcPriceUsd,
        liquidationPriceUsd: row.liquidationPriceUsd,
        ltvPct: row.ltvPct * 100,
        debtUsdc: row.debtUsdc,
        workingReserveUsdc: row.workingReserveUsdc,
        riskZone: row.riskZone,
        eventType: row.eventType,
      })),
    [rows],
  );

  const visibleEvents = rows.filter((row) => row.eventType !== "NONE").slice(0, 6);

  return (
    <div className="flex flex-col gap-(--ct-space-4)">
      <div className="flex flex-wrap items-center justify-between gap-(--ct-space-3)">
        <SegmentedControl
          items={TIMELINE_METRIC_ITEMS}
          value={metric}
          onChange={setMetric}
          ariaLabel="Collateral timeline metric"
          variant="tablist"
        />
        <span className="text-[length:var(--ct-text-2xs)] ct-text-tertiary">
          {rows.length - 1} simulated months · event markers stay visible on every chart
        </span>
      </div>

      <HcChartCard
        title={
          metric === "price"
            ? "BTC Price vs Liquidation Price"
            : metric === "ltv"
              ? "LTV with De-risk Thresholds"
              : "USDC Debt vs Working Reserve"
        }
        subtitle={
          metric === "price"
            ? "Spot path and dynamic liquidation line"
            : metric === "ltv"
              ? "Current LTV against de-risk and liquidation thresholds"
              : "Debt pressure against available working liquidity"
        }
        source="estimated"
        state="ready"
        height={320}
        aria-label="Collateral timeline chart"
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--ct-border-soft)"
              vertical={false}
              opacity="var(--ct-opacity-50)"
            />
            <XAxis
              dataKey="month"
              tickFormatter={(value: number) => `M${value}`}
              tick={{ fontSize: 10, fill: "var(--ct-text-muted)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(value: number) =>
                metric === "ltv" ? `${Math.round(value)}%` : usdCompact(value)
              }
              tick={{ fontSize: 10, fill: "var(--ct-text-muted)" }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Tooltip
              contentStyle={{
                background: "var(--ct-surface-card)",
                border: "1px solid var(--ct-border-soft)",
                borderRadius: "var(--ct-radius-md)",
                fontSize: 11,
                color: "var(--ct-text-body)",
              }}
              formatter={(value, name) => {
                const numericValue =
                  typeof value === "number"
                    ? value
                    : typeof value === "string"
                      ? Number(value)
                      : 0;
                const label = String(name ?? "");
                if (label.toLowerCase().includes("ltv")) {
                  return [`${numericValue.toFixed(1)}%`, label];
                }
                return [usd(numericValue), label];
              }}
              labelFormatter={(label) => `Month ${String(label)}`}
              cursor={{ fill: "var(--ct-border-soft)", opacity: 0.15 }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, color: "var(--ct-text-tertiary)" }}
            />

            {metric === "price" ? (
              <>
                <Area
                  type="monotone"
                  dataKey="btcPriceUsd"
                  name="BTC price"
                  stroke="var(--ct-chart-curve-color)"
                  fill="var(--ct-chart-area-bottom)"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="liquidationPriceUsd"
                  name="Liquidation price"
                  stroke="var(--ct-status-danger)"
                  strokeWidth={1.6}
                  dot={false}
                />
              </>
            ) : null}

            {metric === "ltv" ? (
              <>
                <Line
                  type="monotone"
                  dataKey="ltvPct"
                  name="LTV"
                  stroke="var(--ct-text-strong)"
                  strokeWidth={2}
                  dot={false}
                />
                <ReferenceLine
                  y={deRiskTriggerLtvPct * 100}
                  stroke="var(--ct-status-warning)"
                  strokeDasharray="4 4"
                  label={{ value: "De-risk", fill: "var(--ct-status-warning)", fontSize: 10 }}
                />
                <ReferenceLine
                  y={liquidationLtvPct * 100}
                  stroke="var(--ct-status-danger)"
                  strokeDasharray="4 4"
                  label={{ value: "Liquidation", fill: "var(--ct-status-danger)", fontSize: 10 }}
                />
              </>
            ) : null}

            {metric === "debt" ? (
              <>
                <Line
                  type="monotone"
                  dataKey="debtUsdc"
                  name="Debt USDC"
                  stroke="var(--ct-status-danger)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="workingReserveUsdc"
                  name="Working reserve USDC"
                  stroke="var(--ct-status-info)"
                  strokeWidth={2}
                  dot={false}
                />
                <ReferenceLine
                  y={minimumReserveUsdc}
                  stroke="var(--ct-status-info)"
                  strokeDasharray="4 4"
                  label={{ value: "Reserve floor", fill: "var(--ct-status-info)", fontSize: 10 }}
                />
              </>
            ) : null}

            {chartData.map((point) =>
              point.eventType === "NONE" ? null : (
                <ReferenceDot
                  key={`${point.month}-${point.eventType}`}
                  x={point.month}
                  y={
                    metric === "ltv"
                      ? point.ltvPct
                      : metric === "debt"
                        ? point.debtUsdc
                        : point.btcPriceUsd
                  }
                  r={4}
                  fill={
                    point.eventType === "SELL"
                      ? "var(--ct-status-danger)"
                      : point.eventType === "BUYBACK"
                        ? "var(--ct-accent)"
                        : "var(--ct-status-warning)"
                  }
                  stroke="var(--ct-surface-card)"
                />
              ),
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </HcChartCard>

      <div className="grid gap-(--ct-space-3) lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="rounded-(--ct-radius-lg) border border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)] p-(--ct-space-4)">
          <div className="flex items-center justify-between gap-(--ct-space-2)">
            <span className="ct-bento-label">Compact event list</span>
            <span className="text-[length:var(--ct-text-2xs)] ct-text-tertiary">
              {visibleEvents.length} recent events shown
            </span>
          </div>
          <div className="mt-(--ct-space-3) flex flex-col gap-(--ct-space-2)">
            {visibleEvents.length === 0 ? (
              <p className="text-[length:var(--ct-text-xs)] ct-text-tertiary">
                No delever, buyback, or liquidation event has been triggered on the current path.
              </p>
            ) : (
              visibleEvents.map((row) => (
                <div
                  key={`event-${row.month}-${row.eventType}`}
                  className="flex items-start justify-between gap-(--ct-space-3) rounded-(--ct-radius-md) border border-[var(--ct-border-soft)] bg-[var(--ct-surface-card)] px-(--ct-space-3) py-(--ct-space-2)"
                >
                  <div className="flex flex-col gap-(--ct-space-1)">
                    <span
                      className={cn(
                        "text-[length:var(--ct-text-2xs)] font-medium uppercase tracking-wide",
                        row.eventType === "SELL"
                          ? "text-[var(--ct-status-danger)]"
                          : row.eventType === "BUYBACK"
                            ? "ct-text-accent"
                            : "text-[var(--ct-status-warning)]",
                      )}
                    >
                      {row.eventType}
                    </span>
                    <span className="text-[length:var(--ct-text-xs)] ct-text-body">
                      Month {row.month} · BTC {usd(row.btcPriceUsd)}
                    </span>
                  </div>
                  <span className="text-[length:var(--ct-text-2xs)] ct-text-tertiary">
                    {row.eventType === "SELL"
                      ? `Debt repaid ${usd(row.event?.debtRepaidUsdc ?? 0)}`
                      : row.eventType === "BUYBACK"
                        ? `USDC deployed ${usd(row.event?.usdcDeployed ?? 0)}`
                        : "Liquidation threshold breached"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-(--ct-radius-lg) border border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)] p-(--ct-space-4)">
          <span className="ct-bento-label">Risk zones</span>
          <div className="mt-(--ct-space-3) flex flex-col gap-(--ct-space-2)">
            {[
              {
                label: "SAFE",
                note: "Distance to liquidation stays above the re-risk trigger.",
                tone: "ct-text-accent",
              },
              {
                label: "WATCH",
                note: "Healthy but not far enough from liquidation to repurchase.",
                tone: "ct-text-body",
              },
              {
                label: "DERISK",
                note: "LTV at or above the de-risk threshold; sales should engage.",
                tone: "text-[var(--ct-status-warning)]",
              },
              {
                label: "LIQUIDATED",
                note: "Hard liquidation threshold breached before a feasible de-risk action.",
                tone: "text-[var(--ct-status-danger)]",
              },
            ].map((zone) => (
              <div key={zone.label} className="rounded-(--ct-radius-md) border border-[var(--ct-border-soft)] bg-[var(--ct-surface-card)] px-(--ct-space-3) py-(--ct-space-2)">
                <div className={cn("text-[length:var(--ct-text-2xs)] font-medium uppercase tracking-wide", zone.tone)}>
                  {zone.label}
                </div>
                <p className="mt-(--ct-space-1) text-[length:var(--ct-text-xs)] ct-text-tertiary">
                  {zone.note}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <details
        className="group rounded-(--ct-radius-md) border border-[var(--ct-border-soft)]"
        {...(initialOpenAdvanced ? { open: true } : {})}
      >
        <summary className="flex cursor-pointer list-none items-center gap-(--ct-space-2) px-(--ct-space-3) py-(--ct-space-2) text-[length:var(--ct-text-xs)] ct-text-tertiary select-none hover:ct-text-body">
          <span className="transition-transform group-open:rotate-90">▶</span>
          Advanced month-by-month timeline
        </summary>
        <div className="max-h-[24rem] min-w-0 overflow-auto border-t border-[var(--ct-border-soft)] p-(--ct-space-3)">
          <Table
            dense
            className="w-full min-w-[60rem] border-collapse text-[length:var(--ct-text-xs)] tabular-nums"
          >
            <TableHead>
              <TableRow className="border-b border-[var(--ct-border-soft)] ct-text-tertiary">
                <TableHeader className="p-(--ct-space-2) text-left">Month</TableHeader>
                <TableHeader className="p-(--ct-space-2) text-right">BTC price</TableHeader>
                <TableHeader className="p-(--ct-space-2) text-right">Debt</TableHeader>
                <TableHeader className="p-(--ct-space-2) text-right">Working reserve</TableHeader>
                <TableHeader className="p-(--ct-space-2) text-right">wBTC collateral</TableHeader>
                <TableHeader className="p-(--ct-space-2) text-right">Collateral value</TableHeader>
                <TableHeader className="p-(--ct-space-2) text-right">LTV</TableHeader>
                <TableHeader className="p-(--ct-space-2) text-right">Liq. price</TableHeader>
                <TableHeader className="p-(--ct-space-2) text-right">Distance</TableHeader>
                <TableHeader className="p-(--ct-space-2) text-left">Event</TableHeader>
                <TableHeader className="p-(--ct-space-2) text-left">Zone</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={`${row.month}-${row.eventType}`}
                  className="border-b border-[var(--ct-border-soft)] align-top"
                >
                  <TableCell className="p-(--ct-space-2) ct-text-strong">{`M${row.month}`}</TableCell>
                  <TableCell className="p-(--ct-space-2) text-right ct-text-body">
                    {usd(row.btcPriceUsd)}
                  </TableCell>
                  <TableCell className="p-(--ct-space-2) text-right ct-text-body">
                    {usd(row.debtUsdc)}
                  </TableCell>
                  <TableCell className="p-(--ct-space-2) text-right ct-text-body">
                    {usd(row.workingReserveUsdc)}
                  </TableCell>
                  <TableCell className="p-(--ct-space-2) text-right ct-text-body">
                    {row.wbtcCollateralAmount.toFixed(3)} BTC
                  </TableCell>
                  <TableCell className="p-(--ct-space-2) text-right ct-text-body">
                    {usd(row.collateralValueUsdc)}
                  </TableCell>
                  <TableCell className="p-(--ct-space-2) text-right ct-text-body">
                    {pct(row.ltvPct)}
                  </TableCell>
                  <TableCell className="p-(--ct-space-2) text-right ct-text-body">
                    {usd(row.liquidationPriceUsd)}
                  </TableCell>
                  <TableCell className="p-(--ct-space-2) text-right ct-text-body">
                    {pct(row.distanceToLiquidationPct)}
                  </TableCell>
                  <TableCell className="p-(--ct-space-2) text-left ct-text-tertiary">
                    {row.eventType}
                  </TableCell>
                  <TableCell className="p-(--ct-space-2) text-left ct-text-tertiary">
                    {row.riskZone}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </details>
    </div>
  );
}
