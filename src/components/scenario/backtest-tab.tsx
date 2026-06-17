"use client";

// BacktestTab — period selector + results for the Backtest sub-view.
// Extracted from lab-shell.tsx. Owns its own state via useBacktest. Behaviour
// preserved (period cards, description fallback, error/loading/results).

import { useRef } from "react";

import { BacktestPanel } from "@/components/scenario/backtest-panel";
import { ScenarioErrorBanner } from "@/components/scenario/scenario-feedback";
import { Spinner } from "@/components/scenario/scenario-spinner";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptySurface } from "@/components/ui/empty-surface";
import { useBacktest } from "@/hooks/use-backtest";
import type { BacktestKey } from "@/lib/engine/types";

interface BacktestMeta {
  key: BacktestKey;
  label: string;
  subtitle: string;
  description: string;
}

const BACKTEST_PERIODS: BacktestMeta[] = [
  {
    key: "bear_2022",
    label: "BTC Bear 2022",
    subtitle: "Jun 2022 — Jun 2023 · 12 months",
    description:
      "BTC dropped 65%, hashprice fell 60%. Tests vault resilience in a sustained bear market with mining margin compression.",
  },
  {
    key: "etf_halving_2024",
    label: "ETF + Halving 2024",
    subtitle: "Oct 2023 — Apr 2025 · 18 months",
    description:
      "Spot ETF approval drove BTC +150%. Halving compression created a mid-period dip before recovery.",
  },
  {
    key: "mining_crunch_2024",
    label: "Mining Crunch 2024",
    subtitle: "Apr 2024 — Dec 2024 · 9 months",
    description:
      "Hashprice fell 40%, difficulty rose 30%, BTC price flat. Pure mining-margin stress with no price relief.",
  },
];

export function BacktestTab() {
  const { state, pending, error, select } = useBacktest();
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedIdx = state.selectedKey !== null
    ? BACKTEST_PERIODS.findIndex((p) => p.key === state.selectedKey)
    : -1;
  const rovingIndex = selectedIdx >= 0 ? selectedIdx : 0;

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    if (pending) return;
    const total = BACKTEST_PERIODS.length;
    let next = -1;
    if (e.key === "ArrowRight") { next = (index + 1) % total; e.preventDefault(); }
    else if (e.key === "ArrowLeft") { next = (index - 1 + total) % total; e.preventDefault(); }
    else if (e.key === "Home") { next = 0; e.preventDefault(); }
    else if (e.key === "End") { next = total - 1; e.preventDefault(); }
    if (next < 0) return;
    const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    const nextButton = buttons?.[next];
    const nextPeriod = BACKTEST_PERIODS[next];
    if (nextButton && nextPeriod) {
      nextButton.focus();
      select(nextPeriod.key);
    }
  }

  return (
    <div className="backtest-tab admin-doc-stack admin-doc-stack--roomy">
      <Card className="backtest-period-rail p-(--ct-space-4)" hoverOverlay={false}>
        <CardHeader className="mb-(--ct-space-4)">
          <div className="min-w-0">
            <CardTitle>Historical periods</CardTitle>
            <p className="mt-0.5 body-xs ct-text-muted">Select a regime to simulate.</p>
          </div>
        </CardHeader>

        <div
          ref={containerRef}
          role="radiogroup"
          aria-label="Historical periods"
          className="scenario-preset-bar__items"
        >
          {BACKTEST_PERIODS.map((p, index) => (
            <button
              key={p.key}
              type="button"
              role="radio"
              disabled={pending}
              onClick={() => select(p.key)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              aria-checked={state.selectedKey === p.key}
              tabIndex={index === rovingIndex ? 0 : -1}
              className="scenario-preset-bar__button"
            >
              <span className="scenario-preset-bar__label">{p.label}</span>
              <span className="scenario-preset-bar__description">{p.subtitle}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Period descriptions — idle state before first selection */}
      {!state.output && !pending && state.selectedKey === null ? (
        <div className="backtest-period-details">
          {BACKTEST_PERIODS.map((p) => (
            <Card key={p.key} className="px-(--ct-space-6) py-(--ct-space-4)" hoverOverlay={false}>
              <p className="scenario-preset-bar__label">{p.label}</p>
              <p className="mt-1 body-xs ct-text-muted">{p.subtitle}</p>
              <p className="mt-(--ct-space-2) body-sm ct-text-body">{p.description}</p>
            </Card>
          ))}
        </div>
      ) : null}

      {/* Error banner */}
      {error ? <ScenarioErrorBanner message={error} /> : null}

      {/* Loading state */}
      {pending ? (
        <EmptySurface
          variant="widget"
          message="Computing backtest…"
          ariaLabel="Backtest — computing"
          role="status"
        >
          <Spinner className="ct-text-strong" />
        </EmptySurface>
      ) : null}

      {/* Results */}
      {state.output && !pending && (
        <BacktestPanel output={state.output} isPending={pending} />
      )}
    </div>
  );
}
