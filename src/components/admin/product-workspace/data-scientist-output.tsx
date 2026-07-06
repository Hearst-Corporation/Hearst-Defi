"use client";

/**
 * Data Scientist output — the "Report Product" body.
 *
 * Renders what the data-scientist specialist produced from the assembled draft.
 * Refactored (2026-07) to a Wealth Management marketing view: Bento grid layout,
 * capital-based Monte Carlo (starting at $250k ticket), and emphasis on the
 * recommended strategy.
 *
 * DESIGN: token-only (`--ct-*`), dark. Glassmorphism for the hero chart,
 * clean typography for investor presentation.
 */

import { Markdown } from "@/components/admin/markdown";
import { MonteCarloChart } from "@/components/admin/product-workspace/monte-carlo-chart";
import { ProjectionAreaChart } from "@/components/admin/product-workspace/projection-area-chart";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type {
  ProductConstructionDraft,
  ScenarioResult,
} from "@/lib/agentic/swarm/live/types";
import { formatTargetsSafely } from "@/lib/products/guards";
import { BTC_MINING_PERFORMANCE_VAULT } from "@/lib/products/btc-mining-performance-vault";
import { Cell, Label, Pie, PieChart } from "recharts";
import { Card } from "@/components/catalyst/card";
import { Metric } from "@/components/catalyst/metric";
import { cn } from "@/lib/cn";

function pctFrac(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}
function pctOf(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}
const REGIME_LABEL: Record<ScenarioResult["regime"], string> = {
  defensive: "Safe",
  balanced: "Balanced",
  opportunistic: "Opportunistic",
};

const ALLOCATION_FILL_BY_INDEX = [
  "color-mix(in srgb, var(--ct-accent) 96%, transparent)",
  "color-mix(in srgb, var(--ct-accent) 72%, var(--ct-bg-deep))",
  "color-mix(in srgb, var(--ct-accent) 48%, var(--ct-bg-deep))",
  "color-mix(in srgb, var(--ct-accent) 24%, var(--ct-bg-deep))",
] as const;

const ALLOCATION_CHART_CONFIG = {
  share: { label: "Allocation" },
  Mining: { label: "Mining" },
  BTC: { label: "BTC" },
  USDC: { label: "USDC" },
  Reserve: { label: "Reserve" },
  Canonical: { label: "Canonical" },
  "BTC holding": { label: "BTC holding" },
  "Stable reserve": { label: "Stable reserve" },
  "Yield overlay": { label: "Yield overlay" },
} satisfies ChartConfig;

type AllocationDatum = {
  label: string;
  value: number;
  fill: string;
};

function scenarioAllocationData(s: ScenarioResult): AllocationDatum[] {
  return [
    { label: "Mining", value: s.allocation.mining, fill: ALLOCATION_FILL_BY_INDEX[0] },
    { label: "BTC", value: s.allocation.btc, fill: ALLOCATION_FILL_BY_INDEX[1] },
    { label: "USDC", value: s.allocation.usdc, fill: ALLOCATION_FILL_BY_INDEX[2] },
    {
      label: "Reserve",
      value: s.allocation.stableReserve,
      fill: ALLOCATION_FILL_BY_INDEX[3],
    },
  ];
}

function rangePct(low: number, high: number, digits = 1): string {
  return `${pctFrac(low, digits)}–${pctFrac(high, digits)}`;
}

function AllocationDonut({
  data,
  centerLabel,
}: {
  data: AllocationDatum[];
  centerLabel: string;
}) {
  return (
    <ChartContainer
      config={ALLOCATION_CHART_CONFIG}
      className="mx-auto aspect-square h-full max-h-[208px] w-full max-w-[208px]"
    >
      <PieChart>
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              nameKey="label"
              hideLabel
              formatter={(value, name) => (
                <span className="flex w-full justify-between gap-(--ct-space-3)">
                  <span className="ct-text-muted">{String(name)}</span>
                  <span className="mono tabular-nums ct-text-strong">
                    {pctOf(Number(value))}
                  </span>
                </span>
              )}
            />
          }
        />
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          innerRadius="65%"
          outerRadius="90%"
          paddingAngle={2}
          stroke="var(--ct-surface-card)"
          strokeWidth={1.5}
          isAnimationActive={false}
        >
          {data.map((item) => (
            <Cell key={item.label} fill={item.fill} />
          ))}
          {centerLabel && (
            <Label
              position="center"
              content={({ viewBox }) =>
                viewBox && "cx" in viewBox && "cy" in viewBox ? (
                  <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
                    <tspan
                      x={viewBox.cx}
                      y={viewBox.cy}
                      className="fill-[var(--ct-text-strong)] mono ct-metric-value"
                    >
                      100%
                    </tspan>
                    <tspan
                      x={viewBox.cx}
                      dy={18}
                      className="fill-[var(--ct-text-muted)] ct-bento-label"
                    >
                      {centerLabel}
                    </tspan>
                  </text>
                ) : null
              }
            />
          )}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}

function AllocationLegend({ data }: { data: AllocationDatum[] }) {
  return (
    <div className="grid gap-(--ct-space-2)">
      {data.map((item) => (
        <div
          key={item.label}
          className="flex items-center justify-between gap-(--ct-space-3)"
        >
          <span className="inline-flex items-center gap-(--ct-space-2)">
            <span
              aria-hidden
              className="h-(--ct-space-2_5) w-(--ct-space-2_5) rounded-[var(--ct-radius-xs)]"
              style={{ backgroundColor: item.fill }}
            />
            <span className="ct-metric-caption ct-text-muted">{item.label}</span>
          </span>
          <span className="mono ct-metric-value tabular-nums font-normal">
            {pctOf(item.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function DataScientistOutput({ draft }: { draft: ProductConstructionDraft }) {
  const scenarios = draft.scenarios ?? [];
  const fan = draft.charts.find((c) => c.kind === "fan");
  const targets = formatTargetsSafely(BTC_MINING_PERFORMANCE_VAULT);
  const fanBands = (fan?.fanBands ?? []).map((b) => ({ m: b.m, p5: b.p5, p50: b.p50, p95: b.p95 }));
  
  const headline = rangePct(
    draft.quant.headlineRange.low,
    draft.quant.headlineRange.high,
  );
  const monteCarloExpectedReturn = draft.quant.percentiles.p50;
  const monteCarloVolatility = draft.assumptions.btc.annualVol;

  const base = scenarios.find((s) => s.regime === "balanced") ?? scenarios[0];
  const riskLabel = draft.objectiveProfile
    ? draft.objectiveProfile.riskProfile[0]!.toUpperCase() +
      draft.objectiveProfile.riskProfile.slice(1)
    : "Balanced";

  // Executive bullets — extracted for the Hero right panel.
  const mainDrivers = [
    base
      ? `Yield driver: mining ${pctOf(base.allocation.mining)} + overlay ${pctOf(base.allocation.usdc)}`
      : "Yield driver: mining sleeve + yield overlay",
    base
      ? `Upside driver: BTC holding ${pctOf(base.allocation.btc)}`
      : "Upside driver: the BTC holding sleeve",
    `Downside: ${draft.quant.probBelowFloorPct.toFixed(1)}% of paths finish below the ${pctOf(draft.quant.floorApyPct)} floor`,
  ];

  return (
    <div className="flex flex-col gap-(--ct-space-8) min-w-0 pb-(--ct-space-8)">
      
      {/* ── TOP BANNER: Title & High-level Targets ── */}
      <div className="flex flex-col gap-(--ct-space-5)">
        <header className="flex flex-col gap-(--ct-space-2)">
           <h1 className="h1">
             {draft.vault.label}
           </h1>
           <div className="flex items-center gap-(--ct-space-3) ct-text-body body-sm ct-text-tertiary">
             <span>{riskLabel} Risk Profile</span>
             <span aria-hidden className="w-1 h-1 rounded-full bg-border-subtle" />
             <span>Minimum Ticket $250k</span>
           </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-(--ct-space-4) border-y ct-bc-soft py-(--ct-space-4)">
           <div className="flex flex-col gap-(--ct-space-1)">
               <div className="ct-bento-label">Monthly Distribution Target</div>
               <span className="stat-value">{targets.distribution}</span>
           </div>
           <div className="flex flex-col gap-(--ct-space-1)">
               <div className="ct-bento-label">Total Performance Target</div>
               <span className="stat-value">{targets.total}</span>
           </div>
        </div>
      </div>

      {/* ── HERO GRID: Glass Chart Left, Bento KPIs Right ── */}
      <div className="grid grid-cols-1 items-stretch gap-(--ct-space-5) lg:grid-cols-[1.6fr_minmax(16rem,22rem)]">
          
          {/* Left: The Monte Carlo Chart with Glass Panel */}
          <Card contentClassName="flex h-full min-h-[420px] flex-col gap-(--ct-space-4) p-(--ct-space-5)">
             {/* Subtle radial glow */}
             <div 
               className="absolute inset-0 pointer-events-none opacity-50 z-[-1]" 
               style={{ background: 'radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--ct-accent) 15%, transparent), transparent 60%)' }} 
             />
             
             <div className="relative z-10 flex flex-wrap items-baseline justify-between gap-(--ct-space-3)">
                <h3 className="ct-section-title">Projected Capital Trajectories</h3>
                <span className="mono ct-metric-caption tabular-nums">
                  {draft.quant.paths.toLocaleString("en-US")} paths · {draft.quant.horizonMonths}m
                </span>
             </div>
             
             <div className="relative z-10 flex-1">
                <MonteCarloChart
                  bare
                  indexed={false}
                  initialValue={250000} // $250k starting capital
                  horizonMonths={draft.quant.horizonMonths}
                  expectedAnnualReturn={monteCarloExpectedReturn}
                  annualVolatility={monteCarloVolatility}
                  seed={draft.quant.seed}
                  renderedPaths={220}
                  reportedPaths={draft.quant.paths}
                  caption="Projected growth on a $250k base — conditional dispersion, not guaranteed."
                  className="h-full"
                />
             </div>
          </Card>

          {/* Right: KPIs and Bullets */}
          <div className="flex h-full flex-col gap-(--ct-space-5)">
             <div className="grid grid-cols-2 gap-(--ct-space-3)">
                 <Metric
                     label="Target APY"
                     value={<span className="ct-text-accent">{headline}</span>}
                 />
                 <Metric
                     label="p50 Path"
                     value={pctFrac(draft.quant.percentiles.p50)}
                 />
                 <Metric
                     label="Floor APY"
                     value={pctOf(draft.quant.floorApyPct)}
                 />
                 <Metric
                     label="Below Floor"
                     value={<span className="ct-status-warning">{draft.quant.probBelowFloorPct.toFixed(1)}%</span>}
                 />
             </div>

             <Card contentClassName="flex flex-1 flex-col gap-(--ct-space-3) p-(--ct-space-5)">
                <div className="ct-section-title">Key Drivers</div>
                <ul className="flex flex-col justify-center gap-(--ct-space-3) ct-metric-value ct-text-body h-full">
                   {mainDrivers.map((b, i) => (
                      <li key={i} className="flex gap-(--ct-space-3) items-start leading-relaxed">
                        <span aria-hidden className="ct-text-accent mt-(--ct-space-0_5) opacity-70">·</span>
                        <span>{b}</span>
                      </li>
                   ))}
                </ul>
             </Card>
          </div>
      </div>

      {/* ── OPTIONAL: Fan Chart (ProjectionAreaChart) if present ── */}
      {fan && fanBands.length > 0 && (
        <section className="flex flex-col gap-(--ct-space-4) pt-(--ct-space-4)">
          <div className="flex items-baseline justify-between gap-(--ct-space-4)">
            <h3 className="ct-section-title">{fan.title}</h3>
            {fan.seedLabel ? (
              <span className="ct-section-label ct-text-tertiary">{fan.seedLabel}</span>
            ) : null}
          </div>
          <ProjectionAreaChart bands={fanBands} unit={fan.unit} />
        </section>
      )}

      {/* ── ALLOCATION ROW ── */}
      <section className="flex flex-col gap-(--ct-space-4) pt-(--ct-space-4)">
         <h3 className="ct-section-title">Recommended Allocation</h3>
         <div className="grid gap-(--ct-space-5) items-start lg:grid-cols-[minmax(0,1.2fr)_minmax(16rem,0.8fr)]">
             
             {/* Main Scenario (Balanced) gets prominence */}
             {base && (
                <div className="flex flex-col sm:flex-row items-center gap-(--ct-space-6) rounded-(--ct-radius-xl) border ct-bc-accent bg-[color-mix(in_srgb,var(--ct-accent)_3%,transparent)] p-(--ct-space-6) relative overflow-hidden">
                   <div className="absolute top-0 right-0 px-(--ct-space-3) py-(--ct-space-1) ct-bg-accent ct-text-deep ct-bento-label rounded-bl-lg">
                      RECOMMENDED
                   </div>
                   <div className="shrink-0 w-48 h-48">
                      <AllocationDonut data={scenarioAllocationData(base)} centerLabel="Mix" />
                   </div>
                   <div className="flex flex-col flex-1 gap-(--ct-space-4) w-full">
                      <div className="flex flex-col gap-1">
                          <h3 className="ct-panel-title">
                            {REGIME_LABEL[base.regime]} Portfolio
                          </h3>
                          <span className="mono stat-value">
                            {rangePct(base.quant.headlineRange.low, base.quant.headlineRange.high)}
                          </span>
                      </div>
                      <AllocationLegend data={scenarioAllocationData(base)} />
                   </div>
                </div>
             )}

             {/* Alternative Scenarios */}
             <div className="flex flex-col gap-(--ct-space-3) rounded-(--ct-radius-xl) border ct-bc-soft bg-surface-card p-(--ct-space-5)">
                <h3 className="ct-section-title mb-1">Alternative Profiles</h3>
                {scenarios.filter(s => s.regime !== "balanced").map(scenario => (
                   <Card key={scenario.regime} material="flat" className="flex flex-row items-center gap-(--ct-space-4) p-(--ct-space-3)">
                      <div className="w-16 h-16 shrink-0">
                         <AllocationDonut data={scenarioAllocationData(scenario)} centerLabel="" />
                      </div>
                      <div className="flex flex-col gap-1 flex-1">
                         <span className="ct-metric-value">{REGIME_LABEL[scenario.regime]}</span>
                         <span className="mono ct-metric-caption">{rangePct(scenario.quant.headlineRange.low, scenario.quant.headlineRange.high)}</span>
                      </div>
                   </Card>
                ))}
             </div>
         </div>
      </section>

      {/* ── THESIS ── */}
      <section className="flex flex-col gap-(--ct-space-4) pt-(--ct-space-6) border-t ct-bc-soft">
          <h3 className="ct-section-title">Investment Thesis</h3>
          <div className="lg:columns-2 lg:gap-(--ct-space-8) body-sm ct-text-body [&_*]:break-inside-avoid prose-spec">
              <Markdown content={draft.writeup.prose} />
          </div>
          <p className="ct-metric-caption ct-text-tertiary leading-relaxed mt-(--ct-space-2)">
              {draft.disclaimer}
          </p>
      </section>

    </div>
  );
}
