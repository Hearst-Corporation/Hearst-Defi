/**
 * PoolAllocationHero — hero-grade visual block for the Strategies Admin page.
 *
 * Shows the pool allocation breakdown for the active scenario with a custom
 * SVG donut on the left and a detailed legend + stat cards on the right.
 *
 * Sleeve colours come exclusively from `lab-colors.ts` (SLEEVE_COLORS) —
 * no hex literals in this file.
 *
 * Scenario toggle: when `onScenarioChange` is provided, renders pill buttons
 * (Safe / Balanced / Opportunistic) with a coloured dot from SCENARIO_DOT.
 * When absent, displays a static label — backward-compatible with existing
 * callers that pass only `{ strategy, activeScenario }`.
 *
 * "use client" — the scenario toggle buttons require client interactivity.
 */
"use client";

import { cn } from "@/lib/cn";
import {
  bpsToPct,
  PRODUCT_FAMILY_LABEL,
  RISK_LABEL,
  type ProductStrategy,
  type RiskProfileKey,
} from "@/lib/product-strategies";
import {
  SLEEVE_COLORS,
  SLEEVE_LABEL,
  SCENARIO_DOT,
  sleeveOrder,
} from "@/lib/product-strategies/lab-colors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PoolAllocationHeroProps {
  strategy: ProductStrategy;
  activeScenario: RiskProfileKey;
  /** When provided, renders an interactive scenario toggle inside the hero. */
  onScenarioChange?: (s: RiskProfileKey) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pctStr(bps: number): string {
  return `${bpsToPct(bps).toFixed(1)}%`;
}

function bpsStr(bps: number): string {
  return `${bps.toLocaleString()}bps`;
}

function formatRange(lowBps: number | undefined, highBps: number | undefined): string {
  if (lowBps === undefined || highBps === undefined) return "—";
  return `${pctStr(lowBps)}–${pctStr(highBps)}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface StatMiniCardProps {
  label: string;
  value: string;
}

function StatMiniCard({ label, value }: StatMiniCardProps) {
  return (
    <div className="flex flex-col gap-(--ct-space-0_5) rounded-(--ct-radius-lg) border border-[var(--ct-border-soft)] p-(--ct-space-3) min-w-0">
      <span className="text-[length:var(--ct-text-lg)] font-semibold ct-text-strong tabular-nums truncate">
        {value}
      </span>
      <span className="text-[length:var(--ct-text-2xs)] ct-text-tertiary truncate">
        {label}
      </span>
    </div>
  );
}

const SCENARIO_KEYS: RiskProfileKey[] = ["safe", "balanced", "opportunistic"];

// ---------------------------------------------------------------------------
// CustomDonut — sleeve colours come from SLEEVE_COLORS import
// ---------------------------------------------------------------------------

interface DonutSleeveRow {
  key: string;
  label: string;
  bps: number;
  color: string;
}

interface CustomDonutProps {
  sleeves: DonutSleeveRow[];
  centerLabel: string;
  centerValue: string;
}

function CustomDonut({ sleeves, centerLabel, centerValue }: CustomDonutProps) {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const r = 76;
  const strokeWidth = 18;
  const circumference = 2 * Math.PI * r;
  const total = sleeves.reduce((sum, s) => sum + Math.max(0, s.bps), 0);

  let acc = 0;

  return (
    <svg
      role="img"
      aria-label="Pool allocation donut chart"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
    >
      {/* Track */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="var(--ct-surface-inset)"
        strokeWidth={strokeWidth}
      />
      {/* Segments */}
      {total > 0 &&
        sleeves.map((s) => {
          const fraction = Math.max(0, s.bps) / total;
          const arc = fraction * circumference;
          const rotation = acc * 360 - 90;
          acc += fraction;
          return (
            <circle
              key={s.key}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${arc.toFixed(3)} ${(circumference - arc).toFixed(3)}`}
              transform={`rotate(${rotation.toFixed(2)} ${cx} ${cy})`}
            >
              <title>{`${s.label}: ${(fraction * 100).toFixed(1)}%`}</title>
            </circle>
          );
        })}
      {/* Center value */}
      <text
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        fontSize={13}
        fontWeight={700}
        fill="var(--ct-text-primary)"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {centerValue.length > 10 ? centerValue.slice(0, 9) + "…" : centerValue}
      </text>
      {/* Center label */}
      <text
        x={cx}
        y={cy + 14}
        textAnchor="middle"
        fontSize={9}
        fill="var(--ct-text-muted)"
        style={{ textTransform: "uppercase", letterSpacing: "0.12em" }}
      >
        {centerLabel}
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PoolAllocationHero({
  strategy,
  activeScenario,
  onScenarioChange,
}: PoolAllocationHeroProps) {
  const scenario = strategy.scenarios[activeScenario];
  const asm = scenario.assumptions;
  const alloc = scenario.allocation;

  // Build sleeve rows from the canonical order — colours from SLEEVE_COLORS
  const sleeves: DonutSleeveRow[] = sleeveOrder.map((key) => ({
    key,
    label: SLEEVE_LABEL[key],
    bps: (() => {
      if (key === "mining") return alloc.miningBps;
      if (key === "btc") return alloc.btcBps;
      if (key === "stableReserve") return alloc.stableReserveBps;
      return alloc.yieldOverlayBps;
    })(),
    color: SLEEVE_COLORS[key],
  }));

  const total = sleeves.reduce((sum, s) => sum + Math.max(0, s.bps), 0);

  const scenarioLabel = scenario.label;
  const familyLabel = PRODUCT_FAMILY_LABEL[strategy.productFamily];

  const distRange = formatRange(asm.distributionTargetLowBps, asm.distributionTargetHighBps);
  const perfRange = formatRange(asm.totalPerformanceLowBps, asm.totalPerformanceHighBps);
  const floorApy = asm.floorBps !== undefined ? pctStr(asm.floorBps) : "—";
  const volMultiplier = `${asm.volatilityMultiplier}`;

  return (
    <div
      className={cn(
        "flex flex-col gap-(--ct-space-6) rounded-(--ct-radius-2xl) border border-[var(--ct-border-soft)]",
        "p-(--ct-space-6) bg-[var(--ct-bg-deep)]",
      )}
    >
      {/* Header */}
      <div className="flex flex-col gap-(--ct-space-1) sm:flex-row sm:items-center sm:justify-between min-w-0">
        <div className="flex flex-col gap-(--ct-space-0_5) min-w-0">
          <h2 className="text-[length:var(--ct-text-xl)] font-semibold ct-text-strong">
            Pool Allocation
          </h2>
          <p className="text-[length:var(--ct-text-sm)] ct-text-tertiary">
            {strategy.name} · {familyLabel}
          </p>
        </div>

        {/* Scenario toggle or static label */}
        {onScenarioChange ? (
          <div
            className="flex items-center gap-(--ct-space-1) rounded-(--ct-radius-full) border border-[var(--ct-border-soft)] p-(--ct-space-1) shrink-0"
            role="group"
            aria-label="Select scenario"
          >
            {SCENARIO_KEYS.map((key) => {
              const isActive = key === activeScenario;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onScenarioChange(key)}
                  className={cn(
                    "flex items-center gap-(--ct-space-1_5) rounded-(--ct-radius-full)",
                    "px-(--ct-space-3) py-(--ct-space-1) text-[length:var(--ct-text-xs)] font-medium",
                    "transition-colors",
                    isActive
                      ? "bg-[var(--ct-surface-card)] ct-text-strong"
                      : "ct-text-tertiary hover:ct-text-body",
                  )}
                  aria-pressed={isActive}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: SCENARIO_DOT[key],
                      flexShrink: 0,
                    }}
                  />
                  {RISK_LABEL[key]}
                </button>
              );
            })}
          </div>
        ) : (
          <span
            className="flex items-center gap-(--ct-space-1_5) text-[length:var(--ct-text-xs)] ct-text-tertiary shrink-0"
          >
            <span
              aria-hidden
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: SCENARIO_DOT[activeScenario],
                flexShrink: 0,
              }}
            />
            Active: {scenarioLabel}
          </span>
        )}
      </div>

      {/* Main grid: donut + legend */}
      <div className="grid gap-(--ct-space-8) md:grid-cols-2 items-center">
        {/* Left: custom donut with SLEEVE_COLORS */}
        <div className="flex justify-center">
          <CustomDonut sleeves={sleeves} centerLabel="Pool" centerValue={familyLabel} />
        </div>

        {/* Right: legend rows with pct + bps */}
        <div className="flex flex-col gap-(--ct-space-4) min-w-0">
          <ul className="flex flex-col gap-(--ct-space-2)">
            {sleeves.map((s) => {
              const pct = total > 0 ? (Math.max(0, s.bps) / total) * 100 : 0;
              return (
                <li key={s.key} className="flex items-center gap-(--ct-space-2) min-w-0">
                  {/* Colour square */}
                  <span
                    aria-hidden
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 3,
                      background: s.color,
                      flexShrink: 0,
                    }}
                  />
                  {/* Label */}
                  <span className="text-[length:var(--ct-text-xs)] ct-text-body min-w-0 truncate flex-1">
                    {s.label}
                  </span>
                  {/* Percent */}
                  <span className="text-[length:var(--ct-text-sm)] font-semibold ct-text-strong tabular-nums shrink-0">
                    {pct.toFixed(1)}%
                  </span>
                  {/* Bps */}
                  <span className="text-[length:var(--ct-text-2xs)] ct-text-tertiary tabular-nums shrink-0 w-[4.5rem] text-right">
                    {bpsStr(s.bps)}
                  </span>
                </li>
              );
            })}
          </ul>

          {/* Horizontal mini-bar gauge */}
          <div
            className="flex rounded-(--ct-radius-full) overflow-hidden"
            style={{ height: 8 }}
            aria-hidden
          >
            {total > 0 &&
              sleeves.map((s) => (
                <div
                  key={s.key}
                  style={{
                    width: `${((Math.max(0, s.bps) / total) * 100).toFixed(2)}%`,
                    background: s.color,
                  }}
                />
              ))}
          </div>
        </div>
      </div>

      {/* Stats mini-cards */}
      <div className="grid grid-cols-2 gap-(--ct-space-3) sm:grid-cols-4">
        <StatMiniCard label="Distribution target" value={distRange} />
        <StatMiniCard label="Total performance" value={perfRange} />
        <StatMiniCard label="Floor APY" value={floorApy} />
        <StatMiniCard label="Horizon" value={`${asm.horizonMonths}m`} />
      </div>

      {/* Vol multiplier + disclaimer row */}
      <div className="flex items-center justify-between gap-(--ct-space-4) min-w-0">
        <p className="text-[length:var(--ct-text-2xs)] ct-text-faint min-w-0">
          Conditional on stated assumptions — not guaranteed.
        </p>
        <span className="text-[length:var(--ct-text-2xs)] ct-text-tertiary tabular-nums shrink-0">
          Vol ×{volMultiplier}
        </span>
      </div>
    </div>
  );
}
