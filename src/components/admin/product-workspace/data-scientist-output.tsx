"use client";

/**
 * Data Scientist output — the "Report Product" body.
 *
 * Renders what the data-scientist specialist produced from the assembled draft:
 * the written thesis, the live projection fan (p5/p50/p95), the allocation
 * scenarios, and the provenance audit. Pure presentation — only the
 * numbers/charts/prose the pipeline already produced; no business math, no I/O,
 * no write.
 *
 * DESIGN: token-only (`--ct-*`), dark. NO nested boxes — sections are separated
 * by hairlines, KPIs use the canonical `BentoKpiStrip`, and charts render bare
 * (no card frame around them). Flat, calm, DS-aligned.
 */

import { Markdown } from "@/components/admin/markdown";
import { MonteCarloChart } from "@/components/admin/product-workspace/monte-carlo-chart";
import { ProjectionAreaChart } from "@/components/admin/product-workspace/projection-area-chart";
import { BentoKpiStrip } from "@/components/catalyst/bento";
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

function canonicalAllocationData(
  draft: ProductConstructionDraft,
): AllocationDatum[] | null {
  const ca = draft.canonicalAllocation;
  if (!ca) return null;
  return [
    { label: "Mining", value: ca.mining, fill: ALLOCATION_FILL_BY_INDEX[0] },
    {
      label: "BTC holding",
      value: ca.btcHoldingCollateral,
      fill: ALLOCATION_FILL_BY_INDEX[1],
    },
    {
      label: "Stable reserve",
      value: ca.stableReserve,
      fill: ALLOCATION_FILL_BY_INDEX[2],
    },
    {
      label: "Yield overlay",
      value: ca.yieldOverlay,
      fill: ALLOCATION_FILL_BY_INDEX[3],
    },
  ];
}

function rangePct(low: number, high: number, digits = 1): string {
  return `${pctFrac(low, digits)}–${pctFrac(high, digits)}`;
}

/** A section heading — uppercase micro label, used between hairline-separated blocks. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <span className="ct-bento-label">{children}</span>;
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
      className="mx-auto aspect-square h-[208px] w-full max-w-[208px]"
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
          innerRadius={58}
          outerRadius={88}
          paddingAngle={2}
          stroke="var(--ct-surface-card)"
          strokeWidth={1.5}
          isAnimationActive={false}
        >
          {data.map((item) => (
            <Cell key={item.label} fill={item.fill} />
          ))}
          <Label
            position="center"
            content={({ viewBox }) =>
              viewBox && "cx" in viewBox && "cy" in viewBox ? (
                <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
                  <tspan
                    x={viewBox.cx}
                    y={viewBox.cy}
                    className="fill-[var(--ct-text-strong)] mono text-[length:var(--ct-text-base)] font-bold"
                  >
                    100%
                  </tspan>
                  <tspan
                    x={viewBox.cx}
                    dy={18}
                    className="fill-[var(--ct-text-muted)] text-[length:var(--ct-text-nano)] uppercase tracking-[0.24em]"
                  >
                    {centerLabel}
                  </tspan>
                </text>
              ) : null
            }
          />
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
              className="h-(--ct-space-2_5) w-(--ct-space-2_5) rounded-[3px]"
              style={{ backgroundColor: item.fill }}
            />
            <span className="ct-metric-caption ct-text-muted">{item.label}</span>
          </span>
          <span className="mono text-[length:var(--ct-text-xs)] tabular-nums ct-text-strong">
            {pctOf(item.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ScenarioBlock({
  title,
  caption,
  apyRange,
  data,
  highlight = false,
  percentileLine,
}: {
  title: string;
  caption?: string;
  apyRange?: string;
  data: AllocationDatum[];
  highlight?: boolean;
  percentileLine?: string;
}) {
  return (
    <div className="flex flex-col gap-(--ct-space-4)">
      <div className="flex items-center gap-(--ct-space-2)">
        {highlight ? (
          <span
            aria-hidden
            className="h-(--ct-space-1_5) w-(--ct-space-1_5) rounded-(--ct-radius-full) bg-[var(--ct-accent)]"
          />
        ) : null}
        <span className="ct-section-label ct-text-strong">{title}</span>
        {caption ? (
          <span className="ct-section-label ct-text-tertiary">· {caption}</span>
        ) : null}
      </div>
      <AllocationDonut data={data} centerLabel={title} />
      {apyRange ? (
        <div className="flex flex-col gap-px text-center">
          <span className="mono text-[length:var(--ct-text-base)] font-bold ct-text-strong">
            {apyRange}
          </span>
          {percentileLine ? (
            <span className="mono text-[length:var(--ct-text-xs)] ct-text-tertiary">
              {percentileLine}
            </span>
          ) : null}
        </div>
      ) : null}
      <AllocationLegend data={data} />
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
  const canonicalData = canonicalAllocationData(draft);
  const monteCarloExpectedReturn = draft.quant.percentiles.p50;
  const monteCarloVolatility = draft.assumptions.btc.annualVol;

  return (
    <div className="flex flex-col">
      {/* Thesis — prose, no box. */}
      <section className="flex flex-col gap-(--ct-space-3) pb-(--ct-space-6)">
        <SectionLabel>
          Thesis · {draft.writeup.llmAuthored ? "written by the data scientist" : "deterministic draft"}
        </SectionLabel>
        <Markdown content={draft.writeup.prose} />
      </section>

      {/* Projection — area chart (recharts on the DS) of the real p5/p50/p95 fan.
          The headline range + a label sit above; the disclaimer below. */}
      {fan ? (
        <section className="flex flex-col gap-(--ct-space-3) border-t border-[var(--ct-border-soft)] py-(--ct-space-6)">
          <div className="flex items-baseline justify-between gap-(--ct-space-4)">
            <div className="flex min-w-0 items-center gap-(--ct-space-3)">
              <SectionLabel>{fan.title}</SectionLabel>
              {fan.seedLabel ? (
                <span className="ct-section-label ct-text-tertiary">
                  {fan.seedLabel}
                </span>
              ) : null}
            </div>
            <span className="mono text-[length:var(--ct-text-xl-fixed)] font-bold tabular-nums ct-text-strong">
              {headline}
            </span>
          </div>
          <ProjectionAreaChart bands={fanBands} unit={fan.unit} />
          <p className="text-[length:var(--ct-text-xs)] ct-text-muted leading-relaxed">
            {draft.disclaimer}
          </p>
        </section>
      ) : null}

      {/* Allocation scenarios — ONE harmonised chart grammar for all regimes +
          the canonical mix. No cards-in-cards: just a regular grid and hairline
          sections. */}
      <section className="flex flex-col gap-(--ct-space-5) border-t border-[var(--ct-border-soft)] py-(--ct-space-6)">
        <SectionLabel>Allocation — scenarios + canonical mix</SectionLabel>
        <div className="grid gap-x-(--ct-space-6) gap-y-(--ct-space-8) lg:grid-cols-2 xl:grid-cols-4">
          {scenarios.map((scenario) => (
            <ScenarioBlock
              key={scenario.regime}
              title={REGIME_LABEL[scenario.regime]}
              caption={scenario.governanceException ? "mining floored" : undefined}
              apyRange={rangePct(
                scenario.quant.headlineRange.low,
                scenario.quant.headlineRange.high,
              )}
              percentileLine={`p5 ${pctFrac(scenario.quant.percentiles.p5)} · p50 ${pctFrac(scenario.quant.percentiles.p50)} · p95 ${pctFrac(scenario.quant.percentiles.p95)}`}
              data={scenarioAllocationData(scenario)}
              highlight={scenario.regime === "defensive"}
            />
          ))}
          {canonicalData ? (
            <ScenarioBlock
              title="Canonical"
              caption={draft.canonicalAllocation?.governanceException ? "governance floor" : "published mix"}
              data={canonicalData}
            />
          ) : null}
        </div>
      </section>

      {/* Monte-Carlo dispersion — same draft seed, horizon and assumptions, but
          rendered as a dense spaghetti texture on a flat report section. */}
      <section className="flex flex-col gap-(--ct-space-4) border-t border-[var(--ct-border-soft)] py-(--ct-space-6)">
        <div className="flex flex-wrap items-baseline justify-between gap-(--ct-space-3)">
          <SectionLabel>Dispersion (Monte-Carlo)</SectionLabel>
          <span className="mono text-[length:var(--ct-text-xs)] tabular-nums ct-text-tertiary">
            seed {draft.quant.seed} · {draft.quant.paths.toLocaleString("en-US")} paths ·{" "}
            {draft.quant.horizonMonths} months · σ {pctFrac(monteCarloVolatility)}
          </span>
        </div>
        <MonteCarloChart
          bare
          showHeader={false}
          initialValue={100_000}
          horizonMonths={draft.quant.horizonMonths}
          expectedAnnualReturn={monteCarloExpectedReturn}
          annualVolatility={monteCarloVolatility}
          seed={draft.quant.seed}
          renderedPaths={220}
          reportedPaths={draft.quant.paths}
          caption="Sample capital base normalised to $100k · seeded path texture for relative dispersion only · not guaranteed."
        />
      </section>

      {/* Targets — plain label/value lines, no box. */}
      <section className="flex flex-col gap-(--ct-space-3) border-t border-[var(--ct-border-soft)] py-(--ct-space-6)">
        <div className="grid gap-(--ct-space-4) sm:grid-cols-2">
          <div className="flex flex-col gap-(--ct-space-1)">
            <SectionLabel>Monthly distribution target</SectionLabel>
            <span className="body-sm ct-text-body">{targets.distribution}</span>
          </div>
          <div className="flex flex-col gap-(--ct-space-1)">
            <SectionLabel>Total performance target</SectionLabel>
            <span className="body-sm ct-text-body">{targets.total}</span>
          </div>
        </div>
        <p className="text-[length:var(--ct-text-nano)] ct-text-faint">
          The total target is inclusive of the distributions — the two layers never sum.
        </p>
      </section>

      {/* Projection disclaimer — mandatory "not guaranteed" line (non-negotiable
          #10). The provenance/audit stage list was removed at the admin's request. */}
      <section className="border-t border-[var(--ct-border-soft)] pt-(--ct-space-6)">
        <BentoKpiStrip
          ariaLabel="Projection controls"
          items={[
            {
              label: "Headline APY",
              value: headline,
              accent: true,
            },
            {
              label: "p50 path",
              value: pctFrac(draft.quant.percentiles.p50),
            },
            {
              label: "Prob. below floor",
              value: `${draft.quant.probBelowFloorPct.toFixed(1)}%`,
            },
            {
              label: "Floor",
              value: pctOf(draft.quant.floorApyPct),
            },
          ]}
        />
        <p className="pt-(--ct-space-4) text-[length:var(--ct-text-xs)] ct-text-tertiary leading-relaxed">
          {draft.disclaimer}
        </p>
      </section>
    </div>
  );
}
