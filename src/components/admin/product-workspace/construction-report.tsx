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
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";
import type {
  ChartArtifact,
  LiveProvenance,
  ProductConstructionDraft,
  ScenarioResult,
} from "@/lib/agentic/swarm/live/types";
import {
  buildTimelineFromDraft,
  canRenderAllocation,
  canRenderPerformanceEngines,
  canRenderProductSummary,
  canRenderSafeScenario,
  type StageProvenance,
} from "@/lib/agentic/swarm/live/construction-timeline";
import { formatTargetsSafely } from "@/lib/products/guards";
import { BTC_MINING_PERFORMANCE_VAULT } from "@/lib/products/btc-mining-performance-vault";

/**
 * Construction Report — the sequenced, pedagogical, deterministic reveal.
 *
 *   Execution parallel.  Affichage séquencé.  One source of truth.
 *
 * The swarms run in parallel and finish in any order; this report ALWAYS reveals
 * the construction in the same fixed order (BTC market → hashprice → BTC yield →
 * USDC yield → performance engines → allocation → Safe / Balanced / Opportunistic
 * scenarios → product summary). A block whose dependencies are not ready shows a
 * skeleton — it is never reordered and never filled with invented numbers.
 *
 * Pure presentation: it renders the numbers/charts/prose the pipeline already
 * produced. The allocation it shows is the CANONICAL one — the same object the
 * wizard prefill and the write-up read. No business math, no I/O, no write.
 */

// ── provenance mapping ──────────────────────────────────────────────────────

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

// ── formatters ──────────────────────────────────────────────────────────────

/** Format a FRACTION as a percent (e.g. 0.12 → "12.0%"). */
function Pct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}

/** Format a value that is ALREADY a percent (e.g. 30 → "30.0%"). */
function pctOf(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

/** Format a signed percent value (e.g. -20 → "−20%", 40 → "+40%"). */
function signedPct(n: number): string {
  const r = Math.round(n * 10) / 10;
  const body = Number.isInteger(r) ? r.toFixed(0) : r.toFixed(1);
  return `${r >= 0 ? "+" : "−"}${Math.abs(r) === 0 ? "0" : body.replace("-", "")}%`;
}

// ── tiny presentational atoms ───────────────────────────────────────────────

interface Section {
  id: string;
  label: string;
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

/** Skeleton shown for a block whose dependencies are not ready (never reorders). */
function BlockSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-(--ct-space-2) rounded-(--ct-radius-xl) border border-dashed border-[var(--ct-border-soft)] bg-surface-page p-(--ct-space-5)">
      <span className="flex items-center gap-(--ct-space-2) ct-bento-label">
        <span
          aria-hidden
          className="h-(--ct-space-1_5) w-(--ct-space-1_5) rounded-(--ct-radius-full) bg-[var(--ct-text-faint)] animate-pulse"
        />
        {label} — waiting on inputs
      </span>
      <div className="h-(--ct-space-2) w-2/3 rounded-(--ct-radius-full) bg-[var(--ct-border-soft)]" />
      <div className="h-(--ct-space-2) w-1/2 rounded-(--ct-radius-full) bg-[var(--ct-border-soft)]" />
    </div>
  );
}

function NotGuaranteed({ extra }: { extra?: string }) {
  return (
    <p className="text-[length:var(--ct-text-xs)] ct-text-tertiary">
      Configured is not validated · read-only construction · no record created.
      {extra ? ` ${extra}` : ""}
    </p>
  );
}

// ── performance engine card (§7) ────────────────────────────────────────────

type EngineTone = "mining" | "btc" | "usdc";

const ENGINE_DOT: Record<EngineTone, string> = {
  // Mandated, constant colours: mining green / BTC orange / USDC blue.
  mining: "bg-[var(--ct-accent)]",
  btc: "bg-[var(--ct-status-warning)]",
  usdc: "bg-[var(--ct-status-info)]",
};
const ENGINE_TEXT: Record<EngineTone, string> = {
  mining: "text-[var(--ct-accent)]",
  btc: "text-[var(--ct-status-warning)]",
  usdc: "text-[var(--ct-status-info)]",
};

function EngineCard({
  tone,
  title,
  metric,
  metricLabel,
  role,
  risk,
  liquidity,
  provenance,
}: {
  tone: EngineTone;
  title: string;
  metric: string;
  metricLabel: string;
  role: string;
  risk: string;
  liquidity: string;
  provenance: LiveProvenance;
}) {
  return (
    <div className="flex flex-col gap-(--ct-space-3) rounded-(--ct-radius-xl) border border-[var(--ct-border)] bg-surface-card p-(--ct-space-4)">
      <div className="flex items-center gap-(--ct-space-2)">
        <span aria-hidden className={cn("h-(--ct-space-2) w-(--ct-space-2) rounded-(--ct-radius-full)", ENGINE_DOT[tone])} />
        <span className={cn("ct-section-label font-bold", ENGINE_TEXT[tone])}>{title}</span>
        <span className="ml-auto">
          <ProvenanceBadge kind={liveProvenanceToBadgeKind(provenance)} compact />
        </span>
      </div>
      <div className="flex flex-col gap-(--ct-space-1)">
        <span className="ct-bento-label">{metricLabel}</span>
        <span className={cn("mono text-[length:var(--ct-text-lg)] font-bold", ENGINE_TEXT[tone])}>
          {metric}
        </span>
      </div>
      <dl className="grid grid-cols-1 gap-(--ct-space-1) text-[length:var(--ct-text-xs)]">
        <div className="flex justify-between gap-(--ct-space-2)">
          <dt className="ct-text-tertiary">Role</dt>
          <dd className="ct-text-body text-right">{role}</dd>
        </div>
        <div className="flex justify-between gap-(--ct-space-2)">
          <dt className="ct-text-tertiary">Risk</dt>
          <dd className="ct-text-body text-right">{risk}</dd>
        </div>
        <div className="flex justify-between gap-(--ct-space-2)">
          <dt className="ct-text-tertiary">Liquidity</dt>
          <dd className="ct-text-body text-right">{liquidity}</dd>
        </div>
      </dl>
    </div>
  );
}

// ── scenario card (Safe hero + alternatives) ────────────────────────────────

const REGIME_LABEL: Record<ScenarioResult["regime"], string> = {
  defensive: "Safe",
  balanced: "Balanced",
  opportunistic: "Opportunistic",
};

function scenarioWarnings(s: ScenarioResult): string[] {
  const w: string[] = [];
  if (s.governanceException) w.push("Mining clamped to the 30% floor — governance review.");
  if (!s.miningProfitable) w.push("Mining underwater at current market — rotated toward the stable floor.");
  return w;
}

function ScenarioSleeves(s: ScenarioResult): HcLabeledValue[] {
  return [
    { label: "Mining", value: s.allocation.mining },
    { label: "BTC", value: s.allocation.btc },
    { label: "USDC", value: s.allocation.usdc },
    { label: "Reserve", value: s.allocation.stableReserve },
  ];
}

/** Compact alternative-scenario card. */
function ScenarioCard({ scenario }: { scenario: ScenarioResult }) {
  const warnings = scenarioWarnings(scenario);
  return (
    <div className="flex flex-col gap-(--ct-space-3) rounded-(--ct-radius-xl) border border-[var(--ct-border)] bg-surface-card p-(--ct-space-4)">
      <div className="flex items-center gap-(--ct-space-2)">
        <span className="ct-section-label ct-text-strong">{REGIME_LABEL[scenario.regime]}</span>
        {scenario.governanceException ? (
          <span className="inline-flex items-center gap-(--ct-space-1) rounded-(--ct-radius-full) border border-[var(--ct-border-soft)] px-(--ct-space-2) py-px text-[length:var(--ct-text-nano)] ct-text-tertiary">
            mining floored (governance)
          </span>
        ) : null}
      </div>
      <HcCompositionRing segments={ScenarioSleeves(scenario)} size={120} bars aria-label={`${REGIME_LABEL[scenario.regime]} scenario allocation`} />
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
            {Pct(scenario.quant.percentiles.p5)} / {Pct(scenario.quant.percentiles.p50)} / {Pct(scenario.quant.percentiles.p95)}
          </span>
        </div>
      </div>
      {warnings.length > 0 ? (
        <ul className="flex flex-col gap-(--ct-space-1) text-[length:var(--ct-text-xs)] ct-text-tertiary">
          {warnings.map((w) => (
            <li key={w}>· {w}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Safe-scenario HERO — the principal, defendable scenario (§9). */
function SafeScenarioHero({ scenario }: { scenario: ScenarioResult }) {
  const targets = formatTargetsSafely(BTC_MINING_PERFORMANCE_VAULT);
  const recovery = BTC_MINING_PERFORMANCE_VAULT.recovery;
  const warnings = scenarioWarnings(scenario);
  return (
    <div className="grid gap-(--ct-space-5) rounded-(--ct-radius-2xl) border border-[var(--ct-border-accent)] bg-surface-card p-(--ct-space-5) lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
      <div className="flex flex-col items-center gap-(--ct-space-3)">
        <span className="ct-section-label ct-text-accent">Safe scenario — headline</span>
        <HcCompositionRing segments={ScenarioSleeves(scenario)} size={168} bars aria-label="Safe scenario allocation (4 sleeves)" />
        {scenario.governanceException ? (
          <span className="inline-flex items-center gap-(--ct-space-1) rounded-(--ct-radius-full) border border-[var(--ct-border-soft)] px-(--ct-space-2) py-px text-[length:var(--ct-text-nano)] ct-text-tertiary">
            mining floored (governance review)
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-(--ct-space-3)">
        <div className="grid gap-(--ct-space-3) sm:grid-cols-3">
          <Stat label="APY range" value={`${Pct(scenario.quant.headlineRange.low)}–${Pct(scenario.quant.headlineRange.high)}`} />
          <Stat label="p5 / p50 / p95" value={`${Pct(scenario.quant.percentiles.p5)} / ${Pct(scenario.quant.percentiles.p50)} / ${Pct(scenario.quant.percentiles.p95)}`} />
          <Stat label="P(below floor)" value={`${scenario.quant.probBelowFloorPct}%`} />
        </div>
        {/* Targets — the two layers are shown SEPARATELY, never summed (#12). */}
        <div className="grid gap-(--ct-space-2) rounded-(--ct-radius-xl) border border-[var(--ct-border-soft)] bg-surface-page p-(--ct-space-4)">
          <div className="flex flex-col gap-px">
            <span className="ct-bento-label">Monthly distribution target</span>
            <span className="body-sm ct-text-body">{targets.distribution}</span>
          </div>
          <div className="flex flex-col gap-px">
            <span className="ct-bento-label">Total performance target</span>
            <span className="body-sm ct-text-body">{targets.total}</span>
          </div>
          <p className="text-[length:var(--ct-text-nano)] ct-text-faint">
            The total target is inclusive of the distributions — the two layers never sum.
          </p>
        </div>
        {/* Funding / exit / recovery — CONFIGURED product references, no fabrication. */}
        <dl className="grid grid-cols-1 gap-(--ct-space-1) text-[length:var(--ct-text-xs)] sm:grid-cols-3">
          <div className="flex flex-col gap-px rounded-(--ct-radius-lg) border border-[var(--ct-border-soft)] bg-surface-page p-(--ct-space-3)">
            <dt className="ct-bento-label">Funding decision</dt>
            <dd className="ct-text-body">Cheapest idle stable / borrow vs yield — reserve preserved (configured).</dd>
          </div>
          <div className="flex flex-col gap-px rounded-(--ct-radius-lg) border border-[var(--ct-border-soft)] bg-surface-page p-(--ct-space-3)">
            <dt className="ct-bento-label">Early-exit trigger</dt>
            <dd className="ct-text-body">Coverage &lt; 1.0 pauses distribution; &lt; 0.8 suspends (configured).</dd>
          </div>
          <div className="flex flex-col gap-px rounded-(--ct-radius-lg) border border-[var(--ct-border-soft)] bg-surface-page p-(--ct-space-3)">
            <dt className="ct-bento-label">Recovery trigger</dt>
            <dd className="ct-text-body">
              {recovery.extensionMonths.min}–{recovery.extensionMonths.max} mo capital-only extension (configured) — not a guarantee.
            </dd>
          </div>
        </dl>
        {warnings.length > 0 ? (
          <ul className="flex flex-col gap-(--ct-space-1) text-[length:var(--ct-text-xs)] ct-status-warning">
            {warnings.map((w) => (
              <li key={w}>⚠ {w}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

// ── main report ─────────────────────────────────────────────────────────────

const SECTIONS: Section[] = [
  { id: "timeline", label: "Construction timeline" },
  { id: "btc-market", label: "BTC market" },
  { id: "hashprice", label: "Hashprice" },
  { id: "btc-yield", label: "BTC yield" },
  { id: "usdc-yield", label: "USDC yield" },
  { id: "engines", label: "Performance engines" },
  { id: "allocation", label: "Allocation" },
  { id: "safe", label: "Safe scenario" },
  { id: "balanced", label: "Balanced scenario" },
  { id: "opportunistic", label: "Opportunistic scenario" },
  { id: "summary", label: "Product summary" },
  { id: "reasoning", label: "Reasoning" },
  { id: "assumptions", label: "Assumptions" },
  { id: "economics", label: "Economics" },
  { id: "writeup", label: "Write-up" },
  { id: "audit", label: "Provenance & audit" },
];

const STAGE_PROVENANCE_BADGE: Record<StageProvenance, string> = {
  LIVE: "ct-text-accent",
  ATTESTED: "ct-text-accent",
  ESTIMATED: "ct-text-secondary",
  CONFIGURED: "ct-text-secondary",
  FALLBACK: "ct-status-warning",
  UNKNOWN: "ct-text-faint",
};

export function ConstructionReport({
  draft,
  /** When true, reveal sections progressively (the "writes itself" effect). */
  animate = true,
}: {
  draft: ProductConstructionDraft;
  animate?: boolean;
}) {
  const timeline = useMemo(() => buildTimelineFromDraft(draft), [draft]);

  // Dependency gates (§13) — derived from the timeline, never time-based.
  const gates = useMemo(
    () => ({
      engines: canRenderPerformanceEngines(timeline),
      allocation: canRenderAllocation(timeline),
      safe: canRenderSafeScenario(timeline),
      summary: canRenderProductSummary(timeline),
    }),
    [timeline],
  );

  const [revealed, setRevealed] = useState(animate ? 1 : SECTIONS.length);
  useEffect(() => {
    if (!animate) return;
    if (revealed >= SECTIONS.length) return;
    const t = setTimeout(() => setRevealed((n) => n + 1), 300);
    return () => clearTimeout(t);
  }, [animate, revealed]);

  const fan = useMemo(() => draft.charts.find((c) => c.kind === "fan"), [draft.charts]);
  const allocationChart = useMemo(
    () => draft.charts.find((c) => c.kind === "allocation"),
    [draft.charts],
  );

  const scenarios = draft.scenarios ?? [];
  const safe = scenarios.find((s) => s.regime === "defensive");
  const balanced = scenarios.find((s) => s.regime === "balanced");
  const opportunistic = scenarios.find((s) => s.regime === "opportunistic");
  const ca = draft.canonicalAllocation;
  const targets = formatTargetsSafely(BTC_MINING_PERFORMANCE_VAULT);

  const indexOf = (id: string) => SECTIONS.findIndex((s) => s.id === id);
  const shows = (id: string) => indexOf(id) < revealed;

  const fanBands = (fan?.fanBands ?? []).map((b) => ({ m: b.m, p5: b.p5, p50: b.p50, p95: b.p95 }));
  const allocationSegments: HcLabeledValue[] = (allocationChart?.allocation ?? []).map((seg) => ({
    label: seg.label,
    value: seg.valuePct,
  }));

  return (
    <div className="grid gap-(--ct-space-6) lg:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
      {/* Sticky table of contents. */}
      <nav className="hidden lg:block">
        <ol className="sticky top-(--ct-space-20) flex flex-col gap-(--ct-space-1) text-[length:var(--ct-text-xs)]">
          {SECTIONS.map((s, i) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className={cn(
                  "block rounded-(--ct-radius-md) px-(--ct-space-2) py-(--ct-space-1) transition-colors",
                  i < revealed ? "ct-text-secondary hover:text-[var(--ct-accent)]" : "ct-text-faint",
                )}
              >
                {s.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <article className="flex min-w-0 flex-col gap-(--ct-space-8)">
        {/* 0 — Construction timeline (the order is fixed; swarms may finish in any order). */}
        {shows("timeline") ? (
          <section className="flex flex-col gap-(--ct-space-3)">
            <SectionHeading id="timeline">Construction timeline</SectionHeading>
            <p className="text-[length:var(--ct-text-xs)] ct-text-tertiary">
              Swarms run in parallel; the reveal is sequenced and deterministic. Each
              block waits on its inputs — nothing is reordered or invented.
            </p>
            <ol className="flex flex-wrap gap-(--ct-space-2)">
              {timeline.stages.map((st) => {
                const ready = st.status === "ready" || st.status === "fallback";
                return (
                  <li
                    key={st.id}
                    className="flex items-center gap-(--ct-space-2) rounded-(--ct-radius-full) border border-[var(--ct-border-soft)] bg-surface-page px-(--ct-space-3) py-(--ct-space-1)"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "h-(--ct-space-1_5) w-(--ct-space-1_5) rounded-(--ct-radius-full)",
                        ready ? "bg-[var(--ct-accent)]" : "bg-[var(--ct-text-faint)]",
                      )}
                    />
                    <span className="text-[length:var(--ct-text-xs)] ct-text-secondary">
                      {st.order + 1}. {st.label}
                    </span>
                    <span className={cn("text-[length:var(--ct-text-nano)]", STAGE_PROVENANCE_BADGE[st.provenance])}>
                      {st.provenance}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}

        {/* 1 — BTC market */}
        {shows("btc-market") ? (
          <section className="flex flex-col gap-(--ct-space-3)">
            <SectionHeading id="btc-market">BTC market</SectionHeading>
            <div className="grid gap-(--ct-space-3) sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="BTC spot" value={`$${Math.round(draft.market.btcUsd).toLocaleString("en-US")}`} />
              <Stat label="Bear band" value={signedPct(draft.strategy.btcReturn.bear)} />
              <Stat label="Base band" value={signedPct(draft.strategy.btcReturn.base)} />
              <Stat label="Bull band" value={signedPct(draft.strategy.btcReturn.bull)} />
            </div>
            <NotGuaranteed extra="Scenario bands are CONFIGURED, not predictions." />
          </section>
        ) : null}

        {/* 2 — Hashprice */}
        {shows("hashprice") ? (
          <section className="flex flex-col gap-(--ct-space-3)">
            <SectionHeading id="hashprice">Hashprice</SectionHeading>
            <div className="grid gap-(--ct-space-3) sm:grid-cols-2 lg:grid-cols-3">
              <Stat label="Hashprice" value={`$${draft.market.hashpriceUsdPerThDay.toFixed(3)}/TH/day`} />
              <Stat label="Mining net yield" value={pctOf(draft.strategy.miningYieldPct)} />
              <Stat label="Top machine" value={draft.telegram.topMachine ?? "—"} />
            </div>
            <p className="text-[length:var(--ct-text-xs)] ct-text-tertiary">
              Hashprice drives gross mining revenue, the net mining margin, and machine
              payback pressure. {draft.strategy.miningYieldPct > 0 ? "Mining is profitable at this hashprice." : "Mining is underwater at this hashprice."}
            </p>
          </section>
        ) : null}

        {/* 3 — BTC yield (optional, excess liquidity only) */}
        {shows("btc-yield") ? (
          <section className="flex flex-col gap-(--ct-space-3)">
            <SectionHeading id="btc-yield">BTC yield</SectionHeading>
            <div className="rounded-(--ct-radius-xl) border border-[var(--ct-border-soft)] bg-surface-page p-(--ct-space-4)">
              <p className="body-sm ct-text-body">
                BTC yield is <strong>optional</strong> and applies only to genuine excess
                BTC liquidity. Collateral-critical BTC is never used for yield.
              </p>
              <p className="mt-(--ct-space-2) text-[length:var(--ct-text-xs)] ct-text-tertiary">
                No BTC-yield venue is sourced for this construction — the BTC sleeve is held
                as collateral. (CONFIGURED — no figure invented.)
              </p>
            </div>
          </section>
        ) : null}

        {/* 4 — USDC yield */}
        {shows("usdc-yield") ? (
          <section className="flex flex-col gap-(--ct-space-3)">
            <SectionHeading id="usdc-yield">USDC yield</SectionHeading>
            <div className="grid gap-(--ct-space-3) sm:grid-cols-2 lg:grid-cols-3">
              <Stat label="Best USDC yield" value={pctOf(draft.strategy.usdcYieldPct)} />
              <Stat label="Source" value={draft.strategy.usdcSource} />
              <Stat label="DeFi median APY" value={`${draft.market.defiApyMedianPct.toFixed(2)}%`} />
            </div>
            <p className="text-[length:var(--ct-text-xs)] ct-text-tertiary">
              USDC yield is a funding / yield tool, not the product thesis.
            </p>
          </section>
        ) : null}

        {/* 5 — Performance engines (Mining green / BTC orange / USDC blue) */}
        {shows("engines") ? (
          <section className="flex flex-col gap-(--ct-space-3)">
            <SectionHeading id="engines">Performance engines — today</SectionHeading>
            {gates.engines ? (
              <>
                <div className="grid gap-(--ct-space-3) sm:grid-cols-3">
                  <EngineCard
                    tone="mining"
                    title="Mining"
                    metricLabel="Net yield"
                    metric={pctOf(draft.strategy.miningYieldPct)}
                    role="Performance engine"
                    risk="High"
                    liquidity="Low"
                    provenance={draft.strategy.provenance}
                  />
                  <EngineCard
                    tone="btc"
                    title="BTC"
                    metricLabel="Base-cycle tilt"
                    metric={signedPct(draft.strategy.btcReturn.base)}
                    role="Capital protection / collateral"
                    risk="High"
                    liquidity="High"
                    provenance="Manual"
                  />
                  <EngineCard
                    tone="usdc"
                    title="USDC"
                    metricLabel="Stable yield"
                    metric={pctOf(draft.strategy.usdcYieldPct)}
                    role="Funding / stable yield"
                    risk="Low"
                    liquidity="High"
                    provenance={draft.strategy.provenance}
                  />
                </div>
                <p className="text-[length:var(--ct-text-xs)] ct-text-tertiary">
                  Performance → <span className="ct-text-accent">Mining</span> · Protection →{" "}
                  <span className="text-[var(--ct-status-warning)]">BTC</span> · Funding →{" "}
                  <span className="text-[var(--ct-status-info)]">USDC</span>.
                </p>
              </>
            ) : (
              <BlockSkeleton label="Performance engines" />
            )}
          </section>
        ) : null}

        {/* 6 — Allocation (canonical) + raw-rejected debug */}
        {shows("allocation") ? (
          <section className="flex flex-col gap-(--ct-space-3)">
            <SectionHeading id="allocation">Allocation</SectionHeading>
            {gates.allocation && ca ? (
              <>
                <div className="grid gap-(--ct-space-4) lg:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
                  {allocationChart ? (
                    <HcChartCard
                      title={allocationChart.title}
                      source={provenanceToSource(allocationChart.provenance)}
                      height={180}
                      aria-label={allocationChart.ariaLabel}
                    >
                      <div className="p-(--ct-space-2)">
                        <HcCompositionRing segments={allocationSegments} bars aria-label={allocationChart.ariaLabel} />
                      </div>
                    </HcChartCard>
                  ) : null}
                  <div className="grid gap-(--ct-space-3) sm:grid-cols-2">
                    <Stat label={`Mining floor (band ${ca.bands.mining[0]}–${ca.bands.mining[1]}%)`} value={pctOf(ca.mining)} />
                    <Stat label={`BTC holding (band ${ca.bands.btcHoldingCollateral[0]}–${ca.bands.btcHoldingCollateral[1]}%)`} value={pctOf(ca.btcHoldingCollateral)} />
                    <Stat label={`Stable reserve (band ${ca.bands.stableReserve[0]}–${ca.bands.stableReserve[1]}%)`} value={pctOf(ca.stableReserve)} />
                    <Stat label={`Yield overlay (band ${ca.bands.yieldOverlay[0]}–${ca.bands.yieldOverlay[1]}%, excess only)`} value={pctOf(ca.yieldOverlay)} />
                  </div>
                </div>
                {ca.governanceException ? (
                  <p className="text-[length:var(--ct-text-xs)] ct-status-warning">
                    Mining was clamped to the 30% floor — flagged as a governance exception.
                  </p>
                ) : null}
                {ca.rawRejected ? (
                  <details className="rounded-(--ct-radius-lg) border border-dashed border-[var(--ct-border-soft)] bg-surface-page p-(--ct-space-3)">
                    <summary className="cursor-pointer text-[length:var(--ct-text-xs)] ct-status-warning">
                      Raw allocator output — rejected by product guard
                    </summary>
                    <div className="mt-(--ct-space-2) grid gap-(--ct-space-2) sm:grid-cols-4">
                      <Stat label="Mining (raw)" value={pctOf(ca.rawRejected.mining)} />
                      <Stat label="BTC (raw)" value={pctOf(ca.rawRejected.btcHoldingCollateral)} />
                      <Stat label="Reserve (raw)" value={pctOf(ca.rawRejected.stableReserve)} />
                      <Stat label="Overlay (raw)" value={pctOf(ca.rawRejected.yieldOverlay)} />
                    </div>
                    <p className="mt-(--ct-space-2) text-[length:var(--ct-text-nano)] ct-text-tertiary">
                      {ca.rawRejected.reason} · shown for transparency only; the canonical
                      allocation above is what every surface uses.
                    </p>
                  </details>
                ) : null}
                <NotGuaranteed />
              </>
            ) : (
              <BlockSkeleton label="Allocation" />
            )}
          </section>
        ) : null}

        {/* 7 — Safe scenario hero */}
        {shows("safe") ? (
          <section className="flex flex-col gap-(--ct-space-3)">
            <SectionHeading id="safe">Safe scenario</SectionHeading>
            {gates.safe && safe ? <SafeScenarioHero scenario={safe} /> : <BlockSkeleton label="Safe scenario" />}
          </section>
        ) : null}

        {/* 8 — Balanced scenario */}
        {shows("balanced") ? (
          <section className="flex flex-col gap-(--ct-space-3)">
            <SectionHeading id="balanced">Balanced scenario</SectionHeading>
            {gates.safe && balanced ? <ScenarioCard scenario={balanced} /> : <BlockSkeleton label="Balanced scenario" />}
          </section>
        ) : null}

        {/* 9 — Opportunistic scenario */}
        {shows("opportunistic") ? (
          <section className="flex flex-col gap-(--ct-space-3)">
            <SectionHeading id="opportunistic">Opportunistic scenario</SectionHeading>
            {gates.safe && opportunistic ? <ScenarioCard scenario={opportunistic} /> : <BlockSkeleton label="Opportunistic scenario" />}
          </section>
        ) : null}

        {/* 10 — Product summary / wizard handoff */}
        {shows("summary") ? (
          <section className="flex flex-col gap-(--ct-space-3)">
            <SectionHeading id="summary">{draft.vault.label}</SectionHeading>
            {gates.summary ? (
              <>
                <p className="body-sm ct-text-body">{draft.objective}</p>
                <div className="grid gap-(--ct-space-3) sm:grid-cols-2 lg:grid-cols-4">
                  <Stat label="Product" value={draft.vault.label} />
                  <Stat label="Ticker" value={draft.vault.ticker} />
                  <Stat label="Headline APY" value={`${Pct(draft.quant.headlineRange.low)}–${Pct(draft.quant.headlineRange.high)}`} />
                  <Stat label="Machines priced" value={String(draft.telegram.machineCount)} />
                </div>
                {ca ? (
                  <div className="grid gap-(--ct-space-3) sm:grid-cols-2 lg:grid-cols-4">
                    <Stat label="Mining" value={pctOf(ca.mining)} />
                    <Stat label="BTC holding" value={pctOf(ca.btcHoldingCollateral)} />
                    <Stat label="Stable reserve" value={pctOf(ca.stableReserve)} />
                    <Stat label="Yield overlay" value={pctOf(ca.yieldOverlay)} />
                  </div>
                ) : null}
                <div className="grid gap-(--ct-space-2) rounded-(--ct-radius-xl) border border-[var(--ct-border-soft)] bg-surface-page p-(--ct-space-4)">
                  <div className="flex flex-col gap-px">
                    <span className="ct-bento-label">Monthly distribution target</span>
                    <span className="body-sm ct-text-body">{targets.distribution}</span>
                  </div>
                  <div className="flex flex-col gap-px">
                    <span className="ct-bento-label">Total performance target</span>
                    <span className="body-sm ct-text-body">{targets.total}</span>
                  </div>
                </div>
                <p className="body-sm ct-text-body">
                  <strong>Thesis:</strong> {BTC_MINING_PERFORMANCE_VAULT.thesis}.
                </p>
                <NotGuaranteed extra="Wizard hand-off carries the canonical allocation; no record is created." />
              </>
            ) : (
              <BlockSkeleton label="Product summary" />
            )}
          </section>
        ) : null}

        {/* — Reasoning (step-by-step) */}
        {shows("reasoning") && draft.steps && draft.steps.length > 0 ? (
          <section className="flex flex-col gap-(--ct-space-3)">
            <SectionHeading id="reasoning">Reasoning</SectionHeading>
            <ol className="flex flex-col gap-(--ct-space-3)">
              {draft.steps.map((step, i) => (
                <li
                  key={step.id}
                  className="grid grid-cols-[auto_minmax(0,1fr)] gap-(--ct-space-3) rounded-(--ct-radius-xl) border border-[var(--ct-border)] bg-surface-card p-(--ct-space-4)"
                >
                  <span
                    aria-hidden
                    className="flex h-(--ct-space-6) w-(--ct-space-6) shrink-0 items-center justify-center rounded-(--ct-radius-full) border border-[var(--ct-border-accent)] mono text-[length:var(--ct-text-xs)] font-bold ct-text-accent"
                  >
                    {i + 1}
                  </span>
                  <div className="flex min-w-0 flex-col gap-(--ct-space-1)">
                    <div className="flex flex-wrap items-center gap-(--ct-space-2)">
                      <span className="ct-bento-label ct-text-strong">{step.title}</span>
                      <ProvenanceBadge kind={liveProvenanceToBadgeKind(step.provenance)} compact />
                    </div>
                    <p className="body-sm ct-text-body">{step.finding}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {/* — Projection + assumptions */}
        {shows("assumptions") ? (
          <section className="flex flex-col gap-(--ct-space-3)">
            <SectionHeading id="assumptions">Projection &amp; assumptions</SectionHeading>
            {fan ? (
              <HcChartCard
                title={fan.title}
                metric={`${Pct(draft.quant.headlineRange.low)}–${Pct(draft.quant.headlineRange.high)}`}
                source={provenanceToSource(fan.provenance)}
                disclaimer={draft.disclaimer}
                height={280}
                aria-label={fan.ariaLabel}
              >
                <HcFanChart bands={fanBands} unit={fan.unit} {...(fan.seedLabel ? { seedLabel: fan.seedLabel } : {})} aria-label={fan.ariaLabel} />
              </HcChartCard>
            ) : null}
            <div className="grid gap-(--ct-space-3) sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="BTC drift / vol" value={`${Pct(draft.assumptions.btc.annualDrift, 0)} / ${Pct(draft.assumptions.btc.annualVol, 0)}`} />
              <Stat label="Horizon" value={`${draft.assumptions.horizonMonths} mo`} />
              <Stat label="Mining weight" value={Pct(draft.assumptions.yield.miningWeight, 0)} />
              <Stat label="Paths / seed" value={`${draft.assumptions.paths.toLocaleString("en-US")} / ${draft.quant.seed}`} />
            </div>
            <ul className="list-disc pl-(--ct-space-5) body-sm ct-text-body">
              {draft.strategy.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* — Economics (raw vs allocator-adjusted) */}
        {shows("economics") && draft.economics ? (
          <section className="flex flex-col gap-(--ct-space-3)">
            <SectionHeading id="economics">Economics — raw vs allocator-adjusted</SectionHeading>
            <div className="grid gap-(--ct-space-3) sm:grid-cols-2">
              <div className="flex flex-col gap-(--ct-space-2) rounded-(--ct-radius-xl) border border-[var(--ct-border)] bg-surface-card p-(--ct-space-4)">
                <span className="ct-bento-label">Raw economics</span>
                <span className="mono text-[length:var(--ct-text-base)] font-bold ct-text-strong">
                  {pctOf(draft.economics.raw.blendedApyPct)} APY @ mining {draft.economics.raw.miningWeight}
                </span>
              </div>
              <div className="flex flex-col gap-(--ct-space-2) rounded-(--ct-radius-xl) border border-[var(--ct-border)] bg-surface-card p-(--ct-space-4)">
                <span className="ct-bento-label">Allocator-adjusted economics</span>
                <span className="mono text-[length:var(--ct-text-base)] font-bold ct-text-strong">
                  {pctOf(draft.economics.adjusted.blendedApyPct)} APY @ mining {draft.economics.adjusted.miningWeight}
                </span>
              </div>
            </div>
            {draft.economics.bugCandidate ? (
              <p className="text-[length:var(--ct-text-xs)] ct-status-danger">
                BUG CANDIDATE — adjusted APY negative despite positive stable fallback.
              </p>
            ) : null}
            <ul className="flex flex-col gap-px text-[length:var(--ct-text-xs)] ct-text-tertiary">
              {draft.economics.factors.map((f) => (
                <li key={f}>· {f}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* — Write-up */}
        {shows("writeup") ? (
          <section className="flex flex-col gap-(--ct-space-3)">
            <SectionHeading id="writeup">Write-up</SectionHeading>
            <span className="ct-bento-label">{draft.writeup.llmAuthored ? "LLM-authored" : "deterministic"}</span>
            <Markdown content={draft.writeup.prose} />
          </section>
        ) : null}

        {/* — Provenance & audit */}
        {shows("audit") ? (
          <section className="flex flex-col gap-(--ct-space-3)">
            <SectionHeading id="audit">Provenance &amp; audit</SectionHeading>
            <ul className="flex flex-col gap-(--ct-space-1) mono text-[length:var(--ct-text-xs)] ct-text-secondary">
              {draft.audit.map((a) => (
                <li
                  key={a.stageId}
                  className="grid grid-cols-[auto_minmax(0,var(--ct-space-32))_minmax(0,var(--ct-space-20))_minmax(0,1fr)] items-center gap-(--ct-space-3)"
                >
                  <span className={a.degraded ? "ct-status-warning" : "ct-text-accent"}>{a.degraded ? "○" : "●"}</span>
                  <span className="truncate">{a.stageId}</span>
                  <span className="truncate">{a.provenance}</span>
                  <span className="truncate ct-text-tertiary">{a.reasonCode}</span>
                </li>
              ))}
            </ul>
            <p className="text-[length:var(--ct-text-xs)] ct-text-tertiary">
              No product is created, sent, or deployed by this report — it is a read-only
              construction draft. {draft.disclaimer}
            </p>
          </section>
        ) : null}
      </article>
    </div>
  );
}
