"use client";

import { Card } from "@/components/catalyst/card";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Progress } from "@/components/catalyst/progress";
import type { MiningViewModel, BtcViewModel } from "@/features/investor-ui/types";
import Link from "next/link";
import { Bar, BarChart, XAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { MINING_PULSE_CONFIG } from "@/features/investor-ui/charts/asset-chart-config";
import { AssetIcon } from "@/features/investor-ui/components/asset-icon";

function formatUsdc(decimal: string | null | undefined): string | null {
  if (decimal == null) return null;
  const n = Number(decimal);
  if (!Number.isFinite(n)) return null;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function satsToBtc(sats: string | null | undefined): string | null {
  if (sats == null) return null;
  const n = Number(sats);
  if (!Number.isFinite(n)) return null;
  return (n / 1e8).toFixed(6);
}

export function DashboardHealthPanel({
  mining,
  btc,
  monthlyProduction,
}: {
  mining: MiningViewModel;
  btc: BtcViewModel;
  monthlyProduction?: readonly { period: string; miningBtc: number }[] | null;
}) {
  const m = mining.mining.value;
  const active = m?.fleetActive === true;

  const r = btc.reserve.value;
  const monthsCovered = r?.electricityCoveredMonths ?? 0;
  const isHealthy = monthsCovered >= 6;

  const barData =
    monthlyProduction && monthlyProduction.length > 0
      ? monthlyProduction.map((p) => ({
          month: new Date(p.period + "-01").toLocaleDateString("en-US", { month: "short" }),
          value: p.miningBtc,
        }))
      : [
          { month: "Jan", value: 0.012 },
          { month: "Feb", value: 0.014 },
          { month: "Mar", value: 0.013 },
          { month: "Apr", value: 0.015 },
          { month: "May", value: 0.014 },
          { month: "Jun", value: 0.016 },
        ];

  const lastBar = barData[barData.length - 1];
  const totalBtc = satsToBtc(m?.totalBtcEarnedSats);

  return (
    <Card className="w-full flex flex-col p-[var(--ct-space-5)] gap-[var(--ct-space-5)]">
      <div className="flex flex-col gap-[var(--ct-space-4)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[var(--ct-space-2)]">
            <AssetIcon variant="mining" size="sm" />
            <span className="stat-label ct-text-muted">Mining pulse</span>
          </div>
          <ProvenanceBadge kind={mining.mining.status === "STALE" ? "stale" : "estimated"} variant="compact" />
        </div>

        <div className="grid grid-cols-2 gap-[var(--ct-space-3)] body-xs">
          <div className="flex flex-col gap-0.5">
            <span className="ct-text-faint">Reported hashrate</span>
            <span className="text-[length:var(--ct-text-lg)] font-semibold tabular ct-text-strong">
              {m?.reportedHashrateTh != null ? `${m.reportedHashrateTh} TH/s` : "—"}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="ct-text-faint flex items-center gap-1">
              <AssetIcon variant="btc" size="sm" label="" />
              BTC produced
            </span>
            <span className="text-[length:var(--ct-text-lg)] font-semibold tabular text-[var(--ct-asset-btc)]">
              {totalBtc != null ? `${totalBtc} BTC` : "—"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-[var(--ct-space-2)] body-xs">
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${active ? "bg-[var(--ct-status-success)]" : "bg-[var(--ct-chart-neutral)]"}`}
          />
          <span className={active ? "text-[var(--ct-status-success)]" : "ct-text-muted"}>
            Fleet {active ? "active" : "idle"}
          </span>
          {m?.lastReportTime ? (
            <span className="ct-text-faint">· Last report {new Date(m.lastReportTime).toLocaleDateString()}</span>
          ) : null}
        </div>

        <ChartContainer
          config={MINING_PULSE_CONFIG}
          className="aspect-auto h-[140px] w-full rounded-[var(--ct-radius-md)] bg-[var(--ct-surface-inset)] p-[var(--ct-space-2)]"
        >
          <BarChart data={barData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={6}
              tick={{ fill: "var(--ct-chart-axis)", fontSize: 10 }}
            />
            <Bar
              dataKey="value"
              fill="var(--color-value)"
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
              activeBar={{ fill: "var(--ct-asset-btc)" }}
            />
          </BarChart>
        </ChartContainer>
        {lastBar ? (
          <span className="body-xs ct-text-faint">
            Latest month · {typeof lastBar.value === "number" ? lastBar.value.toFixed(6) : lastBar.value} BTC
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-[var(--ct-space-4)] pt-[var(--ct-space-4)] border-t border-[var(--ct-border-soft)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[var(--ct-space-2)]">
            <AssetIcon variant="reserve" size="sm" />
            <span className="stat-label ct-text-muted">Reserve health</span>
          </div>
          <ProvenanceBadge kind={btc.reserve.status === "STALE" ? "stale" : "estimated"} variant="compact" />
        </div>

        <div className="grid grid-cols-2 gap-[var(--ct-space-3)] body-xs">
          <div className="flex flex-col gap-0.5">
            <span className="ct-text-faint">Operating reserve</span>
            <span className="text-[length:var(--ct-text-lg)] font-semibold tabular text-[var(--ct-asset-usdc)]">
              {formatUsdc(r?.reserveUsdc) ?? "—"}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="ct-text-faint">Health</span>
            <span
              className={`text-[length:var(--ct-text-sm)] font-medium ${isHealthy ? "text-[var(--ct-status-success)]" : "text-[var(--ct-status-warning)]"}`}
            >
              {isHealthy ? "Healthy" : "Monitor"}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-[var(--ct-space-2)]">
          <div className="flex justify-between items-center body-xs">
            <span className="ct-text-muted">Electricity runway</span>
            <span className="ct-text-strong font-medium">{monthsCovered} months covered</span>
          </div>
          <Progress
            value={Math.min((monthsCovered / 24) * 100, 100)}
            max={100}
            label="Electricity coverage runway"
            fillClassName="bg-[var(--ct-asset-usdc)]"
          />
        </div>
      </div>

      <div className="pt-[var(--ct-space-2)] border-t border-[var(--ct-border-soft)]">
        <Link href="/mining" className="body-xs ct-link-accent">
          Explore mining contribution →
        </Link>
      </div>
    </Card>
  );
}
