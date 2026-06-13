"use client";

// MonteCarloReview — inline p5/p50/p95 projection panel for the vault wizard
// Review step (step 6). "use client" is allowed here: this is a UI component
// that runs on the client. The engine call is pure and synchronous.
//
// Engine purity contract (#6): runMonteCarlo lives in src/lib/engine/ and
// has no I/O — it is safe to call at render time from a client component.

import { useMemo } from "react";

import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { runMonteCarlo } from "@/lib/engine/monte-carlo";
import { formatUsdcGrouped } from "@/lib/vaults/product-display";

// ---------------------------------------------------------------------------
// VaultDraft — the slice of FormState the component needs
// ---------------------------------------------------------------------------

export interface VaultDraft {
  /** Target APY range lower bound in basis points (e.g. 800 = 8%). */
  targetApyLowBps: number;
  /** Target APY range upper bound in basis points (e.g. 1500 = 15%). */
  targetApyHighBps: number;
  /** Mining allocation in basis points (e.g. 5000 = 50%). */
  targetMiningBps: number;
  /** USDC base allocation in basis points. */
  targetUsdcBaseBps: number;
  /** Stable reserve allocation in basis points. */
  targetStableReserveBps: number;
}

// ---------------------------------------------------------------------------
// RunOptions — explicit seed + runs (ADR-006 determinism)
// ---------------------------------------------------------------------------

export interface MonteCarloRunOptions {
  /** PRNG seed — same seed ⇒ identical output (non-negotiable #6). */
  seed: number;
  /** Number of simulation paths. */
  runs: number;
}

// ---------------------------------------------------------------------------
// Adapter: VaultDraft → MonteCarloInput
// ---------------------------------------------------------------------------

// Canonical calibration constants for the 1y review panel.
// These are the *default* GBM/OU parameters used when no live oracle data is
// available (methodology v2.0 §Calibration — ADR-006, ratified 2026-05-22).
const MC_CALIBRATION = {
  btcStartPriceUsd: 60_000,
  btcAnnualDrift: 0.1,
  btcAnnualVol: 0.6,
  difficultyStart: 80e12,
  difficultyLongRun: 90e12,
  difficultyReversionSpeed: 0.5,
  difficultyAnnualVol: 0.2,
  difficultyMinMultiple: 0.5,
  difficultyMaxMultiple: 2.0,
  costPerThDay: 0.04,
  capitalPerThUsd: 25,
  stableApyMean: 0.05,
  stableApyVol: 0.005,
  floorApy: 0.08,
} as const;

function buildMonteCarloInput(
  draft: VaultDraft,
  opts: MonteCarloRunOptions,
) {
  const miningWeight = draft.targetMiningBps / 10_000;
  // Stable = USDC base + stable reserve legs; everything not purely "mining"
  // within the blended model.
  const stableWeight =
    (draft.targetUsdcBaseBps + draft.targetStableReserveBps) / 10_000;

  return {
    seed: opts.seed,
    paths: opts.runs,
    horizonMonths: 12,
    btc: {
      startPriceUsd: MC_CALIBRATION.btcStartPriceUsd,
      annualDrift: MC_CALIBRATION.btcAnnualDrift,
      annualVol: MC_CALIBRATION.btcAnnualVol,
    },
    difficulty: {
      start: MC_CALIBRATION.difficultyStart,
      longRun: MC_CALIBRATION.difficultyLongRun,
      reversionSpeed: MC_CALIBRATION.difficultyReversionSpeed,
      annualVol: MC_CALIBRATION.difficultyAnnualVol,
      minMultiple: MC_CALIBRATION.difficultyMinMultiple,
      maxMultiple: MC_CALIBRATION.difficultyMaxMultiple,
    },
    yield: {
      miningWeight,
      stableWeight,
      stableApyMean: MC_CALIBRATION.stableApyMean,
      stableApyVol: MC_CALIBRATION.stableApyVol,
      costPerThDay: MC_CALIBRATION.costPerThDay,
      capitalPerThUsd: MC_CALIBRATION.capitalPerThUsd,
    },
    floorApy: MC_CALIBRATION.floorApy,
  } as const;
}

// ---------------------------------------------------------------------------
// Formatting helpers — APY always as range, never a single point (#1)
// ---------------------------------------------------------------------------

function fmtPct(fraction: number, dp = 1): string {
  return (fraction * 100).toFixed(dp);
}

// ---------------------------------------------------------------------------
// MonteCarloReview
// ---------------------------------------------------------------------------

interface MonteCarloReviewProps {
  vaultDraft: VaultDraft;
  seed?: number;
  runs?: number;
  className?: string;
}

/**
 * Inline Monte Carlo projection panel for the vault wizard Review step.
 *
 * Calls `runMonteCarlo(vaultDraft, { seed, runs })` synchronously on the
 * client (the engine is a pure function, no I/O). Displays p5/p50/p95 APY
 * over a 1y horizon as a range line, never as a single point.
 *
 * Mandatory disclaimer per CLAUDE.md #10 + methodology v2.0 (ADR-006).
 */
export function MonteCarloReview({
  vaultDraft,
  seed = 42,
  runs = 1000,
  className,
}: MonteCarloReviewProps) {
  const result = useMemo(() => {
    const input = buildMonteCarloInput(vaultDraft, { seed, runs });
    return runMonteCarlo(input);
  }, [vaultDraft, seed, runs]);

  const { p5, p50, p95 } = result.percentiles;

  return (
    <div
      className={cn(
        "rounded-lg border border-(--ct-border-soft)",
        "ct-surface-2 p-4 admin-doc-stack admin-doc-stack--relaxed",
        className,
      )}
      role="region"
      aria-label="Monte Carlo projection"
    >
      {/* Header */}
      <div className="admin-doc-inline-row admin-doc-inline-row--between">
        <p className="stat-label ct-text-muted">
          Monte Carlo — 1y horizon ({formatUsdcGrouped(result.paths)} paths,
          seed&nbsp;{result.seed})
        </p>
        <Badge
          variant="default"
          title="Methodology v2.0 — optional companion to the rule-based engine"
        >
          Estimated
        </Badge>
      </div>

      {/* Percentile row — p5 · p50 · p95 */}
      <div
        className="admin-doc-inline-row admin-doc-inline-row--relaxed"
        aria-label={`p5: ${fmtPct(p5)}%, p50: ${fmtPct(p50)}%, p95: ${fmtPct(p95)}%`}
      >
        <MetricCell label="p5" value={fmtPct(p5)} tone="muted" />
        <span
          className="ct-text-faint body-xs select-none"
          aria-hidden
        >
          ·
        </span>
        <MetricCell label="p50" value={fmtPct(p50)} tone="primary" />
        <span
          className="ct-text-faint body-xs select-none"
          aria-hidden
        >
          ·
        </span>
        <MetricCell label="p95" value={fmtPct(p95)} tone="accent" />
      </div>

      {/* Tail-risk line */}
      <p className="body-xs ct-text-muted">
        P(APY &lt; 8%) ={" "}
        <span className="tabular font-semibold ct-text-primary">
          {(result.probBelowFloor * 100).toFixed(1)}%
        </span>
        &ensp;·&ensp;range:{" "}
        <span className="tabular font-semibold ct-text-accent">
          {fmtPct(p5)}%&ndash;{fmtPct(p95)}%
        </span>
      </p>

      {/* Mandatory disclaimer — CLAUDE.md #10 */}
      <p className="body-xs ct-text-faint border-t border-(--ct-border-soft) pt-3">
        Projections — not guaranteed. Methodology v2.0. Simulated paths
        assume BTC GBM (μ&nbsp;=&nbsp;10%/yr, σ&nbsp;=&nbsp;60%/yr) and a
        mean-reverting network difficulty model. Assumptions and results are
        indicative only; past performance is not a reliable indicator of future
        results.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MetricCell — small labelled stat atom
// ---------------------------------------------------------------------------

interface MetricCellProps {
  label: string;
  value: string;
  tone: "muted" | "primary" | "accent";
}

function MetricCell({ label, value, tone }: MetricCellProps) {
  const valueClass =
    tone === "accent"
      ? "tabular body-sm ct-text-accent"
      : tone === "primary"
        ? "tabular body-sm ct-text-strong"
        : "tabular body-sm ct-text-muted";

  return (
    <div className="admin-doc-inline-row admin-doc-inline-row--baseline admin-doc-inline-row--dense">
      <span className="stat-label ct-text-faint">{label}</span>
      <span className={valueClass}>
        {value}%
      </span>
    </div>
  );
}
