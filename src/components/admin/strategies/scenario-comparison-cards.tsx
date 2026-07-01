/**
 * ScenarioComparisonCards — repurposed as a calmer Scenario Summary block.
 *
 * The old three-column dashboard cards were too heavy for the redesigned
 * Strategy Studio. The component now reads as an operator summary for the active
 * scenario, plus a compact snapshot of the other scenarios.
 */
"use client";

import { Card } from "@/components/catalyst/card";
import { NestedPanel } from "@/components/catalyst/nested-panel";
import {
  bpsToPct,
  RISK_LABEL,
  type ProductStrategy,
  type RiskProfileKey,
} from "@/lib/product-strategies";

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

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-(--ct-space-0_5)">
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
  const allocation = active.allocation;
  const assumptions = active.assumptions;
  const constraints = active.constraints;

  const growthMix = allocation.miningBps + allocation.btcBps;
  const protectionMix = allocation.stableReserveBps + allocation.yieldOverlayBps;

  return (
    <div className="grid min-w-0 grid-cols-1 gap-(--ct-space-4) xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <Card
        material="flat"
        hoverOverlay={false}
        className="min-w-0"
        contentClassName="flex min-w-0 flex-col gap-(--ct-space-4) p-(--ct-space-5)"
      >
        <div className="flex flex-col gap-(--ct-space-1)">
          <h3 className="ct-section-title">Scenario Summary</h3>
          <p className="text-[length:var(--ct-text-xs)] ct-text-tertiary">
            Active scenario: {RISK_LABEL[activeScenario]} · live studio preview, conditional on stated assumptions.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-(--ct-space-4) lg:grid-cols-4">
          <SummaryItem
            label="Distribution target"
            value={formatRange(
              assumptions.distributionTargetLowBps,
              assumptions.distributionTargetHighBps,
            )}
          />
          <SummaryItem
            label="Total performance"
            value={formatRange(
              assumptions.totalPerformanceLowBps,
              assumptions.totalPerformanceHighBps,
            )}
          />
          <SummaryItem
            label="Floor APY"
            value={assumptions.floorBps !== undefined ? pctStr(assumptions.floorBps) : "—"}
          />
          <SummaryItem label="Horizon" value={`${assumptions.horizonMonths}m`} />
          <SummaryItem label="Growth sleeves" value={pctStr(growthMix)} />
          <SummaryItem label="Protection sleeves" value={pctStr(protectionMix)} />
          <SummaryItem
            label="Vol. multiplier"
            value={`${assumptions.volatilityMultiplier.toFixed(2)}x`}
          />
          <SummaryItem
            label="BTC annual vol"
            value={`${(assumptions.btcAnnualVol * 100).toFixed(0)}%`}
          />
        </div>

        <div className="grid grid-cols-1 gap-(--ct-space-3) 2xl:grid-cols-3">
          {SCENARIO_KEYS.map((key) => {
            const scenario = strategy.scenarios[key];
            const isActive = key === activeScenario;
            const perfRange = formatRange(
              scenario.assumptions.totalPerformanceLowBps,
              scenario.assumptions.totalPerformanceHighBps,
            );
            const distRange = formatRange(
              scenario.assumptions.distributionTargetLowBps,
              scenario.assumptions.distributionTargetHighBps,
            );

            return (
              <button
                key={key}
                type="button"
                onClick={() => onScenarioChange(key)}
                className={`flex min-w-0 flex-col gap-(--ct-space-1_5) rounded-(--ct-radius-lg) border p-(--ct-space-3) text-left transition-colors ${
                  isActive
                    ? "border-[var(--ct-accent)] bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)]"
                    : "border-[var(--ct-border-soft)] bg-[color-mix(in_srgb,var(--ct-text-strong)_3%,transparent)] hover:border-[color-mix(in_srgb,var(--ct-accent)_18%,transparent)]"
                }`}
                aria-pressed={isActive}
              >
                <span className="text-[length:var(--ct-text-xs)] font-semibold ct-text-strong">
                  {RISK_LABEL[key]}
                </span>
                <span className="text-[length:var(--ct-text-xs)] ct-text-tertiary tabular-nums">
                  Perf. {perfRange}
                </span>
                <span className="text-[length:var(--ct-text-xs)] ct-text-tertiary tabular-nums">
                  Dist. {distRange}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card
        material="flat"
        hoverOverlay={false}
        className="min-w-0"
        contentClassName="flex min-w-0 flex-col gap-(--ct-space-4) p-(--ct-space-5)"
      >
        <div className="flex flex-col gap-(--ct-space-1)">
          <h3 className="ct-section-title">Reading Notes</h3>
          <p className="text-[length:var(--ct-text-xs)] ct-text-tertiary">
            Use this block to understand what the current mix is optimising for before opening the advanced lab.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-(--ct-space-3) sm:grid-cols-2">
          <NestedPanel>
            <span className="ct-bento-label">Guardrails</span>
            <dl className="mt-(--ct-space-2) flex flex-col gap-(--ct-space-2)">
              <div className="flex items-center justify-between gap-(--ct-space-2)">
                <dt className="text-[length:var(--ct-text-xs)] ct-text-tertiary">Min stable reserve</dt>
                <dd className="text-[length:var(--ct-text-xs)] ct-text-strong tabular-nums">
                  {constraints.minStableReserveBps !== undefined
                    ? pctStr(constraints.minStableReserveBps)
                    : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-(--ct-space-2)">
                <dt className="text-[length:var(--ct-text-xs)] ct-text-tertiary">Max BTC</dt>
                <dd className="text-[length:var(--ct-text-xs)] ct-text-strong tabular-nums">
                  {constraints.maxBtcBps !== undefined ? pctStr(constraints.maxBtcBps) : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-(--ct-space-2)">
                <dt className="text-[length:var(--ct-text-xs)] ct-text-tertiary">Max yield overlay</dt>
                <dd className="text-[length:var(--ct-text-xs)] ct-text-strong tabular-nums">
                  {constraints.maxYieldOverlayBps !== undefined
                    ? pctStr(constraints.maxYieldOverlayBps)
                    : "—"}
                </dd>
              </div>
            </dl>
          </NestedPanel>

          <NestedPanel>
            <span className="ct-bento-label">Current intent</span>
            <p className="mt-(--ct-space-2) text-[length:var(--ct-text-xs)] leading-relaxed ct-text-body">
              {strategy.description}
            </p>
          </NestedPanel>
        </div>

        <NestedPanel className="flex flex-col gap-(--ct-space-2)">
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
        </NestedPanel>

        <p className="text-[length:var(--ct-text-2xs)] ct-text-faint">
          Modelled guidance only. Use the Data Lab for deeper stress, sensitivity, and backtest views.
        </p>
      </Card>
    </div>
  );
}
