"use client";

import { useEffect, useMemo, useState } from "react";

import { Markdown } from "@/components/admin/markdown";
import { HcChartCard, HcFanChart } from "@/components/dataviz/his";
import type { HcSourceStatus } from "@/components/dataviz/his/types";
import { cn } from "@/lib/cn";
import type {
  ChartArtifact,
  ProductConstructionDraft,
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

interface Section {
  id: string;
  label: string;
}

const SECTIONS: Section[] = [
  { id: "summary", label: "Summary" },
  { id: "market", label: "Market inputs" },
  { id: "strategy", label: "Strategy" },
  { id: "projection", label: "Projection" },
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
      className="ct-section-title scroll-mt-24 border-b border-[var(--ct-border-soft)] pb-2"
    >
      {children}
    </h2>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-[var(--ct-border)] bg-surface-card p-4">
      <span className="ct-bento-label">{label}</span>
      <span className="font-mono text-base font-bold text-[var(--ct-text-strong)]">
        {value}
      </span>
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
  // Progressive reveal: show N sections, growing on a short cadence. A persisted
  // report (animate=false) shows everything immediately.
  const [revealed, setRevealed] = useState(animate ? 1 : SECTIONS.length);

  useEffect(() => {
    if (!animate) return;
    if (revealed >= SECTIONS.length) return;
    const t = setTimeout(() => setRevealed((n) => n + 1), 350);
    return () => clearTimeout(t);
  }, [animate, revealed]);

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

  return (
    <div className="grid gap-6 lg:grid-cols-[180px_1fr]">
      {/* Sticky table of contents — navigable. */}
      <nav className="hidden lg:block">
        <ol className="sticky top-20 flex flex-col gap-1 text-xs">
          {SECTIONS.map((s, i) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className={cn(
                  "block rounded-md px-2 py-1",
                  shows(i)
                    ? "text-[var(--ct-text-secondary)] hover:text-[var(--ct-accent)]"
                    : "text-[var(--ct-text-faint)]",
                )}
              >
                {s.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <article className="flex min-w-0 flex-col gap-8">
        {/* 1 — Summary */}
        {shows(0) ? (
          <section className="flex flex-col gap-3">
            <SectionHeading id="summary">{draft.vault.label} — construction report</SectionHeading>
            <p className="body-sm ct-text-body">{draft.objective}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
            <p className="text-xs text-[var(--ct-text-tertiary)]">
              {draft.disclaimer}
            </p>
          </section>
        ) : null}

        {/* 2 — Market inputs */}
        {shows(1) ? (
          <section className="flex flex-col gap-3">
            <SectionHeading id="market">Market inputs</SectionHeading>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
        {shows(2) ? (
          <section className="flex flex-col gap-3">
            <SectionHeading id="strategy">Strategy</SectionHeading>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                height={120}
                aria-label={allocation.ariaLabel}
              >
                <div className="flex flex-col gap-2 p-2">
                  {(allocation.allocation ?? []).map((seg, i) => (
                    <div key={seg.label} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-xs text-[var(--ct-text-secondary)]">
                        <span>{seg.label}</span>
                        <span className="font-mono text-[var(--ct-text-strong)]">
                          {seg.valuePct}%
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-surface-page">
                        <div
                          className="h-2 rounded-full"
                          style={{
                            width: `${Math.min(100, seg.valuePct)}%`,
                            background:
                              i === 0
                                ? "var(--ct-accent)"
                                : "var(--ct-status-info)",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </HcChartCard>
            ) : null}
          </section>
        ) : null}

        {/* 4 — Projection */}
        {shows(3) ? (
          <section className="flex flex-col gap-3">
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
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Stat label="p5" value={Pct(draft.quant.percentiles.p5)} />
              <Stat label="p25" value={Pct(draft.quant.percentiles.p25)} />
              <Stat label="p50" value={Pct(draft.quant.percentiles.p50)} />
              <Stat label="p75" value={Pct(draft.quant.percentiles.p75)} />
              <Stat label="p95" value={Pct(draft.quant.percentiles.p95)} />
            </div>
          </section>
        ) : null}

        {/* 5 — Assumptions */}
        {shows(4) ? (
          <section className="flex flex-col gap-3">
            <SectionHeading id="assumptions">Assumptions (regime)</SectionHeading>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
            <ul className="list-disc pl-5 body-sm ct-text-body">
              {draft.strategy.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* 6 — Write-up */}
        {shows(5) ? (
          <section className="flex flex-col gap-3">
            <SectionHeading id="writeup">Write-up</SectionHeading>
            <span className="ct-bento-label">
              {draft.writeup.llmAuthored ? "LLM-authored" : "deterministic"}
            </span>
            <Markdown content={draft.writeup.prose} />
          </section>
        ) : null}

        {/* 7 — Provenance & audit */}
        {shows(6) ? (
          <section className="flex flex-col gap-3">
            <SectionHeading id="audit">Provenance &amp; audit</SectionHeading>
            <ul className="flex flex-col gap-1 font-mono text-xs text-[var(--ct-text-secondary)]">
              {draft.audit.map((a) => (
                <li key={a.stageId} className="flex items-center gap-3">
                  <span
                    className={
                      a.degraded
                        ? "text-[var(--ct-status-warning)]"
                        : "text-[var(--ct-accent)]"
                    }
                  >
                    {a.degraded ? "○" : "●"}
                  </span>
                  <span className="w-40 shrink-0">{a.stageId}</span>
                  <span className="w-20 shrink-0">{a.provenance}</span>
                  <span className="text-[var(--ct-text-tertiary)]">
                    {a.reasonCode}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-[var(--ct-text-tertiary)]">
              No product is created, sent, or deployed by this report — it is a
              read-only construction draft. {draft.disclaimer}
            </p>
          </section>
        ) : null}
      </article>
    </div>
  );
}
