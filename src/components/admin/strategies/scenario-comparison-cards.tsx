/**
 * ScenarioComparisonCards — interactive 3-column selector for Safe / Balanced /
 * Opportunistic scenarios. Clicking a card updates the activeScenario in the
 * parent (Strategies Admin page) which fans out to PoolAllocationHero and
 * the projection engine.
 *
 * "use client" because it owns click handlers and receives a setter callback.
 */
"use client";

import { cn } from "@/lib/cn";
import {
  bpsToPct,
  type ProductStrategy,
  type RiskProfileKey,
  type ProductStrategyScenario,
} from "@/lib/product-strategies";
import {
  SLEEVE_COLORS,
  SCENARIO_DOT,
} from "@/lib/product-strategies/lab-colors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScenarioComparisonCardsProps {
  strategy: ProductStrategy;
  activeScenario: RiskProfileKey;
  onScenarioChange: (scenario: RiskProfileKey) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pctStr(bps: number): string {
  return `${bpsToPct(bps).toFixed(1)}%`;
}

function formatRange(lowBps: number | undefined, highBps: number | undefined): string {
  if (lowBps === undefined || highBps === undefined) return "—";
  return `${pctStr(lowBps)}–${pctStr(highBps)}`;
}

// ---------------------------------------------------------------------------
// AllocationBar — 4-colour segmented horizontal bar
// ---------------------------------------------------------------------------

interface AllocationBarProps {
  scenario: ProductStrategyScenario;
}

function AllocationBar({ scenario }: AllocationBarProps) {
  const a = scenario.allocation;
  const segments = [
    { label: "Mining", bps: a.miningBps, color: SLEEVE_COLORS.mining },
    { label: "BTC", bps: a.btcBps, color: SLEEVE_COLORS.btc },
    { label: "Stable", bps: a.stableReserveBps, color: SLEEVE_COLORS.stableReserve },
    { label: "Yield", bps: a.yieldOverlayBps, color: SLEEVE_COLORS.yieldOverlay },
  ];

  const total = segments.reduce((sum, s) => sum + Math.max(0, s.bps), 0);

  return (
    <div className="flex flex-col gap-(--ct-space-1) min-w-0">
      <div
        className="flex h-(--ct-space-2) w-full overflow-hidden rounded-(--ct-radius-full)"
        role="img"
        aria-label={`Allocation: ${segments.map((s) => `${s.label} ${pctStr(s.bps)}`).join(", ")}`}
      >
        {segments.map((s) =>
          s.bps > 0 ? (
            <span
              key={s.label}
              style={{
                width: total > 0 ? `${(Math.max(0, s.bps) / total) * 100}%` : "0%",
                background: s.color,
                display: "block",
                height: "100%",
              }}
              title={`${s.label} ${pctStr(s.bps)}`}
            />
          ) : null,
        )}
      </div>
      <div className="flex flex-wrap gap-x-(--ct-space-2) gap-y-(--ct-space-0_5) text-[length:var(--ct-text-xs)] ct-text-tertiary tabular-nums">
        {segments.map((s) => (
          <span key={s.label} className="flex items-center gap-(--ct-space-1)">
            <span
              aria-hidden
              style={{
                width: 6,
                height: 6,
                borderRadius: 1,
                background: s.color,
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            {s.label} {pctStr(s.bps)}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MetricRow
// ---------------------------------------------------------------------------

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-(--ct-space-2) min-w-0">
      <span className="text-[length:var(--ct-text-xs)] ct-text-tertiary min-w-0">{label}</span>
      <span className="text-[length:var(--ct-text-xs)] ct-text-body tabular-nums shrink-0">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScenarioCard
// ---------------------------------------------------------------------------

interface ScenarioCardProps {
  scenarioKey: RiskProfileKey;
  scenario: ProductStrategyScenario;
  isActive: boolean;
  onSelect: () => void;
}

function ScenarioCard({ scenarioKey, scenario, isActive, onSelect }: ScenarioCardProps) {
  const asm = scenario.assumptions;
  const con = scenario.constraints;

  const distRange = formatRange(asm.distributionTargetLowBps, asm.distributionTargetHighBps);
  const perfRange = formatRange(asm.totalPerformanceLowBps, asm.totalPerformanceHighBps);
  const floorApy = asm.floorBps !== undefined ? pctStr(asm.floorBps) : "—";
  const maxBtc = con.maxBtcBps !== undefined ? pctStr(con.maxBtcBps) : "—";
  const minStable = con.minStableReserveBps !== undefined ? pctStr(con.minStableReserveBps) : "—";

  const dotColor = SCENARIO_DOT[scenarioKey];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex min-w-0 w-full flex-col gap-(--ct-space-4) rounded-(--ct-radius-xl) border p-(--ct-space-5)",
        "text-left transition-colors duration-150",
        isActive
          ? "border-[var(--ct-border-accent)] bg-[color-mix(in_srgb,var(--ct-accent)_8%,transparent)]"
          : "border-[var(--ct-border-soft)] bg-[var(--ct-bg-deep)] cursor-pointer hover:border-[var(--ct-border)]",
      )}
      aria-pressed={isActive}
    >
      {/* Header: label + dot */}
      <div className="flex items-center justify-between gap-(--ct-space-2) min-w-0">
        <span className="text-[length:var(--ct-text-sm)] font-semibold ct-text-strong min-w-0">
          {scenario.label}
        </span>
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: dotColor,
            flexShrink: 0,
          }}
        />
      </div>

      {/* Allocation bar */}
      <AllocationBar scenario={scenario} />

      {/* KPIs */}
      <dl className="flex flex-col gap-(--ct-space-1_5)">
        <div className="flex items-center justify-between gap-(--ct-space-2) min-w-0">
          <dt className="text-[length:var(--ct-text-xs)] ct-text-tertiary min-w-0">Distribution target</dt>
          <dd className="text-[length:var(--ct-text-xs)] font-medium ct-text-body tabular-nums shrink-0">{distRange}</dd>
        </div>
        <div className="flex items-center justify-between gap-(--ct-space-2) min-w-0">
          <dt className="text-[length:var(--ct-text-xs)] ct-text-tertiary min-w-0">Total performance</dt>
          <dd className="text-[length:var(--ct-text-xs)] font-medium ct-text-body tabular-nums shrink-0">{perfRange}</dd>
        </div>
        <div className="flex items-center justify-between gap-(--ct-space-2) min-w-0">
          <dt className="text-[length:var(--ct-text-xs)] ct-text-tertiary min-w-0">Floor APY</dt>
          <dd className="text-[length:var(--ct-text-xs)] font-medium ct-text-body tabular-nums shrink-0">{floorApy}</dd>
        </div>
        <div className="flex items-center justify-between gap-(--ct-space-2) min-w-0">
          <dt className="text-[length:var(--ct-text-xs)] ct-text-tertiary min-w-0">Horizon</dt>
          <dd className="text-[length:var(--ct-text-xs)] font-medium ct-text-body tabular-nums shrink-0">{asm.horizonMonths}m</dd>
        </div>
      </dl>

      {/* Narrative bullets */}
      {scenario.narrativeBullets.length > 0 ? (
        <ul className="flex flex-col gap-(--ct-space-1) border-t border-[var(--ct-border-soft)] pt-(--ct-space-3) min-w-0">
          {scenario.narrativeBullets.slice(0, 2).map((bullet) => (
            <li
              key={bullet}
              className="text-[length:var(--ct-text-xs)] ct-text-faint [overflow-wrap:anywhere]"
            >
              · {bullet}
            </li>
          ))}
        </ul>
      ) : null}

      {/* Constraint metric rows */}
      <div className="flex flex-col gap-(--ct-space-1_5) border-t border-[var(--ct-border-soft)] pt-(--ct-space-3) min-w-0">
        <MetricRow label="Max BTC" value={maxBtc} />
        <MetricRow label="Min stable reserve" value={minStable} />
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const SCENARIO_KEYS: RiskProfileKey[] = ["safe", "balanced", "opportunistic"];

export function ScenarioComparisonCards({
  strategy,
  activeScenario,
  onScenarioChange,
}: ScenarioComparisonCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-(--ct-space-4) sm:grid-cols-2 lg:grid-cols-3 min-w-0">
      {SCENARIO_KEYS.map((key) => (
        <ScenarioCard
          key={key}
          scenarioKey={key}
          scenario={strategy.scenarios[key]}
          isActive={activeScenario === key}
          onSelect={() => onScenarioChange(key)}
        />
      ))}
    </div>
  );
}
