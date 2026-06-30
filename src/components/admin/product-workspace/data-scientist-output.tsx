"use client";

/**
 * Data Scientist output — compact Report Product body.
 *
 * Presentation only: reads the assembled draft (no business math). Reuses HIS
 * fan chart (same primitive as construction-report / chart-gallery canon).
 */

import { Markdown } from "@/components/admin/markdown";
import { HcFanChart } from "@/components/dataviz/his";
import type { HcLabeledValue } from "@/components/dataviz/his/types";
import { BentoKpiStrip } from "@/components/catalyst/bento";
import { cn } from "@/lib/cn";
import type {
  ProductConstructionDraft,
  ScenarioResult,
  ChartArtifact,
} from "@/lib/agentic/swarm/live/types";
import { formatTargetsSafely } from "@/lib/products/guards";
import { BTC_MINING_PERFORMANCE_VAULT } from "@/lib/products/btc-mining-performance-vault";
import {
  formatApyFraction,
  formatBtcUsd,
  formatFanPercentPoint,
  formatHashpriceUsd,
} from "@/components/admin/product-workspace/report-format";
import { ProjectionAreaChart } from "./projection-area-chart";
import { MonteCarloChart } from "./monte-carlo-chart";
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart";

const REGIME_LABEL: Record<ScenarioResult["regime"], string> = {
  defensive: "Safe",
  balanced: "Balanced",
  opportunistic: "Opportunistic",
};

const ALLOCATION_CHART_CONFIG = {
  mining: { label: "Mining", color: "var(--ct-accent)" },
  btc: { label: "BTC", color: "var(--ct-chart-series-1)" },
  usdc: { label: "USDC", color: "var(--ct-chart-series-2)" },
  reserve: { label: "Reserve", color: "var(--ct-chart-series-3)" },
} satisfies ChartConfig;

function AllocationDonut({ scenario, size }: { scenario: ScenarioResult; size: number }) {
  const data = [
    { name: "mining", value: scenario.allocation.mining, fill: "var(--ct-accent)" },
    { name: "btc", value: scenario.allocation.btc, fill: "var(--ct-chart-series-1)" },
    { name: "usdc", value: scenario.allocation.usdc, fill: "var(--ct-chart-series-2)" },
    { name: "reserve", value: scenario.allocation.stableReserve, fill: "var(--ct-chart-series-3)" },
  ].filter((d) => d.value > 0);

  return (
    <ChartContainer config={ALLOCATION_CHART_CONFIG} className="aspect-square" style={{ width: size, height: size }}>
      <PieChart width={size} height={size}>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={size * 0.35}
          outerRadius={size * 0.48}
          stroke="var(--ct-surface-inset)"
          strokeWidth={2}
          isAnimationActive={false}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Pie>
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
      </PieChart>
    </ChartContainer>
  );
}

function sleeves(s: ScenarioResult): HcLabeledValue[] {
  return [
    { label: "Mining", value: s.allocation.mining },
    { label: "BTC", value: s.allocation.btc },
    { label: "USDC", value: s.allocation.usdc },
    { label: "Reserve", value: s.allocation.stableReserve },
  ];
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <span className="ct-bento-label">{children}</span>;
}

function CollapsibleSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group border-t border-[var(--ct-border-soft)] py-(--ct-space-3)">
      <summary className="ct-bento-label flex cursor-pointer list-none items-center gap-(--ct-space-2) transition-colors hover:text-[var(--ct-text-body)]">
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rotate-45 border-b border-r border-current transition-transform group-open:rotate-[225deg]"
        />
        {title}
      </summary>
      <div className="pt-(--ct-space-3) body-sm ct-text-secondary leading-relaxed">{children}</div>
    </details>
  );
}

function SleeveGrid({ scenario }: { scenario: ScenarioResult }) {
  const rows = [
    { label: "Mining", value: scenario.allocation.mining },
    { label: "BTC", value: scenario.allocation.btc },
    { label: "USDC", value: scenario.allocation.usdc },
    { label: "Reserve", value: scenario.allocation.stableReserve },
  ] as const;

  return (
    <div className="grid w-full min-w-0 grid-cols-4 gap-(--ct-space-1)">
      {rows.map((row) => (
        <div key={row.label} className="flex min-w-0 flex-col items-center gap-px">
          <span className="text-[length:var(--ct-text-nano)] ct-text-faint">{row.label}</span>
          <span className="mono text-[length:var(--ct-text-xs)] tabular-nums ct-text-strong">
            {row.value.toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  );
}

function ScenarioBlock({
  scenario,
  principal,
  ringSize,
}: {
  scenario: ScenarioResult;
  principal?: boolean;
  ringSize: number;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-(--ct-space-2)">
      <div className="flex items-center gap-(--ct-space-2)">
        {principal ? (
          <span
            aria-hidden
            className="h-(--ct-space-1_5) w-(--ct-space-1_5) rounded-(--ct-radius-full) bg-[var(--ct-accent)]"
          />
        ) : null}
        <span className="ct-section-label ct-text-strong">{REGIME_LABEL[scenario.regime]}</span>
      </div>
      <AllocationDonut scenario={scenario} size={ringSize} />
      <SleeveGrid scenario={scenario} />
      <div className="flex flex-col items-center gap-px text-center">
        <span className="mono text-[length:var(--ct-text-sm)] font-medium tabular-nums ct-text-strong">
          {formatApyFraction(scenario.quant.headlineRange.low)}–
          {formatApyFraction(scenario.quant.headlineRange.high)}
        </span>
        <span className="mono text-[length:var(--ct-text-nano)] ct-text-tertiary">
          p50 {formatApyFraction(scenario.quant.percentiles.p50)}
        </span>
      </div>
    </div>
  );
}

function TargetCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-(--ct-space-1) rounded-(--ct-radius-lg) border border-[var(--ct-border-soft)] px-(--ct-space-4) py-(--ct-space-3)">
      <SectionLabel>{label}</SectionLabel>
      <span className="body-sm ct-text-body leading-snug">{value}</span>
    </div>
  );
}

function KpiValue({ value, hint }: { value: string; hint: string }) {
  return (
    <span className="flex flex-col gap-px">
      <span className="mono text-[length:var(--ct-text-sm)] font-medium tabular-nums ct-text-strong">
        {value}
      </span>
      <span className="text-[length:var(--ct-text-nano)] ct-text-faint">{hint}</span>
    </span>
  );
}

function ValueBarChart({ chart }: { chart: ChartArtifact }) {
  if (!chart.valuePoints?.length) return null;

  return (
    <div className="flex flex-col gap-(--ct-space-3) border-t border-[var(--ct-border-soft)] py-(--ct-space-4)">
      <SectionLabel>{chart.title}</SectionLabel>
      <ChartContainer
        config={{ value: { label: chart.unit || "Value", color: "var(--ct-accent)" } }}
        className="h-[min(300px,42vh)] min-h-[220px] w-full min-w-0"
      >
        <BarChart data={chart.valuePoints} margin={{ top: 8, right: 0, bottom: 0, left: -20 }}>
          <CartesianGrid vertical={false} stroke="var(--ct-border-soft)" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => value}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => `${value}${chart.unit === "%" ? "%" : ""}`}
          />
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
          <Bar
            dataKey="y"
            fill="var(--ct-accent)"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

export function DataScientistOutput({ draft }: { draft: ProductConstructionDraft }) {
  const scenarios = draft.scenarios ?? [];
  const principal = scenarios.find((s) => s.regime === "defensive");
  const alternatives = scenarios.filter((s) => s.regime !== "defensive");
  const fan = draft.charts.find((c) => c.kind === "fan");
  const valChart = draft.charts.find((c) => c.kind === "value");
  const targets = formatTargetsSafely(BTC_MINING_PERFORMANCE_VAULT);
  const fanBands = (fan?.fanBands ?? []).map((b) => ({ m: b.m, p5: b.p5, p50: b.p50, p95: b.p95 }));
  const headline = `${formatApyFraction(draft.quant.headlineRange.low)}–${formatApyFraction(draft.quant.headlineRange.high)}`;
  const { market, strategy, quant } = draft;
  const levers = strategy.companyLevers;
  const mc = draft.monteCarloDisclosure;
  const horizonEnd = fanBands.at(-1);
  const mcMeta = `${quant.paths.toLocaleString("en-US")} paths · ${quant.horizonMonths} months`;

  const framingBullets = [
    `BTC spot ${formatBtcUsd(market.btcUsd)} · hashprice ${formatHashpriceUsd(market.hashpriceUsdPerThDay)}`,
    `Mining yield ${strategy.miningYieldPct.toFixed(1)}% · USDC yield ${strategy.usdcYieldPct.toFixed(1)}%`,
    `Scenario band ${strategy.btcReturn.bear}% / ${strategy.btcReturn.base}% / ${strategy.btcReturn.bull}%`,
  ];

  return (
    <div className="flex min-w-0 flex-col gap-0">
      {/* 1 · Framing */}
      <section className="flex flex-col gap-(--ct-space-3) pb-(--ct-space-4)">
        <SectionLabel>Framing brief</SectionLabel>
        <p className="body-sm ct-text-body leading-relaxed">
          Read-only draft built from live market inputs and configured vault assumptions.
          The current construction produces a projected APY range of{" "}
          <span className="mono tabular-nums ct-text-strong">{headline}</span>, driven by mining
          yield, BTC scenario exposure and USDC yield. Nothing is created, deployed or sent until
          an admin validates the draft.
        </p>
        <ul className="flex flex-col gap-(--ct-space-1) pl-(--ct-space-4)">
          {framingBullets.map((line) => (
            <li key={line} className="list-disc text-[length:var(--ct-text-xs)] ct-text-secondary">
              {line}
            </li>
          ))}
        </ul>
      </section>

      {/* 2 · Key live inputs */}
      <section className="border-t border-[var(--ct-border-soft)]">
        <BentoKpiStrip
          ariaLabel="Key live inputs"
          items={[
            { label: "BTC price", value: <KpiValue value={formatBtcUsd(market.btcUsd)} hint="Live" /> },
            {
              label: "Hashprice",
              value: (
                <KpiValue
                  value={formatHashpriceUsd(market.hashpriceUsdPerThDay)}
                  hint={market.hashpriceUsdPerThDay > 0 ? "Live" : "Stale"}
                />
              ),
            },
            {
              label: "Mining net yield",
              value: (
                <KpiValue
                  value={`${strategy.miningYieldPct.toFixed(1)}%`}
                  hint={strategy.provenance}
                />
              ),
            },
            {
              label: "USDC yield",
              value: (
                <KpiValue
                  value={`${strategy.usdcYieldPct.toFixed(1)}%`}
                  hint={strategy.usdcSource}
                />
              ),
            },
            {
              label: "Borrow drag",
              value: <KpiValue value={`${levers.borrowAprPct.toFixed(1)}% APR`} hint="Manual" />,
            },
            { label: "Fees", value: <KpiValue value={`${levers.feePct.toFixed(1)}%`} hint="Manual" /> },
          ]}
        />
      </section>

      {/* 3 · Fan chart projection */}
      {fan && fanBands.length >= 2 ? (
        <section className="flex flex-col gap-(--ct-space-3) border-t border-[var(--ct-border-soft)] py-(--ct-space-4)">
          <div className="flex flex-wrap items-baseline justify-between gap-(--ct-space-2)">
            <SectionLabel>Projection</SectionLabel>
            {horizonEnd ? (
              <span className="mono text-[length:var(--ct-text-xs)] tabular-nums ct-text-muted">
                p5 {formatFanPercentPoint(horizonEnd.p5)} · p50{" "}
                {formatFanPercentPoint(horizonEnd.p50)} · p95{" "}
                {formatFanPercentPoint(horizonEnd.p95)}
              </span>
            ) : null}
          </div>
          <p className="text-[length:var(--ct-text-nano)] ct-text-faint">
            Not guaranteed
          </p>
          <div className="min-w-0 overflow-hidden">
            <ProjectionAreaChart
              bands={fanBands}
              unit={fan.unit}
            />
          </div>
        </section>
      ) : null}

      {/* 3.5 · Dispersion (Monte-Carlo) */}
      <section className="flex flex-col gap-(--ct-space-3) border-t border-[var(--ct-border-soft)] py-(--ct-space-4)">
        <div className="flex flex-wrap items-baseline justify-between gap-(--ct-space-2)">
          <SectionLabel>Dispersion (Monte-Carlo)</SectionLabel>
        </div>
        <p className="text-[length:var(--ct-text-nano)] ct-text-faint">
          {mcMeta} · Seeded simulation · illustrative dispersion, not guaranteed
        </p>
        <div className="min-w-0">
          <MonteCarloChart
            seed={draft.quant.seed}
            paths={draft.quant.paths}
            steps={draft.quant.horizonMonths}
            expectedReturn={draft.assumptions.btc.annualDrift / 12}
            volatility={draft.assumptions.btc.annualVol / Math.sqrt(12)}
          />
        </div>
        {mc ? (
          <CollapsibleSection title={`Monte Carlo ${mc.version} disclosure`}>
            <p>{mc.note}</p>
          </CollapsibleSection>
        ) : null}
      </section>

      {/* 4 · Allocation */}
      <section className="flex flex-col gap-(--ct-space-3) border-t border-[var(--ct-border-soft)] py-(--ct-space-4)">
        <SectionLabel>Allocation</SectionLabel>
        <div
          className={cn(
            "grid min-w-0 gap-(--ct-space-3)",
            principal && alternatives.length > 0
              ? "lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]"
              : "grid-cols-1",
          )}
        >
          {principal ? (
            <div className="flex flex-col items-center rounded-(--ct-radius-lg) border border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)] px-(--ct-space-3) py-(--ct-space-3)">
              <ScenarioBlock scenario={principal} principal ringSize={118} />
            </div>
          ) : null}
          {alternatives.length > 0 ? (
            <div className="grid min-w-0 grid-cols-1 gap-(--ct-space-3) min-[420px]:grid-cols-2 lg:grid-cols-1">
              {alternatives.map((s) => (
                <div
                  key={s.regime}
                  className="flex flex-col items-center rounded-(--ct-radius-lg) border border-[var(--ct-border-soft)] px-(--ct-space-2) py-(--ct-space-2)"
                >
                  <ScenarioBlock scenario={s} ringSize={80} />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {/* 4.5 · Value Chart (if any, typically distribution) */}
      {valChart ? <ValueBarChart chart={valChart} /> : null}

      {/* 5 · Targets & guardrails */}
      <section className="flex flex-col gap-(--ct-space-3) border-t border-[var(--ct-border-soft)] py-(--ct-space-4)">
        <div className="grid min-w-0 gap-(--ct-space-3) sm:grid-cols-2">
          <TargetCard label="Monthly distribution target" value={targets.distribution} />
          <TargetCard label="Total performance target" value={targets.total} />
        </div>
        <p className="text-[length:var(--ct-text-nano)] ct-text-faint">
          Read-only draft · Not guaranteed · No record created · Manual admin validation required
        </p>
      </section>

      {/* Disclosures */}
      <CollapsibleSection title="Full thesis draft">
        <Markdown content={draft.writeup.prose} />
      </CollapsibleSection>

      {strategy.assumptions.length > 0 ? (
        <CollapsibleSection title="Configured assumptions">
          <ul className="flex flex-col gap-(--ct-space-1) pl-(--ct-space-4)">
            {strategy.assumptions.map((a) => (
              <li key={a} className="list-disc">
                {a}
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      ) : null}
    </div>
  );
}
