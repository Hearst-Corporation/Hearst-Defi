"use client";

/**
 * Data Scientist output — the compact final "Report Product" body.
 *
 * Executive-first, chat-open friendly: short framing, canonical live inputs,
 * honest Monte Carlo fan, compact allocation, targets / guardrails, then only
 * the extra detail inside disclosures. Pure presentation — no business math, no
 * I/O, no write.
 */

import { Markdown } from "@/components/admin/markdown";
import { ProductEngineReport } from "@/components/admin/product-workspace/product-engine-report";
import { ProjectionAreaChart } from "@/components/admin/product-workspace/projection-area-chart";
import { HcCompositionRing } from "@/components/dataviz/his";
import type { HcLabeledValue } from "@/components/dataviz/his/types";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import type {
  LiveProvenance,
  ProductConstructionDraft,
  ScenarioResult,
} from "@/lib/agentic/swarm/live/types";
import { formatTargetsSafely } from "@/lib/products/guards";
import { BTC_MINING_PERFORMANCE_VAULT } from "@/lib/products/btc-mining-performance-vault";
import {
  formatApyFraction,
  formatBtcUsd,
  formatHashpriceUsd,
  formatPercentPoint,
  formatSignedPercentPoint,
} from "./report-format";

function provenanceToBadge(p: LiveProvenance): Provenance {
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
function SectionLabel({
  children,
  provenance,
}: {
  children: React.ReactNode;
  provenance?: LiveProvenance;
}) {
  return (
    <div className="flex flex-wrap items-center gap-(--ct-space-2)">
      <span className="ct-bento-label">{children}</span>
      {provenance ? <ProvenanceBadge kind={provenanceToBadge(provenance)} compact /> : null}
    </div>
  );
}

/**
 * Compact key input tile.
 */
function MetricTile({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-(--ct-space-1_5) rounded-(--ct-radius-xl) border border-[var(--ct-border)] bg-surface-card p-(--ct-space-4)">
      <span className="ct-bento-label">{label}</span>
      <span className="mono text-[length:var(--ct-text-base)] font-bold tabular-nums ct-text-strong">
        {value}
      </span>
      {note ? (
        <span className="text-[length:var(--ct-text-nano)] ct-text-tertiary">{note}</span>
      ) : null}
    </div>
  );
}

function BulletRow({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-(--ct-space-2)">
      <span aria-hidden className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-(--ct-radius-full) bg-[var(--ct-accent)]" />
      <span className="body-sm ct-text-body">{children}</span>
    </li>
  );
}

function Disclosure({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-(--ct-radius-xl) border border-[var(--ct-border-soft)] bg-surface-page px-(--ct-space-4) py-(--ct-space-3)">
      <summary className="flex cursor-pointer list-none items-center gap-(--ct-space-2) ct-bento-label transition-colors hover:ct-text-strong">
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rotate-45 border-b border-r border-current transition-transform group-open:rotate-[225deg]"
        />
        <span>{title}</span>
      </summary>
      <div className="mt-(--ct-space-3) min-w-0">{children}</div>
    </details>
  );
}

function ScenarioStats({ scenario }: { scenario: ScenarioResult }) {
  const range = `${formatApyFraction(scenario.quant.headlineRange.low)}–${formatApyFraction(scenario.quant.headlineRange.high)}`;
  const p50 = formatApyFraction(scenario.quant.percentiles.p50);
  return (
    <div className="flex flex-wrap gap-x-(--ct-space-4) gap-y-(--ct-space-1)">
      <span className="mono text-[length:var(--ct-text-sm)] tabular-nums ct-text-strong">
        APY {range}
      </span>
      <span className="mono text-[length:var(--ct-text-sm)] tabular-nums ct-text-secondary">
        p50 {p50}
        {scenario.governanceException ? " · mining floored" : ""}
      </span>
    </div>
  );
}

function SafeScenarioCard({ scenario }: { scenario: ScenarioResult }) {
  return (
    <div className="grid gap-(--ct-space-3) rounded-(--ct-radius-2xl) border border-[var(--ct-border-accent)] bg-surface-card p-(--ct-space-4) lg:grid-cols-[auto_minmax(0,1fr)]">
      <div className="flex items-center justify-center">
        <HcCompositionRing
          segments={sleeves(scenario)}
          size={124}
          centerLabel="Safe"
          centerValue="100%"
          aria-label="Safe allocation"
        />
      </div>
      <div className="flex min-w-0 flex-col justify-center gap-(--ct-space-2)">
        <div className="flex flex-wrap items-center gap-(--ct-space-2)">
          <span className="ct-section-label ct-text-accent">Safe</span>
          <span className="ct-section-label ct-text-tertiary">principal construction</span>
          {scenario.governanceException ? (
            <span className="ct-section-label ct-status-warning">mining floored</span>
          ) : null}
        </div>
        <ScenarioStats scenario={scenario} />
      </div>
    </div>
  );
}

function MiniScenarioCard({ scenario }: { scenario: ScenarioResult }) {
  return (
    <div className="flex min-w-0 flex-col gap-(--ct-space-2) rounded-(--ct-radius-xl) border border-[var(--ct-border)] bg-surface-card p-(--ct-space-3)">
      <div className="flex items-center gap-(--ct-space-2)">
        <HcCompositionRing
          segments={sleeves(scenario)}
          size={80}
          centerLabel={REGIME_LABEL[scenario.regime]}
          centerValue="100%"
          aria-label={`${REGIME_LABEL[scenario.regime]} allocation`}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-(--ct-space-1_5)">
          <div className="flex flex-wrap items-center gap-(--ct-space-2)">
            <span className="ct-section-label ct-text-strong">
              {REGIME_LABEL[scenario.regime]}
            </span>
            {scenario.governanceException ? (
              <span className="ct-section-label ct-status-warning">floored</span>
            ) : null}
          </div>
          <ScenarioStats scenario={scenario} />
        </div>
      </div>
    </div>
  );
}

function buildFramingBrief(draft: ProductConstructionDraft, headline: string): string {
  return `Read-only draft built from live market inputs and configured vault assumptions. The current construction produces a projected APY range of ${headline}, driven by mining yield, BTC scenario exposure and USDC yield. Nothing is created, deployed or sent until an admin validates the draft.`;
}

export function DataScientistOutput({
  draft,
}: {
  draft: ProductConstructionDraft;
}) {
  const scenarios = draft.scenarios ?? [];
  const principal = scenarios.find((s) => s.regime === "defensive") ?? null;
  const alternatives = scenarios.filter((s) => s.regime !== "defensive");
  const fan = draft.charts.find((c) => c.kind === "fan");
  const targets = formatTargetsSafely(BTC_MINING_PERFORMANCE_VAULT);
  const fanBands = (fan?.fanBands ?? []).map((b) => ({
    m: b.m,
    p5: b.p5,
    p50: b.p50,
    p95: b.p95,
  }));
  const headline = `${formatApyFraction(draft.quant.headlineRange.low)}–${formatApyFraction(draft.quant.headlineRange.high)}`;
  const framing = buildFramingBrief(draft, headline);
  const baseScenarioBand = `${formatSignedPercentPoint(draft.strategy.btcReturn.bear)} / ${formatSignedPercentPoint(draft.strategy.btcReturn.base)} / ${formatSignedPercentPoint(draft.strategy.btcReturn.bull)}`;
  const monteCarloNote =
    draft.monteCarloDisclosure?.note ??
    "Monte Carlo v1: static sleeve model, not monthly path-dependent rebalancing.";
  const debugPairs = [
    ["BTC spot", formatBtcUsd(draft.market.btcUsd)],
    ["Hashprice", formatHashpriceUsd(draft.market.hashpriceUsdPerThDay)],
    ["Mining yield", formatPercentPoint(draft.strategy.miningYieldPct)],
    ["USDC yield", formatPercentPoint(draft.strategy.usdcYieldPct)],
    ["Borrow drag", formatPercentPoint(draft.strategy.companyLevers.borrowAprPct)],
    ["Fees", formatPercentPoint(draft.strategy.companyLevers.feePct)],
  ] as const;

  return (
    <div className="flex min-w-0 flex-col gap-(--ct-space-5)">
      <section className="flex min-w-0 flex-col gap-(--ct-space-3)">
        <SectionLabel provenance={draft.writeup.provenance}>Framing</SectionLabel>
        <p className="body-sm max-w-3xl ct-text-body">{framing}</p>
        <ul className="grid gap-(--ct-space-2)">
          <BulletRow>
            BTC spot {formatBtcUsd(draft.market.btcUsd)} · hashprice{" "}
            {formatHashpriceUsd(draft.market.hashpriceUsdPerThDay)}
          </BulletRow>
          <BulletRow>
            Mining yield {formatPercentPoint(draft.strategy.miningYieldPct)} · USDC
            yield {formatPercentPoint(draft.strategy.usdcYieldPct)}
          </BulletRow>
          <BulletRow>Scenario band {baseScenarioBand}</BulletRow>
        </ul>
      </section>

      <section className="flex min-w-0 flex-col gap-(--ct-space-3) border-t border-[var(--ct-border-soft)] pt-(--ct-space-5)">
        <SectionLabel provenance={draft.audit.find((item) => item.stageId === "market_live")?.provenance}>
          Key live inputs
        </SectionLabel>
        <div className="grid gap-(--ct-space-3) md:grid-cols-2 xl:grid-cols-3">
          <MetricTile label="BTC spot" value={formatBtcUsd(draft.market.btcUsd)} />
          <MetricTile
            label="Hashprice"
            value={formatHashpriceUsd(draft.market.hashpriceUsdPerThDay)}
          />
          <MetricTile
            label="Mining net yield"
            value={formatPercentPoint(draft.strategy.miningYieldPct)}
          />
          <MetricTile
            label="USDC yield"
            value={formatPercentPoint(draft.strategy.usdcYieldPct)}
          />
          <MetricTile
            label="Borrow drag"
            value={formatPercentPoint(draft.strategy.companyLevers.borrowAprPct)}
          />
          <MetricTile
            label="Fees"
            value={formatPercentPoint(draft.strategy.companyLevers.feePct)}
          />
        </div>
      </section>

      {fan && fanBands.length > 0 ? (
        <section className="flex min-w-0 flex-col gap-(--ct-space-3) border-t border-[var(--ct-border-soft)] pt-(--ct-space-5)">
          <div className="flex flex-wrap items-start justify-between gap-(--ct-space-3)">
            <SectionLabel provenance={draft.quant.provenance}>
              Monte Carlo projection
            </SectionLabel>
            <div className="flex flex-col items-end gap-(--ct-space-1)">
              <span className="mono text-[length:var(--ct-text-xl-fixed)] font-bold tabular-nums ct-text-strong">
                {headline}
              </span>
              <span className="ct-metric-caption ct-text-tertiary">
                {draft.quant.paths.toLocaleString("en-US")} paths · {draft.quant.horizonMonths} months ·
                {" "}seed {draft.quant.seed}
              </span>
            </div>
          </div>
          <ProjectionAreaChart bands={fanBands} unit={fan.unit} />
          <div className="flex flex-wrap items-center gap-x-(--ct-space-5) gap-y-(--ct-space-1)">
            {(
              [
                ["p5", draft.quant.percentiles.p5],
                ["p50", draft.quant.percentiles.p50],
                ["p95", draft.quant.percentiles.p95],
              ] as const
            ).map(([label, value]) => (
              <span key={label} className="mono text-[length:var(--ct-text-sm)] tabular-nums ct-text-secondary">
                <span className="ct-metric-caption ct-text-muted">{label}</span>{" "}
                {formatApyFraction(value)}
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-(--ct-space-1)">
            <p className="text-[length:var(--ct-text-xs)] ct-text-tertiary">
              {monteCarloNote}
            </p>
            <p className="text-[length:var(--ct-text-xs)] ct-text-muted">
              Not guaranteed.
            </p>
          </div>
        </section>
      ) : null}

      {principal ? (
        <section className="flex min-w-0 flex-col gap-(--ct-space-3) border-t border-[var(--ct-border-soft)] pt-(--ct-space-5)">
          <SectionLabel provenance={draft.strategy.provenance}>Allocation</SectionLabel>
          <div className="grid min-w-0 gap-(--ct-space-4) xl:grid-cols-[minmax(0,1.2fr)_minmax(17rem,0.9fr)]">
            <SafeScenarioCard scenario={principal} />
            <div className="grid min-w-0 gap-(--ct-space-4)">
              {alternatives.map((scenario) => (
                <MiniScenarioCard key={scenario.regime} scenario={scenario} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="flex min-w-0 flex-col gap-(--ct-space-3) border-t border-[var(--ct-border-soft)] pt-(--ct-space-5)">
        <SectionLabel>Targets &amp; guardrails</SectionLabel>
        <div className="grid gap-(--ct-space-3) md:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="Monthly distribution target" value={targets.distribution} />
          <MetricTile label="Total performance target" value={targets.total} />
          <MetricTile
            label="Probability below floor"
            value={`${draft.quant.probBelowFloorPct.toFixed(1)}%`}
          />
          <MetricTile
            label="Floor"
            value={formatPercentPoint(draft.quant.floorApyPct)}
          />
        </div>
        <p className="text-[length:var(--ct-text-xs)] ct-text-tertiary">
          The total target is inclusive of the distributions — the two layers never
          sum. No record created · Manual admin validation required.
        </p>
      </section>

      <div className="flex min-w-0 flex-col gap-(--ct-space-3) border-t border-[var(--ct-border-soft)] pt-(--ct-space-5)">
        <Disclosure title="Full thesis draft">
          <Markdown content={draft.writeup.prose} />
        </Disclosure>
        <Disclosure title="Configured assumptions">
          <div className="grid gap-(--ct-space-3) sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile
              label="BTC drift"
              value={formatApyFraction(draft.assumptions.btc.annualDrift, 0)}
            />
            <MetricTile
              label="BTC volatility"
              value={formatApyFraction(draft.assumptions.btc.annualVol, 0)}
            />
            <MetricTile
              label="Mining weight"
              value={formatApyFraction(draft.assumptions.yield.miningWeight, 0)}
            />
            <MetricTile
              label="Paths / seed"
              value={`${draft.assumptions.paths.toLocaleString("en-US")} / ${draft.quant.seed}`}
            />
          </div>
          <ul className="mt-(--ct-space-3) flex flex-col gap-(--ct-space-2)">
            {draft.strategy.assumptions.map((assumption) => (
              <BulletRow key={assumption}>{assumption}</BulletRow>
            ))}
          </ul>
        </Disclosure>
        <Disclosure title="Debug values">
          <div className="grid gap-(--ct-space-3) sm:grid-cols-2 xl:grid-cols-3">
            {debugPairs.map(([label, value]) => (
              <MetricTile key={label} label={label} value={value} />
            ))}
          </div>
          <div className="mt-(--ct-space-4)">
            <ProductEngineReport draft={draft} />
          </div>
        </Disclosure>
      </div>
    </div>
  );
}
