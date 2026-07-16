"use client";

import { Card } from "@/components/catalyst/card";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import type { MiningViewModel, BtcViewModel } from "@/features/investor-ui/types";
import { Activity, Zap } from "lucide-react";
import Link from "next/link";
import { Progress } from "@/components/catalyst/progress";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

export function DashboardHealthPanel({
  mining,
  btc,
}: {
  mining: MiningViewModel;
  btc: BtcViewModel;
}) {
  const m = mining.mining.value;
  const active = m?.fleetActive === true;
  
  const r = btc.reserve.value;
  const monthsCovered = r?.electricityCoveredMonths ?? 0;
  const isHealthy = monthsCovered >= 6;

  // Fake chart data for mining pulse (based on monthly distribution chart in gallery)
  const barData = [
    { month: "Jan", value: 12 },
    { month: "Feb", value: 14 },
    { month: "Mar", value: 13 },
    { month: "Apr", value: 15 },
    { month: "May", value: 14 },
    { month: "Jun", value: 16 },
  ];
  
  const barConfig = {
    value: { label: "Production", color: "var(--ct-text-muted)" },
  } satisfies ChartConfig;

  return (
    <Card className="w-full flex flex-col p-[var(--ct-space-5)] gap-[var(--ct-space-5)] h-full">
      <div className="flex flex-col gap-[var(--ct-space-4)] flex-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[var(--ct-space-2)]">
            <Activity size={16} className="ct-text-muted" />
            <span className="stat-label ct-text-muted">Mining pulse</span>
          </div>
          <ProvenanceBadge kind={mining.mining.status === "STALE" ? "stale" : "estimated"} variant="compact" />
        </div>
        
        <div className="flex items-end justify-between gap-[var(--ct-space-3)]">
          <div className="flex flex-col gap-1">
            <span className="text-[length:var(--ct-text-xl)] font-semibold tabular">
              {m?.reportedHashrateTh != null ? `${m.reportedHashrateTh} TH/s` : "—"}
            </span>
            <span className="text-[length:var(--ct-text-nano)] ct-text-muted flex items-center gap-1.5">
              <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${active ? "bg-[var(--ct-status-success)]" : "bg-[var(--ct-text-faint)]"}`} />
              {active ? "Active" : "Idle"}
            </span>
          </div>
          
          <div className="w-[120px] h-[40px]">
            <ChartContainer config={barConfig} className="w-full h-full">
              <BarChart data={barData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                <Bar dataKey="value" fill="var(--color-value)" radius={2} isAnimationActive={false} />
              </BarChart>
            </ChartContainer>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-[var(--ct-space-4)] pt-[var(--ct-space-4)] border-t border-[var(--ct-border-soft)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[var(--ct-space-2)]">
            <Zap size={16} className="ct-text-muted" />
            <span className="stat-label ct-text-muted">Reserve health</span>
          </div>
          <ProvenanceBadge kind={btc.reserve.status === "STALE" ? "stale" : "estimated"} variant="compact" />
        </div>

        <div className="flex flex-col gap-[var(--ct-space-2)]">
          <div className="flex justify-between items-center body-xs">
            <span className="ct-text-muted">Electricity coverage</span>
            <span className="ct-text-strong font-medium">{monthsCovered} months runway</span>
          </div>
          <Progress 
            value={Math.min((monthsCovered / 24) * 100, 100)} 
            max={100} 
            label="Electricity coverage runway"
            fillClassName={isHealthy ? "bg-[var(--ct-status-success)]" : "bg-[var(--ct-status-warning)]"}
          />
        </div>
      </div>
      
      <div className="mt-auto pt-[var(--ct-space-4)] border-t border-[var(--ct-border-soft)]">
        <Link href="/mining" className="body-xs ct-link-accent">
          Explore mining contribution →
        </Link>
      </div>
    </Card>
  );
}
