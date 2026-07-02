"use client";

/**
 * StrategyWorkspaceClient — the Strategy Studio as an AGENT-DRIVEN advisor.
 *
 * Owner mandate (2026-07-02): the operator does NOT set the allocation —
 * the agent does. Anchored on TODAY's BTC price (Chainlink → CoinGecko,
 * provenance surfaced), the allocator grid-searches the real engine under the
 * 30% mining floor and proposes three candidates (Recommended / Defensive /
 * Aggressive). One screen, four zones:
 *
 *   1. AGENT PANEL  — recommended allocation + the concrete PRICE POINTS in
 *                     dollars (delever LTV, hard liquidation, reverse-DCA
 *                     steps) derived from today's price.
 *   2. MAIN CHART   — one chart, all candidates overlaid, metric filters
 *                     (Equity / LTV / Liq. distance / Drawdown), p5–p95 band
 *                     on the focused candidate.
 *   3. RESULTS      — Monte Carlo KPI strip for the focused candidate.
 *   4. RESULTS TABLE — one live engine row per candidate; click to focus.
 *
 * Everything is seeded, modelled, labelled not-guaranteed.
 */

import { useMemo, useState, useCallback, useEffect } from "react";

import { AdminSectionCard } from "@/components/admin/admin-page-shell";
import { BentoKpiStrip } from "@/components/catalyst/bento";
import { CockpitButton } from "@/components/catalyst/cockpit-button";
import {
  SegmentedControl,
  type SegmentedItem,
} from "@/components/catalyst/segmented-control";
import { HcChartCard } from "@/components/dataviz/his/HcChartCard";
import { cn } from "@/lib/cn";
import type { ProductStrategy } from "@/lib/product-strategies";
import { bpsToPct } from "@/lib/product-strategies";
import { SCENARIO_DOT } from "@/lib/product-strategies/lab-colors";
import { useStrategyStore } from "@/components/admin/strategies/use-strategy-store";
import {
  StrategyStudioChart,
  type StudioChartSeries,
  type StudioChartBandPoint,
  type StudioChartRefLine,
} from "@/components/admin/strategies/strategy-studio-chart";
import { AllocationMiniBar } from "@/components/admin/strategies/strategy-card-charts";
import { runManualStrategyProjection } from "@/lib/scenario-runner";
import {
  ForwardSimulationRunner,
  computeMetrics,
  recommendAllocation,
  derivePricePoints,
  projectionForAllocation,
  collateralForAllocation,
  rescaleRulesToPrice,
  ALLOCATOR_MINING_FLOOR_BPS,
  type AllocationCandidate,
} from "@/lib/strategy-data-lab";
import { saveStrategyWorkspace, archiveStrategy, publishStrategy } from "@/app/admin/strategies/actions";
import type { StrategyWorkspaceData } from "@/app/admin/strategies/queries";

const STATUS_LABEL: Record<string, string> = {
  active: "Live",
  draft: "Draft",
  archived: "Archived",
};

type CandidateKey = AllocationCandidate["key"];

/** Candidate colors reuse the scenario palette (documented exceptions). */
const CANDIDATE_COLOR: Record<CandidateKey, string> = {
  defensive: SCENARIO_DOT.safe,
  recommended: SCENARIO_DOT.balanced,
  aggressive: SCENARIO_DOT.opportunistic,
};

type ChartMetric = "equity" | "ltv" | "distance" | "drawdown";

const METRIC_ITEMS: ReadonlyArray<SegmentedItem<ChartMetric>> = [
  { value: "equity", label: "Net Equity" },
  { value: "ltv", label: "LTV" },
  { value: "distance", label: "Liq. Distance" },
  { value: "drawdown", label: "Drawdown" },
];

const MC_PATHS = 150;
const MC_SEED = 42;

const bps = (n: number) => `${(n / 100).toFixed(1)}%`;
const pctTick = (v: number) => `${v.toFixed(1)}%`;
const usdKTick = (v: number) =>
  Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(1)}M` : `$${Math.round(v)}k`;
const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export function StrategyWorkspaceClient({
  initialWorkspace,
  allInitialStrategies,
  btcPriceUsd,
  btcPriceProvenance,
}: {
  initialWorkspace: StrategyWorkspaceData;
  allInitialStrategies: ProductStrategy[];
  /** Today's BTC price (Chainlink → CoinGecko fallback), fetched server-side. */
  btcPriceUsd: number;
  btcPriceProvenance: string;
}) {
  const store = useStrategyStore(allInitialStrategies);
  const initialStrategy = initialWorkspace.strategy;

  useEffect(() => {
    if (store.selectedId !== initialStrategy.id) {
      store.select(initialStrategy.id);
    }
  }, [initialStrategy.id, store]);

  const strategy =
    store.strategies.find((s) => s.id === initialStrategy.id) ?? initialStrategy;

  const [metric, setMetric] = useState<ChartMetric>("equity");
  const [focusKey, setFocusKey] = useState<CandidateKey>("recommended");
  const [visible, setVisible] = useState<Record<CandidateKey, boolean>>({
    recommended: true,
    defensive: true,
    aggressive: true,
  });
  const [adopted, setAdopted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mutating, setMutating] = useState(false);

  const now = useCallback(() => new Date().toISOString(), []);

  const baseCollateral = initialWorkspace.collateral;
  const baseRules = initialWorkspace.rules;

  // ---- THE AGENT: allocation recommendation (grid search, real engine) -------
  const candidates = useMemo(
    () =>
      recommendAllocation({
        btcPriceUsd,
        collateral: baseCollateral,
        rules: baseRules,
        baseAssumptions: strategy.scenarios.balanced.assumptions,
      }),
    [btcPriceUsd, baseCollateral, baseRules, strategy.scenarios.balanced.assumptions],
  );

  const recommended = candidates.find((c) => c.key === "recommended")!;
  const focused = candidates.find((c) => c.key === focusKey) ?? recommended;

  // Concrete dollar levels of the house collateral strategy, from today.
  const pricePoints = useMemo(
    () => derivePricePoints(btcPriceUsd, baseCollateral, baseRules),
    [btcPriceUsd, baseCollateral, baseRules],
  );

  const startLtvPct =
    (baseCollateral.initialDebtUsdc /
      (baseCollateral.initialBtcCollateral * btcPriceUsd)) *
    100;

  // ---- Engine runs per candidate (seed 1 → chart lines + table metrics) ------
  const candidateRuns = useMemo(
    () =>
      candidates.map((c) => {
        const projection = projectionForAllocation(
          c.allocation,
          c.assumptions,
          btcPriceUsd,
        );
        const collateral = collateralForAllocation(baseCollateral, c.allocation);
        const rules = rescaleRulesToPrice(baseRules, btcPriceUsd).map((r) => ({
          ...r,
          scenario: "balanced" as const,
        }));
        const report = runManualStrategyProjection({
          scenario: "balanced",
          collateral,
          projection,
          rules,
          seed: 1,
        });
        const metrics = computeMetrics(report, collateral, projection);
        return { candidate: c, report, metrics };
      }),
    [candidates, btcPriceUsd, baseCollateral, baseRules],
  );

  // Monte Carlo for the FOCUSED candidate — KPI strip + equity band.
  const forward = useMemo(() => {
    return new ForwardSimulationRunner().run({
      scenario: "balanced",
      collateral: collateralForAllocation(baseCollateral, focused.allocation),
      projection: projectionForAllocation(
        focused.allocation,
        focused.assumptions,
        btcPriceUsd,
      ),
      rules: rescaleRulesToPrice(baseRules, btcPriceUsd).map((r) => ({
        ...r,
        scenario: "balanced" as const,
      })),
      monteCarlo: {
        enabled: true,
        paths: MC_PATHS,
        seed: MC_SEED,
        confidenceBands: [0.05, 0.5, 0.95],
        includeJumpRisk: false,
        includeElectricityShock: false,
        includeBorrowAprShock: false,
      },
    });
  }, [focused, btcPriceUsd, baseCollateral, baseRules]);

  // ---- Chart series ----------------------------------------------------------
  const chartSeries = useMemo<StudioChartSeries[]>(
    () =>
      candidateRuns
        .filter(({ candidate }) => candidate.key === focusKey || visible[candidate.key])
        .map(({ candidate, report, metrics: m }) => {
          let points;
          if (metric === "equity") {
            points = report.snapshots.map((s) => ({ m: s.month, v: s.netEquityUsdc / 1000 }));
          } else if (metric === "ltv") {
            points = report.snapshots.map((s) => ({ m: s.month, v: s.ltvBps / 100 }));
          } else if (metric === "distance") {
            points = report.snapshots.map((s) => ({
              m: s.month,
              v: s.liquidationDistanceBps / 100,
            }));
          } else {
            points = m.underwaterBps.map((b, i) => ({ m: i, v: -(b / 100) }));
          }
          return {
            key: candidate.key,
            label: candidate.label,
            color: CANDIDATE_COLOR[candidate.key],
            points,
            active: candidate.key === focusKey,
          };
        }),
    [candidateRuns, metric, visible, focusKey],
  );

  const chartBand = useMemo<StudioChartBandPoint[] | undefined>(
    () =>
      metric === "equity"
        ? forward.monthlyEquityBands.map((b) => ({
            m: b.m,
            lo: b.p5 / 1000,
            hi: b.p95 / 1000,
          }))
        : undefined,
    [metric, forward.monthlyEquityBands],
  );

  const refLines = useMemo(() => {
    if (metric === "distance") return [{ value: 0, label: "Liquidation", tone: "danger" as const }];
    if (metric !== "ltv") return undefined;
    const lines: StudioChartRefLine[] = [
      {
        value: baseCollateral.liquidationLtvBps / 100,
        label: `Liquidation ${(baseCollateral.liquidationLtvBps / 100).toFixed(0)}%`,
        tone: "danger",
      },
    ];
    const delever = baseRules.find(
      (r) => r.type === "LIQUIDATE" && r.triggerMetric === "LTV" && r.enabled,
    );
    if (delever) {
      lines.push({
        value: delever.value / 100,
        label: `Delever ${(delever.value / 100).toFixed(0)}%`,
        tone: "warning",
      });
    }
    const buyback = baseRules.find(
      (r) => r.type === "REPURCHASE" && r.action.maxLtvAfterActionBps !== undefined && r.enabled,
    );
    if (buyback?.action.maxLtvAfterActionBps !== undefined) {
      lines.push({
        value: buyback.action.maxLtvAfterActionBps / 100,
        label: `Buy-back cap ${(buyback.action.maxLtvAfterActionBps / 100).toFixed(0)}%`,
        tone: "warning",
      });
    }
    return lines;
  }, [metric, baseCollateral.liquidationLtvBps, baseRules]);

  const chartFormat = metric === "equity" ? usdKTick : pctTick;

  const metricTitle: Record<ChartMetric, string> = {
    equity: "Net Equity ($k)",
    ltv: "Loan-to-Value (%)",
    distance: "Liquidation Distance (%)",
    drawdown: "Drawdown (%)",
  };

  // ---- Handlers ----------------------------------------------------------------
  const toggleCandidate = useCallback(
    (key: CandidateKey) => {
      if (key === focusKey) return; // focused candidate is always plotted
      setVisible((v) => ({ ...v, [key]: !v[key] }));
    },
    [focusKey],
  );

  /**
   * Adopt & Save — write the agent's three candidates into the strategy
   * (defensive → safe, recommended → balanced, aggressive → opportunistic)
   * and persist the workspace.
   */
  const handleAdoptAndSave = useCallback(async () => {
    setSaving(true);
    try {
      const byKey = Object.fromEntries(candidates.map((c) => [c.key, c]));
      const next: ProductStrategy = {
        ...strategy,
        defaultRiskProfile: "balanced",
        scenarios: {
          safe: {
            ...strategy.scenarios.safe,
            allocation: byKey.defensive!.allocation,
            assumptions: byKey.defensive!.assumptions,
          },
          balanced: {
            ...strategy.scenarios.balanced,
            allocation: byKey.recommended!.allocation,
            assumptions: byKey.recommended!.assumptions,
          },
          opportunistic: {
            ...strategy.scenarios.opportunistic,
            allocation: byKey.aggressive!.allocation,
            assumptions: byKey.aggressive!.assumptions,
          },
        },
        updatedAt: now(),
      };
      store.update(strategy.id, {
        scenarios: next.scenarios,
        defaultRiskProfile: next.defaultRiskProfile,
        updatedAt: next.updatedAt,
      });
      await saveStrategyWorkspace(next, initialWorkspace.collateral, initialWorkspace.rules);
      setAdopted(true);
    } catch {
      // Save rejected — the UI keeps showing the un-adopted state honestly.
    } finally {
      setSaving(false);
    }
  }, [candidates, strategy, store, now, initialWorkspace.collateral, initialWorkspace.rules]);

  const handleMakeLive = useCallback(async () => {
    setMutating(true);
    try {
      await publishStrategy(strategy.id);
      store.publish(strategy.id);
    } catch {
      // Server rejected — keep the local status honest.
    } finally {
      setMutating(false);
    }
  }, [strategy.id, store]);

  const handleArchive = useCallback(async () => {
    setMutating(true);
    try {
      await archiveStrategy(strategy.id);
      store.archive(strategy.id);
    } catch {
      // Same contract as publish: no local flip on server failure.
    } finally {
      setMutating(false);
    }
  }, [strategy.id, store]);

  const statusLabel = STATUS_LABEL[strategy.status] ?? strategy.status;

  return (
    <div className="flex flex-col gap-(--ct-space-5) min-w-0">
      <AdminSectionCard
        title="Strategy Studio"
        subtitle={`${strategy.name} · ${statusLabel} — agent-allocated · BTC ${usd(btcPriceUsd)} today (${btcPriceProvenance}) · mining floor ${(ALLOCATOR_MINING_FLOOR_BPS / 100).toFixed(0)}%`}
        headerTrailing={
          <div className="flex flex-wrap items-center justify-end gap-(--ct-space-2)">
            {adopted ? (
              <span className="text-[length:var(--ct-text-2xs)] ct-text-accent">
                Adopted ✓
              </span>
            ) : null}
            <CockpitButton
              variant="ghost"
              size="sm"
              onClick={handleArchive}
              disabled={mutating || strategy.status === "archived"}
            >
              Archive
            </CockpitButton>
            {strategy.status === "draft" && (
              <CockpitButton
                variant="secondary"
                size="sm"
                onClick={handleMakeLive}
                disabled={mutating}
              >
                Publish
              </CockpitButton>
            )}
            <CockpitButton
              variant="primary"
              size="sm"
              onClick={handleAdoptAndSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Adopt & Save"}
            </CockpitButton>
          </div>
        }
      >
        <div className="@container min-w-0">
          {/* Zones 1–3: agent panel | chart + results */}
          <div className="grid min-w-0 gap-(--ct-space-4) p-5 lg:p-6 @[56rem]:grid-cols-[minmax(17rem,20rem)_minmax(0,1fr)]">
            {/* 1 — AGENT PANEL */}
            <aside className="flex min-w-0 flex-col gap-(--ct-space-4) rounded-(--ct-radius-xl) border border-[var(--ct-border-soft)] bg-[var(--ct-surface-card)] p-(--ct-space-4)">
              <div className="flex flex-col gap-(--ct-space-2)">
                <div className="flex items-center justify-between gap-(--ct-space-2)">
                  <span className="ct-bento-label">Agent allocation</span>
                  <span className="text-[length:var(--ct-text-2xs)] ct-text-accent font-medium">
                    Recommended
                  </span>
                </div>
                <AllocationMiniBar allocation={recommended.allocation} />
                <p className="text-[length:var(--ct-text-2xs)] leading-relaxed ct-text-tertiary">
                  {recommended.rationale}
                </p>
              </div>

              <div className="flex flex-col gap-(--ct-space-2)">
                <div className="flex items-center justify-between gap-(--ct-space-2)">
                  <span className="ct-bento-label">Price points — today</span>
                  <span className="text-[length:var(--ct-text-2xs)] ct-text-muted tabular-nums">
                    LTV now {startLtvPct.toFixed(1)}%
                  </span>
                </div>
                <ul className="flex flex-col gap-(--ct-space-2)">
                  {pricePoints.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-baseline justify-between gap-(--ct-space-2)"
                    >
                      <span
                        className={cn(
                          "min-w-0 text-[length:var(--ct-text-2xs)] leading-snug",
                          p.tone === "danger" && "text-[var(--ct-status-danger)]",
                          p.tone === "warning" && "text-[var(--ct-status-warning)]",
                          p.tone === "accent" && "ct-text-accent",
                        )}
                      >
                        {p.label}
                      </span>
                      <span className="shrink-0 text-[length:var(--ct-text-xs)] font-semibold ct-text-strong tabular-nums">
                        {usd(p.priceUsd)}
                        <span className="ml-(--ct-space-1) text-[length:var(--ct-text-2xs)] font-normal ct-text-muted">
                          {p.movePct > 0 ? "+" : ""}
                          {p.movePct}%
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-[length:var(--ct-text-2xs)] ct-text-faint">
                  Levels derived from the live rules and today&apos;s price — they move
                  with the market.
                </p>
              </div>
            </aside>

            {/* 2 + 3 — MAIN CHART with filters, then RESULTS strip */}
            <div className="flex min-w-0 flex-col gap-(--ct-space-4)">
              <div className="flex flex-wrap items-center justify-between gap-(--ct-space-3)">
                <SegmentedControl
                  items={METRIC_ITEMS}
                  value={metric}
                  onChange={setMetric}
                  ariaLabel="Chart metric"
                  variant="tablist"
                />
                <div
                  className="flex flex-wrap items-center gap-(--ct-space-2)"
                  role="group"
                  aria-label="Candidate visibility filters"
                >
                  {candidates.map((c) => {
                    const shown = c.key === focusKey || visible[c.key];
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => toggleCandidate(c.key)}
                        aria-pressed={shown}
                        disabled={c.key === focusKey}
                        title={
                          c.key === focusKey
                            ? "Focused candidate — always plotted"
                            : shown
                              ? `Hide ${c.label}`
                              : `Show ${c.label}`
                        }
                        className={cn(
                          "inline-flex items-center gap-(--ct-space-1_5) rounded-(--ct-radius-full) border px-(--ct-space-2_5) py-(--ct-space-1) text-[length:var(--ct-text-2xs)] font-medium transition-colors",
                          shown
                            ? "border-[var(--ct-border-soft)] ct-text-strong"
                            : "border-[var(--ct-border-soft)] ct-text-muted opacity-[var(--ct-opacity-50)]",
                          c.key !== focusKey && "cursor-pointer hover:ct-text-strong",
                        )}
                      >
                        <span
                          aria-hidden
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: CANDIDATE_COLOR[c.key] }}
                        />
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <HcChartCard
                title={metricTitle[metric]}
                subtitle={`Candidates overlaid · ${focused.label} focused${metric === "equity" ? " · p5–p95 band" : ""} · BTC start ${usd(btcPriceUsd)} · seed ${MC_SEED}`}
                metric={bps(forward.finalRoiPercentilesBps.p50 ?? 0)}
                metricCompact
                source="estimated"
                state="ready"
                height={240}
                aria-label={`Strategy studio main chart — ${metricTitle[metric]}`}
              >
                <StrategyStudioChart
                  series={chartSeries}
                  {...(chartBand ? { band: chartBand } : {})}
                  format={chartFormat}
                  {...(refLines ? { refLines } : {})}
                  aria-label={`${metricTitle[metric]} — one line per candidate over 24 months`}
                />
              </HcChartCard>

              <BentoKpiStrip
                ariaLabel="Focused candidate simulation results"
                items={[
                  {
                    label: "p50 ROI",
                    value: bps(forward.finalRoiPercentilesBps.p50 ?? 0),
                    accent: true,
                    provenance: "estimated",
                  },
                  {
                    label: "p5 ROI",
                    value: bps(forward.finalRoiPercentilesBps.p5 ?? 0),
                    provenance: "estimated",
                  },
                  {
                    label: "p95 ROI",
                    value: bps(forward.finalRoiPercentilesBps.p95 ?? 0),
                    provenance: "estimated",
                  },
                  {
                    // POLICY activity, not ruin: probability of touching the
                    // 45% delever rule at least once over the horizon.
                    label: "Delever prob.",
                    value: bps(forward.liquidationProbabilityBps),
                    provenance: "estimated",
                  },
                ]}
              />
            </div>
          </div>

          {/* 4 — RESULTS TABLE */}
          <div className="flex min-w-0 flex-col gap-(--ct-space-3) border-t border-[var(--ct-border-soft)] px-5 py-(--ct-space-4) lg:px-6">
            <div className="flex items-center justify-between gap-(--ct-space-2)">
              <span className="ct-bento-label">Agent candidates — live engine runs</span>
              <span className="text-[length:var(--ct-text-2xs)] ct-text-muted">
                Click a row to focus
              </span>
            </div>

            <div className="min-w-0 overflow-x-auto">
              <table className="w-full border-collapse text-[length:var(--ct-text-xs)] tabular-nums">
                <thead>
                  <tr className="border-b border-[var(--ct-border-soft)] ct-text-tertiary">
                    <th className="p-(--ct-space-2) text-left">Candidate</th>
                    <th className="p-(--ct-space-2) text-left">Mix</th>
                    <th className="p-(--ct-space-2) text-right">p50 ROI</th>
                    <th className="p-(--ct-space-2) text-right">p5</th>
                    <th className="p-(--ct-space-2) text-right">p95</th>
                    <th className="p-(--ct-space-2) text-right">Delever prob.</th>
                    <th className="p-(--ct-space-2) text-right">Max DD</th>
                    <th className="p-(--ct-space-2) text-right">Max LTV</th>
                  </tr>
                </thead>
                <tbody>
                  {candidateRuns.map(({ candidate: c, metrics: m }) => {
                    const isFocused = c.key === focusKey;
                    return (
                      <tr
                        key={c.key}
                        onClick={() => setFocusKey(c.key)}
                        aria-selected={isFocused}
                        className={cn(
                          "cursor-pointer border-b border-[var(--ct-border-soft)] transition-colors",
                          isFocused
                            ? "bg-[color-mix(in_srgb,var(--ct-accent)_6%,transparent)]"
                            : "hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_2%,transparent)]",
                        )}
                      >
                        <td className="p-(--ct-space-2)">
                          <span className="flex items-center gap-(--ct-space-2)">
                            <span
                              aria-hidden
                              className="h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ background: CANDIDATE_COLOR[c.key] }}
                            />
                            <span className={cn("font-medium", isFocused ? "ct-text-accent" : "ct-text-strong")}>
                              {c.label}
                            </span>
                          </span>
                        </td>
                        <td className="p-(--ct-space-2) min-w-32">
                          <AllocationMiniBar allocation={c.allocation} showLegend={false} />
                        </td>
                        <td className={cn("p-(--ct-space-2) text-right", c.p50RoiBps >= 0 ? "ct-text-accent" : "text-[var(--ct-status-danger)]")}>
                          {bps(c.p50RoiBps)}
                        </td>
                        <td className="p-(--ct-space-2) text-right ct-text-body">{bps(c.p5RoiBps)}</td>
                        <td className="p-(--ct-space-2) text-right ct-text-body">{bps(c.p95RoiBps)}</td>
                        <td className={cn("p-(--ct-space-2) text-right", c.liquidationProbabilityBps > 2500 ? "text-[var(--ct-status-danger)]" : "ct-text-body")}>
                          {bps(c.liquidationProbabilityBps)}
                        </td>
                        <td className="p-(--ct-space-2) text-right ct-text-body">{bps(m.maxDrawdownBps)}</td>
                        <td className={cn("p-(--ct-space-2) text-right", m.maxLtvBps > 7000 ? "text-[var(--ct-status-danger)]" : "ct-text-body")}>
                          {bps(m.maxLtvBps)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-[length:var(--ct-text-2xs)] ct-text-faint">
              Agent allocation under the {(ALLOCATOR_MINING_FLOOR_BPS / 100).toFixed(0)}%
              mining floor · grid-searched on the deterministic engine · seeded,
              modelled ({MC_PATHS} paths · seed {MC_SEED} · 24-month horizon) —
              conditional on stated assumptions, not guaranteed. Allocation mix per
              sleeve: mining {bpsToPct(recommended.allocation.miningBps).toFixed(0)}% ·
              BTC {bpsToPct(recommended.allocation.btcBps).toFixed(0)}% · stable{" "}
              {bpsToPct(recommended.allocation.stableReserveBps).toFixed(0)}% · overlay{" "}
              {bpsToPct(recommended.allocation.yieldOverlayBps).toFixed(0)}%.
            </p>
          </div>
        </div>
      </AdminSectionCard>
    </div>
  );
}
