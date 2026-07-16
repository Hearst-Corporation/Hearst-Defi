"use client";

// Shared Mining Pulse panel (D4) — the mining half of the retired
// DashboardHealthPanel, split out so Dashboard (default density) and /btc
// (compact) consume ONE component. Honesty upgrades vs the original:
//  - bars are REAL monthly deltas derived from the cumulative series
//    (toMonthlyDeltas), never cumulative values labelled "monthly";
//  - no fabricated fallback series — an honest empty note instead;
//  - provenance via the unified toProvenance mapping (FIXTURE -> simulated);
//  - "BTC produced (mining)" label: this is `totalBtcEarnedSats` (fleet
//    production), distinct from the program's accumulated BTC.

import { Card } from "@/components/catalyst/card";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import type { MiningViewModel } from "@/features/investor-ui/types";
import Link from "next/link";
import { Bar, BarChart, XAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { MINING_PULSE_CONFIG } from "@/features/investor-ui/charts/asset-chart-config";
import {
  toMonthlyDeltas,
  type AccumulationPoint,
} from "@/features/investor-ui/charts/accumulation-series";
import { AssetIcon } from "@/features/investor-ui/components/asset-icon";
import { DataUnavailable } from "@/features/investor-ui/components/states/data-states";
import { toProvenance, satsToBtcString, formatIsoDate, formatPeriodMonth } from "@/features/investor-ui/format-btc";

export interface MiningPulsePanelProps {
  mining: MiningViewModel;
  /** Cumulative accumulation points — the panel derives monthly deltas. */
  monthlyProduction?: readonly AccumulationPoint[] | null;
  /** `compact` (/btc): KPIs + fleet status only — no bar chart, no link. */
  density?: "default" | "compact";
}

export function MiningPulsePanel({
  mining,
  monthlyProduction,
  density = "default",
}: MiningPulsePanelProps) {
  const m = mining.mining.value;

  if (m == null) {
    return (
      <Card className="w-full p-[var(--ct-space-5)]">
        <DataUnavailable label="Mining pulse" />
      </Card>
    );
  }

  const active = m.fleetActive === true;
  const compact = density === "compact";

  const deltas = monthlyProduction?.length ? toMonthlyDeltas(monthlyProduction) : [];
  const barData = deltas.map((p) => ({
    month: formatPeriodMonth(p.period),
    value: p.miningBtc,
  }));
  const lastBar = barData[barData.length - 1];

  const totalBtc = m.totalBtcEarnedSats != null ? satsToBtcString(m.totalBtcEarnedSats, 6) : null;

  return (
    <Card
      className={`w-full flex flex-col p-[var(--ct-space-5)] ${compact ? "gap-[var(--ct-space-4)]" : "gap-[var(--ct-space-5)]"}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[var(--ct-space-2)]">
          <AssetIcon variant="mining" size="sm" />
          <span className="ct-bento-label">Mining pulse</span>
        </div>
        <ProvenanceBadge kind={toProvenance(mining.mining.status)} variant="compact" />
      </div>

      <div className="grid grid-cols-2 gap-[var(--ct-space-3)]">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="body-xs">Reported hashrate</span>
          <span className="text-[length:var(--ct-text-lg)] font-semibold tabular ct-text-strong">
            {m.reportedHashrateTh != null ? `${m.reportedHashrateTh} TH/s` : "—"}
          </span>
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="body-xs flex items-center gap-1">
            <AssetIcon variant="btc" size="sm" label="" />
            BTC produced (mining)
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
        {m.lastReportTime ? (
          <span className="ct-metric-caption">· Last report {formatIsoDate(m.lastReportTime)}</span>
        ) : null}
      </div>

      {!compact ? (
        barData.length > 0 ? (
          <>
            <ChartContainer
              config={MINING_PULSE_CONFIG}
              className="aspect-auto h-[140px] w-full min-w-0 rounded-[var(--ct-radius-md)] bg-[var(--ct-surface-inset)] p-[var(--ct-space-4)]"
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
              <span className="ct-metric-caption">
                Latest month · {lastBar.value.toFixed(6)} BTC
              </span>
            ) : null}
          </>
        ) : (
          <p className="body-sm ct-text-muted m-0">
            Monthly production will appear once mining credits are indexed.
          </p>
        )
      ) : null}

      {!compact ? (
        <div className="pt-[var(--ct-space-2)] border-t border-[var(--ct-border-soft)]">
          <Link href="/mining" className="body-xs ct-link-accent">
            Explore mining contribution →
          </Link>
        </div>
      ) : null}
    </Card>
  );
}
