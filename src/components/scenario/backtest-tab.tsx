"use client";

// BacktestTab — period selector + results for the Backtest sub-view.
// Extracted from lab-shell.tsx. Owns its own state via useBacktest. Behaviour
// preserved (period cards, description fallback, error/loading/results).

import { BacktestPanel } from "@/components/scenario/backtest-panel";
import { Spinner } from "@/components/scenario/scenario-spinner";
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
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex flex-wrap gap-3">
        {BACKTEST_PERIODS.map((p) => {
          const isActive = state.selectedKey === p.key;
          return (
            <button
              key={p.key}
              type="button"
              disabled={pending}
              onClick={() => select(p.key)}
              aria-pressed={isActive}
              className={cn(
                "flex flex-col items-start gap-0.5 rounded-full border px-4 py-3 text-left",
                "transition-[background-color,color,border-color,box-shadow] duration-[var(--ct-dur-fast)]",
                "disabled:cursor-not-allowed disabled:opacity-40",
                "focus-visible:outline-none focus-visible:shadow-[var(--ct-shadow-focus-ring)]",
                isActive
                  ? [
                      "border-[var(--ct-accent)] bg-[var(--ct-accent)] text-[var(--ct-bg-deep)]",
                      "shadow-[var(--ct-shadow-focus-ring)]",
                    ]
                  : [
                      "border-[var(--ct-border-strong)] ct-surface-1",
                      "ct-text-body",
                      "hover:border-[var(--ct-border-strong)] hover:ct-surface-3 hover:ct-text-primary",
                    ],
              )}
            >
              <span className="text-sm font-semibold leading-[var(--ct-leading-tight)]">
                {p.label}
              </span>
              <span
                className={cn(
                  "text-xs leading-[var(--ct-leading-tight)]",
                  isActive
                    ? "text-[var(--ct-bg-deep)] opacity-70"
                    : "ct-text-muted",
                )}
              >
                {p.subtitle}
              </span>
            </button>
          );
        })}
      </div>

      {/* Period description — shown when no results yet */}
      {!state.output && !pending && state.selectedKey === null && (
        <div className="space-y-3">
          {BACKTEST_PERIODS.map((p) => (
            <div key={p.key} className="glass-panel-subtle px-5 py-4">
              <p className="text-sm font-semibold ct-text-body">
                {p.label}
              </p>
              <p className="mt-1 text-xs ct-text-muted">
                {p.subtitle}
              </p>
              <p className="mt-2 text-sm ct-text-body">
                {p.description}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <p className="rounded-full border border-[var(--ct-status-danger)] ct-status-danger-bg px-4 py-2.5 text-sm ct-status-danger">
          {error}
        </p>
      )}

      {/* Loading state */}
      {pending && (
        <div
          className={cn(
            "flex min-h-64 flex-col items-center justify-center gap-3",
            "glass-panel-subtle border-dashed",
          )}
        >
          <Spinner />
          <p className="stat-label ct-text-body">
            Computing backtest…
          </p>
        </div>
      )}

      {/* Results */}
      {state.output && !pending && (
        <BacktestPanel output={state.output} isPending={pending} />
      )}
    </div>
  );
}
