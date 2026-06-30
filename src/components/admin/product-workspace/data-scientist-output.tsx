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
import { ProjectionAreaChart } from "@/components/admin/product-workspace/projection-area-chart";
import { HcCompositionRing } from "@/components/dataviz/his";
import type { HcLabeledValue } from "@/components/dataviz/his/types";
import { BentoKpiStrip } from "@/components/catalyst/bento";
import type {
  ProductConstructionDraft,
  ScenarioResult,
} from "@/lib/agentic/swarm/live/types";
import { formatTargetsSafely } from "@/lib/products/guards";
import { BTC_MINING_PERFORMANCE_VAULT } from "@/lib/products/btc-mining-performance-vault";

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

function sleeves(s: ScenarioResult): HcLabeledValue[] {
  return [
    { label: "Mining", value: s.allocation.mining },
    { label: "BTC", value: s.allocation.btc },
    { label: "USDC", value: s.allocation.usdc },
    { label: "Reserve", value: s.allocation.stableReserve },
  ];
}

/** A section heading — uppercase micro label, used between hairline-separated blocks. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <span className="ct-bento-label">{children}</span>;
}

/**
 * One allocation scenario — a BARE ring + its figures, NO card box. Scenarios sit
 * side by side separated by the grid gap; the principal is marked by an accent dot.
 */
function ScenarioBlock({
  scenario,
  principal,
}: {
  scenario: ScenarioResult;
  principal?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-(--ct-space-3)">
      <div className="flex items-center gap-(--ct-space-2)">
        {principal ? (
          <span aria-hidden className="h-(--ct-space-1_5) w-(--ct-space-1_5) rounded-(--ct-radius-full) bg-[var(--ct-accent)]" />
        ) : null}
        <span className="ct-section-label ct-text-strong">{REGIME_LABEL[scenario.regime]}</span>
        {scenario.governanceException ? (
          <span className="ct-section-label ct-text-tertiary">· mining floored</span>
        ) : null}
      </div>
      <HcCompositionRing
        segments={sleeves(scenario)}
        size={principal ? 150 : 132}
        bars
        aria-label={`${REGIME_LABEL[scenario.regime]} allocation`}
      />
      <div className="flex flex-col items-center gap-px text-center">
        <span className="mono text-[length:var(--ct-text-base)] font-bold ct-text-strong">
          {pctFrac(scenario.quant.headlineRange.low)}–{pctFrac(scenario.quant.headlineRange.high)}
        </span>
        <span className="mono text-[length:var(--ct-text-xs)] ct-text-tertiary">
          p5 {pctFrac(scenario.quant.percentiles.p5)} · p50 {pctFrac(scenario.quant.percentiles.p50)} · p95 {pctFrac(scenario.quant.percentiles.p95)}
        </span>
      </div>
    </div>
  );
}

export function DataScientistOutput({ draft }: { draft: ProductConstructionDraft }) {
  const scenarios = draft.scenarios ?? [];
  const principal = scenarios.find((s) => s.regime === "defensive");
  const alternatives = scenarios.filter((s) => s.regime !== "defensive");
  const fan = draft.charts.find((c) => c.kind === "fan");
  const ca = draft.canonicalAllocation;
  const targets = formatTargetsSafely(BTC_MINING_PERFORMANCE_VAULT);
  const fanBands = (fan?.fanBands ?? []).map((b) => ({ m: b.m, p5: b.p5, p50: b.p50, p95: b.p95 }));
  const headline = `${pctFrac(draft.quant.headlineRange.low)}–${pctFrac(draft.quant.headlineRange.high)}`;

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
            <SectionLabel>{fan.title}</SectionLabel>
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

      {/* Allocation scenarios — bare rings side by side, no boxes. */}
      <section className="flex flex-col gap-(--ct-space-5) border-t border-[var(--ct-border-soft)] py-(--ct-space-6)">
        <SectionLabel>Allocation — principal + 2 versions</SectionLabel>
        <div className="grid gap-(--ct-space-6) sm:grid-cols-2 lg:grid-cols-3">
          {principal ? <ScenarioBlock scenario={principal} principal /> : null}
          {alternatives.map((s) => (
            <ScenarioBlock key={s.regime} scenario={s} />
          ))}
        </div>
      </section>

      {/* Canonical allocation — the canonical KPI strip (same primitive as every
          other KPI surface), soldered edge to edge. */}
      {ca ? (
        <section className="border-t border-[var(--ct-border-soft)]">
          <BentoKpiStrip
            ariaLabel="Canonical allocation"
            items={[
              { label: "Mining", value: pctOf(ca.mining) },
              { label: "BTC holding", value: pctOf(ca.btcHoldingCollateral) },
              { label: "Stable reserve", value: pctOf(ca.stableReserve) },
              { label: "Yield overlay", value: pctOf(ca.yieldOverlay) },
            ]}
          />
        </section>
      ) : null}

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
        <p className="text-[length:var(--ct-text-xs)] ct-text-tertiary leading-relaxed">
          {draft.disclaimer}
        </p>
      </section>
    </div>
  );
}
