/**
 * ScenarioComparisonCards — three comparable scenario tiles + reading notes.
 *
 * The single place where Safe / Balanced / Opportunistic sit side by side:
 * outcome ranges, allocation mix, and guardrails per tile. Clicking a tile
 * activates that scenario in the Studio above (same state, one obvious
 * consequence). The active tile is highlighted; its narrative bullets render
 * once below the row. No number here duplicates the Studio KPI strip.
 */
"use client";

import { NestedPanel } from "@/components/catalyst/nested-panel";
import { cn } from "@/lib/cn";
import {
  bpsToPct,
  RISK_LABEL,
  type ProductStrategy,
  type RiskProfileKey,
} from "@/lib/product-strategies";
import { SCENARIO_DOT } from "@/lib/product-strategies/lab-colors";
import { AllocationMiniBar } from "./strategy-card-charts";

interface ScenarioComparisonCardsProps {
  strategy: ProductStrategy;
  activeScenario: RiskProfileKey;
  onScenarioChange: (scenario: RiskProfileKey) => void;
}

const SCENARIO_KEYS: RiskProfileKey[] = ["safe", "balanced", "opportunistic"];

function pctStr(bps: number): string {
  return `${bpsToPct(bps).toFixed(1)}%`;
}

function formatRange(lowBps: number | undefined, highBps: number | undefined): string {
  if (lowBps === undefined || highBps === undefined) return "—";
  return `${pctStr(lowBps)}–${pctStr(highBps)}`;
}

function guardrailCaption(strategy: ProductStrategy, key: RiskProfileKey): string | null {
  const constraints = strategy.scenarios[key].constraints;
  const parts: string[] = [];
  if (constraints.minStableReserveBps !== undefined) {
    parts.push(`Stable ≥ ${pctStr(constraints.minStableReserveBps)}`);
  }
  if (constraints.maxBtcBps !== undefined) {
    parts.push(`BTC ≤ ${pctStr(constraints.maxBtcBps)}`);
  }
  if (constraints.maxYieldOverlayBps !== undefined) {
    parts.push(`Overlay ≤ ${pctStr(constraints.maxYieldOverlayBps)}`);
  }
  if (parts.length === 0) return null;
  return parts.join(" · ");
}

function TileStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-(--ct-space-0_5)">
      <span className="ct-bento-label">{label}</span>
      <span className="text-[length:var(--ct-text-xs)] font-medium ct-text-strong tabular-nums">
        {value}
      </span>
    </div>
  );
}

export function ScenarioComparisonCards({
  strategy,
  activeScenario,
  onScenarioChange,
}: ScenarioComparisonCardsProps) {
  const active = strategy.scenarios[activeScenario];
  const guardrailsActive = guardrailCaption(strategy, activeScenario);

  return (
    // Container query: the 3-tile row needs real slot width (chat rail aware).
    <div className="@container flex min-w-0 flex-col gap-(--ct-space-4)">
      <div className="grid min-w-0 grid-cols-1 gap-(--ct-space-3) @[42rem]:grid-cols-3">
        {SCENARIO_KEYS.map((key) => {
          const scenario = strategy.scenarios[key];
          const isActive = key === activeScenario;
          const guardrails = guardrailCaption(strategy, key);

          return (
            <button
              key={key}
              type="button"
              onClick={() => onScenarioChange(key)}
              aria-pressed={isActive}
              className={cn(
                "flex min-w-0 flex-col gap-(--ct-space-3) rounded-(--ct-radius-lg) border p-(--ct-space-4) text-left transition-colors",
                isActive
                  ? "border-[var(--ct-accent)] bg-[color-mix(in_srgb,var(--ct-accent)_8%,transparent)]"
                  : "border-[var(--ct-border-soft)] hover:border-[color-mix(in_srgb,var(--ct-accent)_22%,transparent)]",
              )}
            >
              <div className="flex items-center justify-between gap-(--ct-space-2)">
                <span className="flex min-w-0 items-center gap-(--ct-space-2)">
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: SCENARIO_DOT[key] }}
                  />
                  <span className="truncate text-[length:var(--ct-text-xs)] font-semibold ct-text-strong">
                    {RISK_LABEL[key]}
                  </span>
                </span>
                {isActive ? (
                  <span className="shrink-0 text-[length:var(--ct-text-2xs)] font-medium ct-text-accent">
                    Active
                  </span>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-(--ct-space-3)">
                <TileStat
                  label="Performance"
                  value={formatRange(
                    scenario.assumptions.totalPerformanceLowBps,
                    scenario.assumptions.totalPerformanceHighBps,
                  )}
                />
                <TileStat
                  label="Distribution"
                  value={formatRange(
                    scenario.assumptions.distributionTargetLowBps,
                    scenario.assumptions.distributionTargetHighBps,
                  )}
                />
              </div>

              <AllocationMiniBar allocation={scenario.allocation} />

              {guardrails ? (
                <span className="text-[length:var(--ct-text-2xs)] ct-text-tertiary tabular-nums">
                  {guardrails}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <NestedPanel className="flex flex-col gap-(--ct-space-2)">
        <span className="ct-bento-label">
          {RISK_LABEL[activeScenario]} — reading notes
        </span>
        <ul className="flex flex-col gap-(--ct-space-2)">
          {active.narrativeBullets.map((bullet) => (
            <li
              key={bullet}
              className="text-[length:var(--ct-text-xs)] leading-relaxed ct-text-body [overflow-wrap:anywhere]"
            >
              · {bullet}
            </li>
          ))}
        </ul>
        {guardrailsActive ? (
          <p className="text-[length:var(--ct-text-2xs)] ct-text-tertiary tabular-nums">
            Hard guardrails: {guardrailsActive}
          </p>
        ) : null}
      </NestedPanel>

      <p className="text-[length:var(--ct-text-2xs)] ct-text-faint">
        Modelled ranges, conditional on stated assumptions — not guaranteed.
      </p>
    </div>
  );
}
