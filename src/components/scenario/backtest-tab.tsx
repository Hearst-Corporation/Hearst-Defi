"use client";

// BacktestTab — period selector + results for the Backtest sub-view.
// Extracted from lab-shell.tsx. Owns its own state via useBacktest. Behaviour
// preserved (period cards, description fallback, error/loading/results).

import { BacktestPanel } from "@/components/scenario/backtest-panel";
import { Spinner } from "@/components/scenario/scenario-spinner";
import { EmptySurface } from "@/components/ui/empty-surface";
import { cn } from "@/lib/cn";
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

  return (
    <div className="backtest-tab">
      <nav
        aria-label="Backtest periods"
        className="scenario-preset-bar backtest-period-rail"
      >
        <div className="scenario-preset-bar__head">
          <p className="stat-label m-0">Historical periods</p>
          <span className="body-xs ct-text-faint">Select a regime to simulate</span>
        </div>
        <div className="scenario-preset-bar__items">
          {BACKTEST_PERIODS.map((p) => {
            const isActive = state.selectedKey === p.key;
            return (
              <button
                key={p.key}
                type="button"
                disabled={pending}
                onClick={() => select(p.key)}
                aria-pressed={isActive}
                title={p.description}
                className={cn(
                  "scenario-preset-bar__button",
                  isActive && "scenario-preset-bar__button--active",
                )}
              >
                <span className="scenario-preset-bar__label">{p.label}</span>
                <span className="scenario-preset-bar__description">
                  {p.subtitle}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Period descriptions — idle state before first selection */}
      {!state.output && !pending && state.selectedKey === null ? (
        <div className="backtest-period-details">
          {BACKTEST_PERIODS.map((p) => (
            <div key={p.key} className="ct-card ct-glass-panel px-5 py-4">
              <p className="scenario-preset-bar__label">{p.label}</p>
              <p className="mt-1 body-xs ct-text-muted">{p.subtitle}</p>
              <p className="mt-2 body-sm ct-text-body">{p.description}</p>
            </div>
          ))}
        </div>
      ) : null}

      {/* Error banner */}
      {error && (
        <p className="rounded-full border border-(--ct-status-danger) ct-status-danger-bg px-4 py-2.5 body-sm ct-status-danger">
          {error}
        </p>
      )}

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
