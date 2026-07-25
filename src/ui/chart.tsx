"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/lib/cn";

const CHART_COLORS = {
  primary: "var(--color-chart-1)",
  grid: "var(--color-border-subtle)",
  axis: "var(--color-subtle)",
} as const;

type ChartRow = Record<string, string | number>;

function ChartTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; dataKey?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface-overlay px-3 py-2 text-xs shadow-[var(--ct-shadow-soft)]">
      {label ? <p className="mb-1 text-subtle">{label}</p> : null}
      {payload.map((entry) => (
        <p
          key={String(entry.dataKey)}
          className="font-medium text-foreground tabular-nums"
        >
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

export function LineChartPanel({
  data,
  xKey,
  yKey,
  name,
  height = 280,
  className,
}: {
  data: ChartRow[];
  xKey: string;
  yKey: string;
  name?: string;
  height?: number;
  className?: string;
}) {
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip content={<ChartTooltipContent />} />
          <Line
            type="monotone"
            dataKey={yKey}
            name={name ?? yKey}
            stroke={CHART_COLORS.primary}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: CHART_COLORS.primary }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AreaChartPanel({
  data,
  xKey,
  yKey,
  name,
  height = 280,
  className,
}: {
  data: ChartRow[];
  xKey: string;
  yKey: string;
  name?: string;
  height?: number;
  className?: string;
}) {
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="hc-area-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.35} />
              <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip content={<ChartTooltipContent />} />
          <Area
            type="monotone"
            dataKey={yKey}
            name={name ?? yKey}
            stroke={CHART_COLORS.primary}
            strokeWidth={2}
            fill="url(#hc-area-fill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
