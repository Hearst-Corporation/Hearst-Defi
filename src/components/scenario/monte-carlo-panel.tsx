"use client";

/**
 * MonteCarloPanel — Scenario Lab Monte Carlo tab (methodology v2.0, ADR-006).
 *
 * Calls the pure runMonteCarlo engine (seed-injected, no I/O).
 * Displays a fan chart with p5/p50/p95 bands rendered as inline SVG.
 * Headline APY is ALWAYS a range [p25–p75] — never a single point (#1).
 *
 * Gated by FEATURE_FLAGS.ENABLE_MONTE_CARLO — render only when flag is ON.
 */

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptySurface } from "@/components/ui/empty-surface";
import { NestedPanel } from "@/components/ui/nested-panel";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";
import {
  runMonteCarlo,
  type MonteCarloInput,
  type MonteCarloOutput,
} from "@/lib/engine/monte-carlo";

// ── Default simulation parameters ────────────────────────────────────────────

const DEFAULT_SEED = 42;
const DEFAULT_RUNS = 5_000;

const DEFAULT_MC_INPUT: Omit<MonteCarloInput, "seed" | "paths"> = {
  horizonMonths: 12,
  btc: {
    startPriceUsd: 65_000,
    annualDrift: 0.1,
    annualVol: 0.6,
  },
  difficulty: {
    start: 85e12,
    longRun: 95e12,
    reversionSpeed: 0.5,
    annualVol: 0.2,
    minMultiple: 0.5,
    maxMultiple: 2.0,
  },
  yield: {
    miningWeight: 0.6,
    stableWeight: 0.4,
    stableApyMean: 0.05,
    stableApyVol: 0.005,
    costPerThDay: 0.04,
    capitalPerThUsd: 25,
  },
  floorApy: 0.08,
};

// ── Fan chart (pure SVG) ──────────────────────────────────────────────────────

const VB_W = 100;
const VB_H = 40;
const PAD = 2;
const MONTHS = 12;
const INITIAL_NAV = 1_000_000;

interface NavPoint {
  p5: number;
  p50: number;
  p95: number;
}

function buildFanSeries(percentiles: MonteCarloOutput["percentiles"]): NavPoint[] {
  const monthlyP5  = Math.pow(1 + percentiles.p5,  1 / 12) - 1;
  const monthlyP50 = Math.pow(1 + percentiles.p50, 1 / 12) - 1;
  const monthlyP95 = Math.pow(1 + percentiles.p95, 1 / 12) - 1;

  const series: NavPoint[] = [];
  let navP5  = INITIAL_NAV;
  let navP50 = INITIAL_NAV;
  let navP95 = INITIAL_NAV;

  for (let m = 1; m <= MONTHS; m++) {
    navP5  *= 1 + monthlyP5;
    navP50 *= 1 + monthlyP50;
    navP95 *= 1 + monthlyP95;
    series.push({ p5: navP5, p50: navP50, p95: navP95 });
  }
  return series;
}

function pts(arr: Array<{ x: number; y: number }>): string {
  return arr.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

interface FanChartProps {
  series: NavPoint[];
}

function FanChart({ series }: FanChartProps) {
  const allVals = [
    INITIAL_NAV,
    ...series.flatMap((d) => [d.p5, d.p50, d.p95]),
  ];
  const globalMin = Math.min(...allVals);
  const globalMax = Math.max(...allVals);

  const allMonths = [0, ...series.map((_, i) => i + 1)];

  const xAt = (i: number): number =>
    allMonths.length === 1
      ? VB_W / 2
      : (i / (allMonths.length - 1)) * VB_W;

  const yAt = (v: number): number => {
    const span = globalMax - globalMin || 1;
    const innerH = VB_H - PAD * 2;
    return PAD + innerH - ((v - globalMin) / span) * innerH;
  };

  const p5Values  = [INITIAL_NAV, ...series.map((d) => d.p5)];
  const p50Values = [INITIAL_NAV, ...series.map((d) => d.p50)];
  const p95Values = [INITIAL_NAV, ...series.map((d) => d.p95)];

  const toCoords = (vals: number[]): Array<{ x: number; y: number }> =>
    vals.map((v, i) => ({ x: xAt(i), y: yAt(v) }));

  const p5Coords  = toCoords(p5Values);
  const p50Coords = toCoords(p50Values);
  const p95Coords = toCoords(p95Values);

  const bandPoly = `${pts(p95Coords)} ${pts([...p5Coords].reverse())}`;

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      className="w-full h-full"
      role="img"
      aria-label="Monte Carlo fan chart — 12-month NAV projection with p5/p50/p95 bands"
    >
      {/* Fan band p5–p95 */}
      <polygon
        points={bandPoly}
        fill="var(--ct-status-success-soft)"
        style={{ opacity: "var(--ct-opacity-22)" }}
      />
      {/* p5 edge */}
      <polyline
        points={pts(p5Coords)}
        fill="none"
        stroke="var(--ct-status-success)"
        strokeWidth="0.4"
        style={{ strokeOpacity: "var(--ct-opacity-45)" }}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* p95 edge */}
      <polyline
        points={pts(p95Coords)}
        fill="none"
        stroke="var(--ct-status-success)"
        strokeWidth="0.4"
        style={{ strokeOpacity: "var(--ct-opacity-45)" }}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* Median p50 */}
      <polyline
        points={pts(p50Coords)}
        fill="none"
        stroke="var(--ct-status-success)"
        strokeWidth="1.0"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// ── Percentile row ─────────────────────────────────────────────────────────────

function PctRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  const pct = (value * 100).toFixed(1);
  return (
    <div className="admin-doc-inline-row admin-doc-inline-row--between admin-doc-inline-row--baseline">
      <span className="stat-label">{label}</span>
      <span
        className={cn(
          "mono tabular-nums",
          strong
            ? "stat-value ct-text-strong"
            : "body-sm ct-text-body",
        )}
      >
        {pct}%
      </span>
    </div>
  );
}

// ── Seed / runs inputs ────────────────────────────────────────────────────────

interface SimParamsProps {
  seed: number;
  runs: number;
  onSeedChange: (v: number) => void;
  onRunsChange: (v: number) => void;
  disabled: boolean;
}

function SimParams({
  seed,
  runs,
  onSeedChange,
  onRunsChange,
  disabled,
}: SimParamsProps) {
  return (
    <div className="admin-doc-inline-row admin-doc-inline-row--relaxed body-sm">
      <label className="admin-doc-inline-row ct-text-muted">
        <span className="stat-label">Seed</span>
        <input
          type="number"
          min={0}
          step={1}
          value={seed}
          disabled={disabled}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v >= 0) onSeedChange(v);
          }}
          className={cn(
            "w-24 rounded-base border border-(--ct-border-soft)",
            "ct-surface-1 px-[var(--ct-space-2)] py-1 body-xs mono ct-text-strong",
            "focus:border-(--ct-accent) focus:outline-none",
            "disabled:opacity-[var(--ct-opacity-40)]",
          )}
          aria-label="PRNG seed for Monte Carlo simulation"
        />
      </label>
      <label className="admin-doc-inline-row ct-text-muted">
        <span className="stat-label">Paths</span>
        <input
          type="number"
          min={100}
          max={50_000}
          step={100}
          value={runs}
          disabled={disabled}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v >= 100) onRunsChange(v);
          }}
          className={cn(
            "w-28 rounded-base border border-(--ct-border-soft)",
            "ct-surface-1 px-[var(--ct-space-2)] py-1 body-xs mono ct-text-strong",
            "focus:border-(--ct-accent) focus:outline-none",
            "disabled:opacity-[var(--ct-opacity-40)]",
          )}
          aria-label="Number of Monte Carlo simulation paths"
        />
      </label>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function MonteCarloPanel() {
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [runs, setRuns] = useState(DEFAULT_RUNS);
  const [output, setOutput] = useState<MonteCarloOutput | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRun() {
    startTransition(() => {
      const input: MonteCarloInput = {
        ...DEFAULT_MC_INPUT,
        seed,
        paths: runs,
      };
      const result = runMonteCarlo(input);
      setOutput(result);
    });
  }

  const fanSeries =
    output !== null ? buildFanSeries(output.percentiles) : null;

  // Headline APY range [p25–p75] — never a single point (non-negotiable #1).
  const headlineLow  = output ? (output.headlineRange.low  * 100).toFixed(1) : null;
  const headlineHigh = output ? (output.headlineRange.high * 100).toFixed(1) : null;

  return (
    <Card hoverOverlay={false}>
      <CardHeader className="mb-[var(--ct-space-4)]">
        <CardTitle>Monte Carlo Simulation</CardTitle>
        <ProvenanceBadge kind="estimated" />
      </CardHeader>

      {/* Params + Run button */}
      <div className="mb-[var(--ct-space-8)] admin-doc-toolbar sm:items-end">
        <SimParams
          seed={seed}
          runs={runs}
          onSeedChange={setSeed}
          onRunsChange={setRuns}
          disabled={isPending}
        />
        <Button
          variant="primary"
          size="sm"
          onClick={handleRun}
          disabled={isPending}
          aria-label="Run Monte Carlo simulation"
        >
          {isPending ? "Running…" : "Run simulation"}
        </Button>
      </div>

      {/* Output */}
      {output !== null && fanSeries !== null ? (
        <div className="admin-doc-stack--roomy">
          {/* Headline APY range */}
          <NestedPanel
            aria-label={`Headline APY range: ${headlineLow}% to ${headlineHigh}%`}
          >
            <p className="stat-label mb-1">Headline range (p25–p75)</p>
            <p className="mono stat-value tabular-nums ct-text-strong">
              {headlineLow}–{headlineHigh}%
            </p>
            <p className="mt-1 body-xs ct-text-muted">
              Annual yield range · {runs.toLocaleString()} paths · seed {seed}
            </p>
          </NestedPanel>

          {/* Fan chart */}
          <div className="relative h-24 w-full overflow-hidden rounded-base">
            <FanChart series={fanSeries} />
          </div>

          {/* Legend */}
          <div className="admin-doc-inline-row admin-doc-inline-row--relaxed body-xs ct-text-muted">
            <span className="admin-doc-inline-row admin-doc-inline-row--dense">
              <span className="inline-block h-0.5 w-4 rounded-full bg-(--ct-status-success)" />
              Median (p50)
            </span>
            <span className="admin-doc-inline-row admin-doc-inline-row--dense">
              <span className="inline-block h-2 w-4 rounded-sm bg-(--ct-status-success-soft) opacity-[var(--ct-opacity-22)]" />
              p5–p95
            </span>
          </div>

          {/* Percentile table */}
          <div className="admin-doc-stack--tight">
            <PctRow label="p5 (pessimistic)"  value={output.percentiles.p5} />
            <PctRow label="p25" value={output.percentiles.p25} />
            <PctRow label="p50 (median)"       value={output.percentiles.p50} strong />
            <PctRow label="p75" value={output.percentiles.p75} />
            <PctRow label="p95 (optimistic)"  value={output.percentiles.p95} />
          </div>

          {/* Prob below floor */}
          <div className="rounded-base border border-(--ct-border-soft) px-[var(--ct-space-4)] py-[var(--ct-space-3)] body-sm">
            <span className="stat-label">P(APY &lt; 8% floor): </span>
            <span className="mono body-sm ct-text-body">
              {(output.probBelowFloor * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      ) : (
        <EmptySurface
          variant="widget"
          message="Run the simulation to populate the fan chart."
          detail="The workspace will render the headline APY range, percentiles, and downside probability once a run completes."
        />
      )}

      {/* Disclaimer */}
      <p className="mt-[var(--ct-space-8)] border-t border-(--ct-border-soft) pt-[var(--ct-space-4)] body-xs italic ct-text-muted">
        <span className="not-italic ct-text-body">
          Monte Carlo — methodology v2.0. Not guaranteed.
        </span>{" "}
        Simulation assumes GBM for BTC price and bounded mean-reverting
        difficulty. Outputs are statistical estimates, not forward commitments.
        Past performance does not predict future results.
      </p>
    </Card>
  );
}
