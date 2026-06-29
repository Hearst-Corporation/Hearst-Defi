"use client";

import { useEffect, useMemo, useState } from "react";

import { Markdown } from "@/components/admin/markdown";
import {
  HcChartCard,
  HcCompositionRing,
  HcFanChart,
} from "@/components/dataviz/his";
import type {
  HcLabeledValue,
  HcSourceStatus,
} from "@/components/dataviz/his/types";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import type { Provenance } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";
import type {
  ChartArtifact,
  LiveProvenance,
  ProductConstructionDraft,
  ScenarioResult,
} from "@/lib/agentic/swarm/live/types";

/**
 * Construction Report — the draft written DIRECTLY into the workspace body as a
 * navigable document (anchored sections + a sticky table of contents), not an
 * ephemeral blob. Sections are revealed progressively on first render so the
 * report "writes itself" into the page; on a re-render (or a persisted report)
 * everything is shown at once.
 *
 * Pure presentation: it renders the numbers/charts/prose the pipeline already
 * produced. No business math, no I/O, no write — read-only.
 */

function provenanceToSource(p: ChartArtifact["provenance"]): HcSourceStatus {
  switch (p) {
    case "Live":
      return "live";
    case "Oracle":
      return "oracle";
    case "Attested":
      return "attested";
    case "Estimated":
      return "estimated";
    case "Manual":
      return "manual";
    case "Stale":
      return "stale";
  }
}

/** Map LiveProvenance (capitalized) to the ProvenanceBadge kind (lowercase). */
function liveProvenanceToBadgeKind(p: LiveProvenance): Provenance {
  switch (p) {
    case "Live":
      return "live";
    case "Oracle":
      return "oracle";
    case "Attested":
      return "attested";
    case "Estimated":
      return "estimated";
    case "Manual":
      return "manual";
    case "Stale":
      return "stale";
  }
}

interface Section {
  id: string;
  label: string;
}

const SECTIONS_BASE: Section[] = [
  { id: "summary", label: "Summary" },
  { id: "market", label: "Market inputs" },
  { id: "strategy", label: "Strategy" },
  { id: "projection", label: "Projection" },
  { id: "assumptions", label: "Assumptions" },
  { id: "writeup", label: "Write-up" },
  { id: "audit", label: "Provenance & audit" },
];
const SECTIONS_WITH_SCENARIOS: Section[] = [
  { id: "summary", label: "Summary" },
  { id: "market", label: "Market inputs" },
  { id: "strategy", label: "Strategy" },
  { id: "projection", label: "Projection" },
  { id: "scenarios", label: "Scenarios" },
  { id: "reasoning", label: "Reasoning" },
  { id: "assumptions", label: "Assumptions" },
  { id: "writeup", label: "Write-up" },
  { id: "audit", label: "Provenance & audit" },
];

function Pct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="ct-section-title scroll-mt-(--ct-space-24) border-b border-[var(--ct-border-soft)] pb-(--ct-space-2)"
    >
      {children}
    </h2>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-(--ct-space-1) rounded-(--ct-radius-xl) border border-[var(--ct-border)] bg-surface-card p-(--ct-space-4)">
      <span className="ct-bento-label">{label}</span>
      <span className="mono text-[length:var(--ct-text-base)] font-bold ct-text-strong">
        {value}
      </span>
    </div>
  );
}

/** One scenario card — allocation ring + APY range + p5/p50/p95. */
function ScenarioCard({ scenario }: { scenario: ScenarioResult }) {
  const regimeLabel: Record<ScenarioResult["regime"], string> = {
    defensive: "Defensive",
    balanced: "Balanced",
    opportunistic: "Opportunistic",
  };

  const allocationSegments: HcLabeledValue[] = [
    { label: "Mining", value: scenario.allocation.mining },
    { label: "BTC", value: scenario.allocation.btc },
    { label: "USDC", value: scenario.allocation.usdc },
    { label: "Reserve", value: scenario.allocation.stableReserve },
  ];

  const ariaLabel = `${regimeLabel[scenario.regime]} scenario allocation`;

  return (
    <div className="flex flex-col gap-(--ct-space-3) rounded-(--ct-radius-xl) border border-[var(--ct-border)] bg-surface-card p-(--ct-space-4)">
      {/* Header row: regime label + governance badge */}
      <div className="flex items-center gap-(--ct-space-2)">
        <span className="ct-section-label ct-text-strong">
          {regimeLabel[scenario.regime]}
        </span>
        {scenario.governanceException ? (
          <span className="inline-flex items-center gap-(--ct-space-1) rounded-(--ct-radius-full) border border-[var(--ct-border-soft)] px-(--ct-space-2) py-px text-[length:var(--ct-text-nano)] ct-text-tertiary">
            mining floored (governance review)
          </span>
        ) : null}
      </div>

      {/* Allocation ring */}
      <HcCompositionRing
        segments={allocationSegments}
        size={120}
        bars
        aria-label={ariaLabel}
      />

      {/* APY headline range + percentiles */}
      <div className="grid grid-cols-2 gap-(--ct-space-2)">
        <div className="flex flex-col gap-(--ct-space-1) rounded-(--ct-radius-lg) border border-[var(--ct-border-soft)] bg-surface-page p-(--ct-space-3)">
          <span className="ct-bento-label">APY range</span>
          <span className="mono text-[length:var(--ct-text-base)] font-bold ct-text-strong">
            {Pct(scenario.quant.headlineRange.low)}–{Pct(scenario.quant.headlineRange.high)}
          </span>
        </div>
        <div className="flex flex-col gap-(--ct-space-1) rounded-(--ct-radius-lg) border border-[var(--ct-border-soft)] bg-surface-page p-(--ct-space-3)">
          <span className="ct-bento-label">p5 / p50 / p95</span>
          <span className="mono text-[length:var(--ct-text-sm)] font-medium ct-text-body">
            {Pct(scenario.quant.percentiles.p5)} /{" "}
            {Pct(scenario.quant.percentiles.p50)} /{" "}
            {Pct(scenario.quant.percentiles.p95)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function ConstructionReport({
  draft,
  /** When true, reveal sections progressively (the "writes itself" effect). */
  animate = true,
}: {
  draft: ProductConstructionDraft;
  animate?: boolean;
}) {
  const hasScenarios =
    Array.isArray(draft.scenarios) && draft.scenarios.length > 0;
  const hasSteps = Array.isArray(draft.steps) && draft.steps.length > 0;

  // Pick the right section list based on whether scenarios are present.
  const SECTIONS = hasScenarios ? SECTIONS_WITH_SCENARIOS : SECTIONS_BASE;

  // Progressive reveal: show N sections, growing on a short cadence. A persisted
  // report (animate=false) shows everything immediately.
  const [revealed, setRevealed] = useState(animate ? 1 : SECTIONS.length);

  useEffect(() => {
    if (!animate) return;
    if (revealed >= SECTIONS.length) return;
    const t = setTimeout(() => setRevealed((n) => n + 1), 350);
    return () => clearTimeout(t);
  }, [animate, revealed, SECTIONS.length]);

  const fan = useMemo(
    () => draft.charts.find((c) => c.kind === "fan"),
    [draft.charts],
  );
  const allocation = useMemo(
    () => draft.charts.find((c) => c.kind === "allocation"),
    [draft.charts],
  );

  const shows = (index: number) => index < revealed;

  const fanBands = (fan?.fanBands ?? []).map((b) => ({
    m: b.m,
    p5: b.p5,
    p50: b.p50,
    p95: b.p95,
  }));

  const allocationSegments: HcLabeledValue[] = (allocation?.allocation ?? []).map(
    (seg) => ({ label: seg.label, value: seg.valuePct }),
  );

  // Section index lookup — position shifts when scenarios are inserted.
  const idx = {
    summary: 0,
    market: 1,
    strategy: 2,
    projection: 3,
    scenarios: hasScenarios ? 4 : -1,
    reasoning: hasScenarios ? 5 : -1,
    assumptions: hasScenarios ? 6 : 4,
    writeup: hasScenarios ? 7 : 5,
    audit: hasScenarios ? 8 : 6,
  } as const;

  return (
    <div className="grid gap-(--ct-space-6) lg:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
      {/* Sticky table of contents — navigable. */}
      <nav className="hidden lg:block">
        <ol className="sticky top-(--ct-space-20) flex flex-col gap-(--ct-space-1) text-[length:var(--ct-text-xs)]">
          {SECTIONS.map((s, i) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className={cn(
                  "block rounded-(--ct-radius-md) px-(--ct-space-2) py-(--ct-space-1) transition-colors",
                  shows(i)
                    ? "ct-text-secondary hover:text-[var(--ct-accent)]"
                    : "ct-text-faint",
                )}
              >
                {s.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <article className="flex min-w-0 flex-col gap-(--ct-space-8)">
        {/* 1 — Summary */}
        {shows(idx.summary) ? (
          <section className="flex flex-col gap-(--ct-space-3)">
            <SectionHeading id="summary">{draft.vault.label} — construction report</SectionHeading>
            <p className="body-sm ct-text-body">{draft.objective}</p>
            <div className="grid gap-(--ct-space-3) sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Headline APY"
                value={`${Pct(draft.quant.headlineRange.low)}–${Pct(draft.quant.headlineRange.high)}`}
              />
              <Stat label="Vault" value={draft.vault.ticker} />
              <Stat
                label="P(below floor)"
                value={`${draft.quant.probBelowFloorPct}%`}
              />
              <Stat
                label="Machines priced"
                value={String(draft.telegram.machineCount)}
              />
            </div>
            <p className="text-[length:var(--ct-text-xs)] ct-text-tertiary">
              {draft.disclaimer}
            </p>
          </section>
        ) : null}

        {/* 2 — Market inputs */}
        {shows(idx.market) ? (
          <section className="flex flex-col gap-(--ct-space-3)">
            <SectionHeading id="market">Market inputs</SectionHeading>
            <div className="grid gap-(--ct-space-3) sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="BTC spot"
                value={`$${Math.round(draft.market.btcUsd).toLocaleString("en-US")}`}
              />
              <Stat
                label="Hashprice"
                value={`$${draft.market.hashpriceUsdPerThDay.toFixed(3)}/TH`}
              />
              <Stat
                label="DeFi USDC APY"
                value={`${draft.market.defiApyMedianPct.toFixed(2)}%`}
              />
              <Stat
                label="Top machine"
                value={draft.telegram.topMachine ?? "—"}
              />
            </div>
          </section>
        ) : null}

        {/* 3 — Strategy */}
        {shows(idx.strategy) ? (
          <section className="flex flex-col gap-(--ct-space-3)">
            <SectionHeading id="strategy">Strategy</SectionHeading>
            <div className="grid gap-(--ct-space-3) sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Mining yield"
                value={`${draft.strategy.miningYieldPct.toFixed(1)}%`}
              />
              <Stat
                label="USDC yield"
                value={`${draft.strategy.usdcYieldPct.toFixed(1)}% (${draft.strategy.usdcSource})`}
              />
              <Stat
                label="Markup / rev-share"
                value={`${draft.strategy.companyLevers.markupPct}% / ${draft.strategy.companyLevers.revenueSharePct}%`}
              />
              <Stat
                label="Energy"
                value={`$${draft.strategy.companyLevers.energyCostUsdPerKwh}/kWh`}
              />
            </div>
            {allocation ? (
              <HcChartCard
                title={allocation.title}
                source={provenanceToSource(allocation.provenance)}
                height={160}
                aria-label={allocation.ariaLabel}
              >
                <div className="p-(--ct-space-2)">
                  <HcCompositionRing
                    segments={allocationSegments}
                    bars
                    aria-label={allocation.ariaLabel}
                  />
                </div>
              </HcChartCard>
            ) : null}
          </section>
        ) : null}

        {/* 4 — Projection */}
        {shows(idx.projection) ? (
          <section className="flex flex-col gap-(--ct-space-3)">
            <SectionHeading id="projection">Projection</SectionHeading>
            {fan ? (
              <HcChartCard
                title={fan.title}
                metric={`${Pct(draft.quant.headlineRange.low)}–${Pct(draft.quant.headlineRange.high)}`}
                source={provenanceToSource(fan.provenance)}
                disclaimer={draft.disclaimer}
                height={300}
                aria-label={fan.ariaLabel}
              >
                <HcFanChart
                  bands={fanBands}
                  unit={fan.unit}
                  {...(fan.seedLabel ? { seedLabel: fan.seedLabel } : {})}
                  aria-label={fan.ariaLabel}
                />
              </HcChartCard>
            ) : null}
            <div className="grid gap-(--ct-space-3) sm:grid-cols-3 lg:grid-cols-5">
              <Stat label="p5" value={Pct(draft.quant.percentiles.p5)} />
              <Stat label="p25" value={Pct(draft.quant.percentiles.p25)} />
              <Stat label="p50" value={Pct(draft.quant.percentiles.p50)} />
              <Stat label="p75" value={Pct(draft.quant.percentiles.p75)} />
              <Stat label="p95" value={Pct(draft.quant.percentiles.p95)} />
            </div>
          </section>
        ) : null}

        {/* 5 — Scenarios (defensive / balanced / opportunistic) — optional */}
        {hasScenarios && shows(idx.scenarios) ? (
          <section className="flex flex-col gap-(--ct-space-3)">
            <SectionHeading id="scenarios">Scenarios</SectionHeading>
            <p className="text-[length:var(--ct-text-xs)] ct-text-tertiary">
              Three regime allocations derived from live inputs. Each is an
              independent Monte-Carlo run — APY is always a range, never a
              single point. Not a projection of actual returns.
            </p>
            <div className="grid gap-(--ct-space-3) sm:grid-cols-3">
              {draft.scenarios!.map((s) => (
                <ScenarioCard key={s.regime} scenario={s} />
              ))}
            </div>
          </section>
        ) : null}

        {/* 6 — Reasoning / step-by-step — optional */}
        {hasSteps && shows(idx.reasoning) ? (
          <section className="flex flex-col gap-(--ct-space-3)">
            <SectionHeading id="reasoning">Reasoning</SectionHeading>
            <ol className="flex flex-col gap-(--ct-space-3)">
              {draft.steps!.map((step, i) => (
                <li
                  key={step.id}
                  className="grid grid-cols-[auto_minmax(0,1fr)] gap-(--ct-space-3) rounded-(--ct-radius-xl) border border-[var(--ct-border)] bg-surface-card p-(--ct-space-4)"
                >
                  {/* Step number */}
                  <span
                    aria-hidden
                    className="flex h-(--ct-space-6) w-(--ct-space-6) shrink-0 items-center justify-center rounded-(--ct-radius-full) border border-[var(--ct-border-accent)] mono text-[length:var(--ct-text-xs)] font-bold ct-text-accent"
                  >
                    {i + 1}
                  </span>
                  <div className="flex min-w-0 flex-col gap-(--ct-space-1)">
                    <div className="flex flex-wrap items-center gap-(--ct-space-2)">
                      <span className="ct-bento-label ct-text-strong">
                        {step.title}
                      </span>
                      <ProvenanceBadge
                        kind={liveProvenanceToBadgeKind(step.provenance)}
                        compact
                      />
                    </div>
                    <p className="body-sm ct-text-body">{step.finding}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {/* 7 — Assumptions */}
        {shows(idx.assumptions) ? (
          <section className="flex flex-col gap-(--ct-space-3)">
            <SectionHeading id="assumptions">Assumptions (regime)</SectionHeading>
            <div className="grid gap-(--ct-space-3) sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="BTC drift / vol"
                value={`${Pct(draft.assumptions.btc.annualDrift, 0)} / ${Pct(draft.assumptions.btc.annualVol, 0)}`}
              />
              <Stat
                label="Horizon"
                value={`${draft.assumptions.horizonMonths} mo`}
              />
              <Stat
                label="Mining weight"
                value={Pct(draft.assumptions.yield.miningWeight, 0)}
              />
              <Stat
                label="Paths / seed"
                value={`${draft.assumptions.paths.toLocaleString("en-US")} / ${draft.quant.seed}`}
              />
            </div>
            <ul className="list-disc pl-(--ct-space-5) body-sm ct-text-body">
              {draft.strategy.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* 8 — Write-up */}
        {shows(idx.writeup) ? (
          <section className="flex flex-col gap-(--ct-space-3)">
            <SectionHeading id="writeup">Write-up</SectionHeading>
            <span className="ct-bento-label">
              {draft.writeup.llmAuthored ? "LLM-authored" : "deterministic"}
            </span>
            <Markdown content={draft.writeup.prose} />
          </section>
        ) : null}

        {/* 9 — Provenance & audit */}
        {shows(idx.audit) ? (
          <section className="flex flex-col gap-(--ct-space-3)">
            <SectionHeading id="audit">Provenance &amp; audit</SectionHeading>
            <ul className="flex flex-col gap-(--ct-space-1) mono text-[length:var(--ct-text-xs)] ct-text-secondary">
              {draft.audit.map((a) => (
                <li
                  key={a.stageId}
                  className="grid grid-cols-[auto_minmax(0,var(--ct-space-32))_minmax(0,var(--ct-space-20))_minmax(0,1fr)] items-center gap-(--ct-space-3)"
                >
                  <span className={a.degraded ? "ct-status-warning" : "ct-text-accent"}>
                    {a.degraded ? "○" : "●"}
                  </span>
                  <span className="truncate">{a.stageId}</span>
                  <span className="truncate">{a.provenance}</span>
                  <span className="truncate ct-text-tertiary">{a.reasonCode}</span>
                </li>
              ))}
            </ul>
            <p className="text-[length:var(--ct-text-xs)] ct-text-tertiary">
              No product is created, sent, or deployed by this report — it is a
              read-only construction draft. {draft.disclaimer}
            </p>
          </section>
        ) : null}
      </article>
    </div>
  );
}
