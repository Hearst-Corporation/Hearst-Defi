"use client";

/**
 * Data Scientist output — the final step's body.
 *
 * Renders what the data-scientist specialist produced from the assembled draft:
 * the written thesis, the live projection fan (p5/p50/p95), and the allocation as
 * a principal scenario + two alternatives. Pure presentation — it renders only
 * the numbers/charts/prose the pipeline already produced; no business math, no
 * I/O, no write. Token-only (`--ct-*`), dark, no hardcoded colours/fonts.
 */

import { Markdown } from "@/components/admin/markdown";
import { HcChartCard, HcCompositionRing, HcFanChart } from "@/components/dataviz/his";
import type { HcLabeledValue } from "@/components/dataviz/his/types";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import type {
  LiveProvenance,
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
function liveToBadge(p: LiveProvenance): Provenance {
  switch (p) {
    case "Live": return "live";
    case "Oracle": return "oracle";
    case "Attested": return "attested";
    case "Estimated": return "estimated";
    case "Manual": return "manual";
    case "Stale": return "stale";
  }
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

function ScenarioCard({ scenario, principal }: { scenario: ScenarioResult; principal?: boolean }) {
  return (
    <div
      className={
        "flex flex-col gap-(--ct-space-3) rounded-(--ct-radius-xl) bg-surface-card p-(--ct-space-4) " +
        (principal ? "border border-[var(--ct-border-accent)]" : "border border-[var(--ct-border)]")
      }
    >
      <div className="flex items-center gap-(--ct-space-2)">
        <span className="ct-section-label ct-text-strong">{REGIME_LABEL[scenario.regime]}</span>
        {principal ? (
          <span className="ct-section-label ct-text-accent">· principal</span>
        ) : null}
        {scenario.governanceException ? (
          <span className="ml-auto inline-flex items-center rounded-(--ct-radius-full) border border-[var(--ct-border-soft)] px-(--ct-space-2) py-px text-[length:var(--ct-text-nano)] ct-text-tertiary">
            mining floored
          </span>
        ) : null}
      </div>
      <HcCompositionRing
        segments={sleeves(scenario)}
        size={principal ? 160 : 120}
        bars
        aria-label={`${REGIME_LABEL[scenario.regime]} allocation`}
      />
      <div className="grid grid-cols-2 gap-(--ct-space-2)">
        <div className="flex flex-col gap-(--ct-space-1) rounded-(--ct-radius-lg) border border-[var(--ct-border-soft)] bg-surface-page p-(--ct-space-3)">
          <span className="ct-bento-label">APY range</span>
          <span className="mono text-[length:var(--ct-text-base)] font-bold ct-text-strong">
            {pctFrac(scenario.quant.headlineRange.low)}–{pctFrac(scenario.quant.headlineRange.high)}
          </span>
        </div>
        <div className="flex flex-col gap-(--ct-space-1) rounded-(--ct-radius-lg) border border-[var(--ct-border-soft)] bg-surface-page p-(--ct-space-3)">
          <span className="ct-bento-label">p5 / p50 / p95</span>
          <span className="mono text-[length:var(--ct-text-sm)] font-medium ct-text-body">
            {pctFrac(scenario.quant.percentiles.p5)} / {pctFrac(scenario.quant.percentiles.p50)} /{" "}
            {pctFrac(scenario.quant.percentiles.p95)}
          </span>
        </div>
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

  return (
    <div className="flex flex-col gap-(--ct-space-6)">
      {/* Thesis */}
      <section className="flex flex-col gap-(--ct-space-2)">
        <span className="ct-bento-label">
          Thesis · {draft.writeup.llmAuthored ? "written by the data scientist" : "deterministic draft"}
        </span>
        <Markdown content={draft.writeup.prose} />
      </section>

      {/* Projection fan */}
      {fan ? (
        <section className="flex flex-col gap-(--ct-space-2)">
          <HcChartCard
            title={fan.title}
            metric={`${pctFrac(draft.quant.headlineRange.low)}–${pctFrac(draft.quant.headlineRange.high)}`}
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
        </section>
      ) : null}

      {/* Allocation — principal + 2 versions */}
      <section className="flex flex-col gap-(--ct-space-3)">
        <span className="ct-bento-label">Allocation — principal + 2 versions</span>
        <div className="grid gap-(--ct-space-4) lg:grid-cols-3">
          {principal ? <ScenarioCard scenario={principal} principal /> : null}
          {alternatives.map((s) => (
            <ScenarioCard key={s.regime} scenario={s} />
          ))}
        </div>
        {ca ? (
          <div className="grid gap-(--ct-space-3) sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-(--ct-space-1) rounded-(--ct-radius-lg) border border-[var(--ct-border)] bg-surface-card p-(--ct-space-3)">
              <span className="ct-bento-label">Mining</span>
              <span className="mono font-bold ct-text-strong">{pctOf(ca.mining)}</span>
            </div>
            <div className="flex flex-col gap-(--ct-space-1) rounded-(--ct-radius-lg) border border-[var(--ct-border)] bg-surface-card p-(--ct-space-3)">
              <span className="ct-bento-label">BTC holding</span>
              <span className="mono font-bold ct-text-strong">{pctOf(ca.btcHoldingCollateral)}</span>
            </div>
            <div className="flex flex-col gap-(--ct-space-1) rounded-(--ct-radius-lg) border border-[var(--ct-border)] bg-surface-card p-(--ct-space-3)">
              <span className="ct-bento-label">Stable reserve</span>
              <span className="mono font-bold ct-text-strong">{pctOf(ca.stableReserve)}</span>
            </div>
            <div className="flex flex-col gap-(--ct-space-1) rounded-(--ct-radius-lg) border border-[var(--ct-border)] bg-surface-card p-(--ct-space-3)">
              <span className="ct-bento-label">Yield overlay</span>
              <span className="mono font-bold ct-text-strong">{pctOf(ca.yieldOverlay)}</span>
            </div>
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
          <p className="text-[length:var(--ct-text-nano)] ct-text-faint">
            The total target is inclusive of the distributions — the two layers never sum.
          </p>
        </div>
      </section>

      {/* Provenance & audit */}
      <section className="flex flex-col gap-(--ct-space-2)">
        <span className="ct-bento-label">Provenance &amp; audit</span>
        <ul className="flex flex-col gap-(--ct-space-1) mono text-[length:var(--ct-text-xs)] ct-text-secondary">
          {draft.audit.map((a) => (
            <li key={a.stageId} className="flex items-center gap-(--ct-space-3)">
              <span className={a.degraded ? "ct-status-warning" : "ct-text-accent"}>{a.degraded ? "○" : "●"}</span>
              <span className="min-w-(--ct-space-32) truncate">{a.stageId}</span>
              <ProvenanceBadge kind={liveToBadge(a.provenance)} compact />
              <span className="truncate ct-text-tertiary">{a.reasonCode}</span>
            </li>
          ))}
        </ul>
        <p className="text-[length:var(--ct-text-xs)] ct-text-tertiary">{draft.disclaimer}</p>
      </section>
    </div>
  );
}
