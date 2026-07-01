"use client";

/**
 * Strategy library — premium visual redesign.
 * Grid of strategy cards + interactive detail panel with scenario breakdown.
 * Client component (useState for selected strategy).
 */

import { useState } from "react";
import {
  PRODUCT_STRATEGIES,
  PRODUCT_FAMILY_LABEL,
  PRIORITY_LABEL,
  bpsToPct,
  type ProductStrategy,
  type ProductStrategyScenario,
  type StrategyStatus,
} from "@/lib/product-strategies";
import { cn } from "@/lib/cn";
import {
  SLEEVE_COLORS,
  SLEEVE_LABEL,
} from "@/lib/product-strategies/lab-colors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pct(bps: number): string {
  return `${bpsToPct(bps)}%`;
}

// ---------------------------------------------------------------------------
// StatusPill
// ---------------------------------------------------------------------------

function StatusPill({ status }: { status: StrategyStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-(--ct-space-1) rounded-(--ct-radius-full) px-(--ct-space-2) py-[2px]",
        "text-[length:var(--ct-text-2xs)] font-medium leading-none tracking-wide",
        status === "active"
          ? "bg-[color-mix(in_srgb,var(--ct-accent)_12%,transparent)] text-[var(--ct-accent)]"
          : status === "draft"
            ? "bg-[color-mix(in_srgb,var(--ct-text-tertiary)_10%,transparent)] text-[var(--ct-text-tertiary)]"
            : "bg-[color-mix(in_srgb,var(--ct-border)_20%,transparent)] text-[var(--ct-text-faint)]",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "block h-[5px] w-[5px] rounded-(--ct-radius-full)",
          status === "active"
            ? "bg-[var(--ct-accent)]"
            : status === "draft"
              ? "bg-[var(--ct-text-tertiary)]"
              : "bg-[var(--ct-border)]",
        )}
      />
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// AllocationBar — 4-sleeve coloured bar
// ---------------------------------------------------------------------------

function AllocationBar({ scenario }: { scenario: ProductStrategyScenario }) {
  const a = scenario.allocation;
  const sleeves = [
    { key: "mining" as const, bps: a.miningBps },
    { key: "btc" as const, bps: a.btcBps },
    { key: "stableReserve" as const, bps: a.stableReserveBps },
    { key: "yieldOverlay" as const, bps: a.yieldOverlayBps },
  ];

  return (
    <div className="flex flex-col gap-(--ct-space-2)">
      {/* Bar */}
      <div className="flex h-[6px] w-full overflow-hidden rounded-(--ct-radius-full) bg-[var(--ct-bg-surface)]">
        {sleeves.map((s) =>
          s.bps > 0 ? (
            <span
              key={s.key}
              style={{
                width: `${bpsToPct(s.bps)}%`,
                backgroundColor: SLEEVE_COLORS[s.key],
              }}
              title={`${SLEEVE_LABEL[s.key]} ${pct(s.bps)}`}
            />
          ) : null,
        )}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-(--ct-space-3) gap-y-(--ct-space-1)">
        {sleeves.map((s) => (
          <span
            key={s.key}
            className="flex items-center gap-(--ct-space-1) text-[length:var(--ct-text-2xs)] text-[var(--ct-text-tertiary)] tabular-nums"
          >
            <span
              aria-hidden
              className="block h-[6px] w-[6px] rounded-[2px] flex-shrink-0"
              style={{ backgroundColor: SLEEVE_COLORS[s.key] }}
            />
            {SLEEVE_LABEL[s.key]} {pct(s.bps)}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScenarioCard — compact 3-up scenario card
// ---------------------------------------------------------------------------

function ScenarioCard({
  scenario,
  isDefault,
}: {
  scenario: ProductStrategyScenario;
  isDefault: boolean;
}) {
  const asm = scenario.assumptions;

  const perfRange =
    asm.totalPerformanceLowBps !== undefined && asm.totalPerformanceHighBps !== undefined
      ? `${pct(asm.totalPerformanceLowBps)}–${pct(asm.totalPerformanceHighBps)}`
      : null;

  const distRange =
    asm.distributionTargetLowBps !== undefined && asm.distributionTargetHighBps !== undefined
      ? `${pct(asm.distributionTargetLowBps)}–${pct(asm.distributionTargetHighBps)}`
      : null;

  const floor = asm.floorBps !== undefined ? pct(asm.floorBps) : null;

  return (
    <div
      className={cn(
        "flex flex-col gap-(--ct-space-4) rounded-(--ct-radius-xl) border p-(--ct-space-4) min-w-0",
        "transition-colors",
        isDefault
          ? "border-[var(--ct-border-accent,var(--ct-border))] bg-[color-mix(in_srgb,var(--ct-accent)_4%,transparent)]"
          : "border-[var(--ct-border)] bg-[var(--ct-bg-surface)]",
      )}
    >
      {/* Label + meta */}
      <div className="flex items-start justify-between gap-(--ct-space-2)">
        <div className="flex flex-col gap-(--ct-space-0_5)">
          <span
            className={cn(
              "text-[length:var(--ct-text-sm)] font-semibold leading-tight",
              isDefault ? "text-[var(--ct-accent)]" : "text-[var(--ct-text-strong)]",
            )}
          >
            {scenario.label}
          </span>
          {isDefault && (
            <span className="text-[length:var(--ct-text-2xs)] text-[var(--ct-text-tertiary)]">
              default
            </span>
          )}
        </div>
        <span className="text-[length:var(--ct-text-2xs)] text-[var(--ct-text-faint)] tabular-nums font-mono whitespace-nowrap">
          σ ×{asm.volatilityMultiplier} · {asm.horizonMonths}m
        </span>
      </div>

      {/* Allocation bar */}
      <AllocationBar scenario={scenario} />

      {/* KPIs */}
      <dl className="grid grid-cols-[1fr_auto] gap-x-(--ct-space-3) gap-y-(--ct-space-1_5)">
        {perfRange !== null && (
          <>
            <dt className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-tertiary)] self-center">
              APY range
            </dt>
            <dd className="text-[length:var(--ct-text-sm)] font-semibold text-[var(--ct-text-strong)] tabular-nums text-right">
              {perfRange}
            </dd>
          </>
        )}
        {distRange !== null && (
          <>
            <dt className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-tertiary)] self-center">
              Monthly dist.
            </dt>
            <dd className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-body)] tabular-nums text-right">
              {distRange}
            </dd>
          </>
        )}
        {floor !== null && (
          <>
            <dt className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-tertiary)] self-center">
              Floor
            </dt>
            <dd className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-body)] tabular-nums text-right">
              {floor}
            </dd>
          </>
        )}
      </dl>

      {/* Narrative bullets */}
      {scenario.narrativeBullets.length > 0 && (
        <ul className="flex flex-col gap-(--ct-space-1) border-t border-[var(--ct-border)] pt-(--ct-space-3)">
          {scenario.narrativeBullets.map((b) => (
            <li
              key={b}
              className="flex gap-(--ct-space-1_5) text-[length:var(--ct-text-2xs)] text-[var(--ct-text-faint)] [overflow-wrap:anywhere]"
            >
              <span aria-hidden className="text-[var(--ct-text-tertiary)] flex-shrink-0">
                ·
              </span>
              {b}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SelectionRulesTable — only rendered when rules exist
// ---------------------------------------------------------------------------

function SelectionRulesPanel({ strategy }: { strategy: ProductStrategy }) {
  const rules = strategy.selectionRules;
  const hasKeywords = rules.keywords.length > 0;
  const hasFamilies = rules.productFamilies.length > 0;
  const hasProfiles = rules.riskProfiles.length > 0;
  const hasPriorities = rules.priorities.length > 0;

  if (!hasKeywords && !hasFamilies && !hasProfiles && !hasPriorities) {
    return null;
  }

  return (
    <section className="flex flex-col gap-(--ct-space-4)">
      <h4 className="text-[length:var(--ct-text-xs)] font-medium text-[var(--ct-text-tertiary)] uppercase tracking-widest">
        Selection Rules
      </h4>
      <div className="overflow-hidden rounded-(--ct-radius-xl) border border-[var(--ct-border)]">
        <table className="w-full text-[length:var(--ct-text-xs)]">
          <thead>
            <tr className="border-b border-[var(--ct-border)] bg-[var(--ct-bg-surface)]">
              <th className="px-(--ct-space-4) py-(--ct-space-2_5) text-left font-medium text-[var(--ct-text-tertiary)]">
                Dimension
              </th>
              <th className="px-(--ct-space-4) py-(--ct-space-2_5) text-left font-medium text-[var(--ct-text-tertiary)]">
                Values
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--ct-border)]">
            {hasKeywords && (
              <tr>
                <td className="px-(--ct-space-4) py-(--ct-space-3) text-[var(--ct-text-body)] whitespace-nowrap">
                  Keywords
                </td>
                <td className="px-(--ct-space-4) py-(--ct-space-3)">
                  <div className="flex flex-wrap gap-(--ct-space-1)">
                    {rules.keywords.map((kw) => (
                      <span
                        key={kw}
                        className="rounded-(--ct-radius-sm) bg-[var(--ct-bg-surface)] border border-[var(--ct-border)] px-(--ct-space-2) py-[2px] text-[var(--ct-text-body)] font-mono"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            )}
            {hasFamilies && (
              <tr>
                <td className="px-(--ct-space-4) py-(--ct-space-3) text-[var(--ct-text-body)] whitespace-nowrap">
                  Families
                </td>
                <td className="px-(--ct-space-4) py-(--ct-space-3)">
                  <div className="flex flex-wrap gap-(--ct-space-1)">
                    {rules.productFamilies.map((f) => (
                      <span
                        key={f}
                        className="rounded-(--ct-radius-sm) bg-[var(--ct-bg-surface)] border border-[var(--ct-border)] px-(--ct-space-2) py-[2px] text-[var(--ct-text-body)]"
                      >
                        {PRODUCT_FAMILY_LABEL[f]}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            )}
            {hasProfiles && (
              <tr>
                <td className="px-(--ct-space-4) py-(--ct-space-3) text-[var(--ct-text-body)] whitespace-nowrap">
                  Risk profiles
                </td>
                <td className="px-(--ct-space-4) py-(--ct-space-3)">
                  <div className="flex flex-wrap gap-(--ct-space-1)">
                    {rules.riskProfiles.map((r) => (
                      <span
                        key={r}
                        className="rounded-(--ct-radius-sm) bg-[var(--ct-bg-surface)] border border-[var(--ct-border)] px-(--ct-space-2) py-[2px] text-[var(--ct-text-body)] capitalize"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            )}
            {hasPriorities && (
              <tr>
                <td className="px-(--ct-space-4) py-(--ct-space-3) text-[var(--ct-text-body)] whitespace-nowrap">
                  Priorities
                </td>
                <td className="px-(--ct-space-4) py-(--ct-space-3)">
                  <div className="flex flex-wrap gap-(--ct-space-1)">
                    {rules.priorities.map((p) => (
                      <span
                        key={p}
                        className="rounded-(--ct-radius-sm) bg-[var(--ct-bg-surface)] border border-[var(--ct-border)] px-(--ct-space-2) py-[2px] text-[var(--ct-text-body)]"
                      >
                        {PRIORITY_LABEL[p]}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            )}
            <tr>
              <td className="px-(--ct-space-4) py-(--ct-space-3) text-[var(--ct-text-body)] whitespace-nowrap">
                Min. confidence
              </td>
              <td className="px-(--ct-space-4) py-(--ct-space-3) text-[var(--ct-text-body)] tabular-nums font-mono">
                {Math.round(rules.minConfidence * 100)}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// StrategyCard — clickable card in the library grid
// ---------------------------------------------------------------------------

function StrategyCard({
  strategy,
  isSelected,
  onClick,
}: {
  strategy: ProductStrategy;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left flex flex-col gap-(--ct-space-3) rounded-(--ct-radius-xl) border p-(--ct-space-4)",
        "transition-colors cursor-pointer",
        isSelected
          ? "border-[var(--ct-border-accent,var(--ct-border))] bg-[color-mix(in_srgb,var(--ct-accent)_6%,transparent)]"
          : "border-[var(--ct-border)] bg-[var(--ct-bg-surface)] hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_3%,transparent)]",
      )}
    >
      {/* Top row: status + fallback badge */}
      <div className="flex items-center justify-between gap-(--ct-space-2)">
        <StatusPill status={strategy.status} />
        {strategy.isFallback && (
          <span className="text-[length:var(--ct-text-2xs)] text-[var(--ct-text-faint)] border border-[var(--ct-border)] rounded-(--ct-radius-sm) px-(--ct-space-1_5) py-[2px]">
            fallback
          </span>
        )}
      </div>

      {/* Name */}
      <span
        className={cn(
          "text-[length:var(--ct-text-sm)] font-semibold leading-tight",
          isSelected ? "text-[var(--ct-accent)]" : "text-[var(--ct-text-strong)]",
        )}
      >
        {strategy.name}
      </span>

      {/* Meta chips */}
      <div className="flex flex-col gap-(--ct-space-1)">
        <div className="flex flex-wrap gap-(--ct-space-1)">
          <span className="text-[length:var(--ct-text-2xs)] text-[var(--ct-text-tertiary)] bg-[var(--ct-bg-deep)] rounded-(--ct-radius-sm) px-(--ct-space-1_5) py-[2px]">
            {PRODUCT_FAMILY_LABEL[strategy.productFamily]}
          </span>
          <span className="text-[length:var(--ct-text-2xs)] text-[var(--ct-text-tertiary)] bg-[var(--ct-bg-deep)] rounded-(--ct-radius-sm) px-(--ct-space-1_5) py-[2px] capitalize">
            {strategy.defaultRiskProfile}
          </span>
          <span className="text-[length:var(--ct-text-2xs)] text-[var(--ct-text-faint)] bg-[var(--ct-bg-deep)] rounded-(--ct-radius-sm) px-(--ct-space-1_5) py-[2px]">
            {strategy.defaultHorizonMonths}m
          </span>
        </div>
      </div>

      {/* Mini allocation preview */}
      <div className="flex h-[4px] w-full overflow-hidden rounded-(--ct-radius-full) bg-[color-mix(in_srgb,var(--ct-text-strong)_6%,transparent)]">
        {(
          [
            { key: "mining" as const, bps: strategy.scenarios.balanced.allocation.miningBps },
            { key: "btc" as const, bps: strategy.scenarios.balanced.allocation.btcBps },
            { key: "stableReserve" as const, bps: strategy.scenarios.balanced.allocation.stableReserveBps },
            { key: "yieldOverlay" as const, bps: strategy.scenarios.balanced.allocation.yieldOverlayBps },
          ] as const
        ).map((s) =>
          s.bps > 0 ? (
            <span
              key={s.key}
              style={{
                width: `${bpsToPct(s.bps)}%`,
                backgroundColor: SLEEVE_COLORS[s.key],
              }}
            />
          ) : null,
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// StrategyDetail — expanded panel for selected strategy
// ---------------------------------------------------------------------------

function StrategyDetail({ strategy }: { strategy: ProductStrategy }) {
  return (
    <div className="flex flex-col gap-(--ct-space-6)">
      {/* Header */}
      <div className="flex flex-col gap-(--ct-space-2) border-b border-[var(--ct-border)] pb-(--ct-space-5)">
        <div className="flex flex-wrap items-center gap-(--ct-space-3)">
          <h3 className="text-[length:var(--ct-text-lg)] font-semibold text-[var(--ct-text-strong)] leading-tight">
            {strategy.name}
          </h3>
          <StatusPill status={strategy.status} />
          {strategy.isFallback && (
            <span className="text-[length:var(--ct-text-2xs)] text-[var(--ct-text-faint)] border border-[var(--ct-border)] rounded-(--ct-radius-sm) px-(--ct-space-1_5) py-[2px]">
              fallback
            </span>
          )}
        </div>

        {strategy.description && (
          <p className="text-[length:var(--ct-text-sm)] text-[var(--ct-text-body)] max-w-prose [overflow-wrap:anywhere]">
            {strategy.description}
          </p>
        )}

        <div className="flex flex-wrap gap-x-(--ct-space-4) gap-y-(--ct-space-1) text-[length:var(--ct-text-xs)] text-[var(--ct-text-tertiary)]">
          <span>
            Family:{" "}
            <span className="text-[var(--ct-text-body)]">
              {PRODUCT_FAMILY_LABEL[strategy.productFamily]}
            </span>
          </span>
          <span>
            Default risk:{" "}
            <span className="text-[var(--ct-text-body)] capitalize">{strategy.defaultRiskProfile}</span>
          </span>
          <span>
            Horizon:{" "}
            <span className="text-[var(--ct-text-body)]">{strategy.defaultHorizonMonths}m</span>
          </span>
          <span>
            Priority:{" "}
            <span className="text-[var(--ct-text-body)]">{PRIORITY_LABEL[strategy.defaultPriority]}</span>
          </span>
        </div>
      </div>

      {/* 3 scenario cards */}
      <section className="flex flex-col gap-(--ct-space-4)">
        <h4 className="text-[length:var(--ct-text-xs)] font-medium text-[var(--ct-text-tertiary)] uppercase tracking-widest">
          Scenarios
        </h4>
        <div className="grid gap-(--ct-space-4) sm:grid-cols-3">
          <ScenarioCard
            scenario={strategy.scenarios.safe}
            isDefault={strategy.defaultRiskProfile === "safe"}
          />
          <ScenarioCard
            scenario={strategy.scenarios.balanced}
            isDefault={strategy.defaultRiskProfile === "balanced"}
          />
          <ScenarioCard
            scenario={strategy.scenarios.opportunistic}
            isDefault={strategy.defaultRiskProfile === "opportunistic"}
          />
        </div>
      </section>

      {/* Selection rules (skipped silently if empty) */}
      <SelectionRulesPanel strategy={strategy} />

      {/* Disclaimers */}
      {strategy.disclaimers.length > 0 && (
        <section className="flex flex-col gap-(--ct-space-2) rounded-(--ct-radius-xl) border border-[var(--ct-border)] p-(--ct-space-4) bg-[var(--ct-bg-surface)]">
          <h4 className="text-[length:var(--ct-text-2xs)] font-medium text-[var(--ct-text-faint)] uppercase tracking-widest">
            Disclaimers
          </h4>
          <ul className="flex flex-col gap-(--ct-space-1_5)">
            {strategy.disclaimers.map((d) => (
              <li
                key={d}
                className="text-[length:var(--ct-text-2xs)] text-[var(--ct-text-faint)] [overflow-wrap:anywhere]"
              >
                {d}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StrategyLibrary — main export
// ---------------------------------------------------------------------------

export function StrategyLibrary() {
  const firstActive = PRODUCT_STRATEGIES.find((s) => s.status === "active") ?? PRODUCT_STRATEGIES[0];
  const [selectedId, setSelectedId] = useState<string>(firstActive?.id ?? "");

  const selected = PRODUCT_STRATEGIES.find((s) => s.id === selectedId) ?? firstActive;

  if (!PRODUCT_STRATEGIES.length) {
    return (
      <div className="p-(--ct-space-8) text-[length:var(--ct-text-sm)] text-[var(--ct-text-faint)] text-center">
        No strategies configured.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-(--ct-space-8) p-(--ct-space-5)">
      {/* --- Library strip header --- */}
      <div className="flex flex-col gap-(--ct-space-1)">
        <div className="flex items-baseline justify-between gap-(--ct-space-3)">
          <h2 className="text-[length:var(--ct-text-base)] font-semibold text-[var(--ct-text-strong)]">
            Strategy Library
          </h2>
          <span className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-faint)] tabular-nums">
            {PRODUCT_STRATEGIES.length} strateg{PRODUCT_STRATEGIES.length === 1 ? "y" : "ies"}
            {" · "}
            {PRODUCT_STRATEGIES.filter((s) => s.status === "active").length} active
          </span>
        </div>
        <p className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-tertiary)]">
          Select a strategy to inspect its three risk scenarios and selection rules.
        </p>
      </div>

      {/* --- Card grid --- */}
      <div className="grid grid-cols-2 gap-(--ct-space-3) sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {PRODUCT_STRATEGIES.map((s) => (
          <StrategyCard
            key={s.id}
            strategy={s}
            isSelected={s.id === selectedId}
            onClick={() => setSelectedId(s.id)}
          />
        ))}
      </div>

      {/* --- Divider --- */}
      <div className="h-px bg-[var(--ct-border)]" />

      {/* --- Detail panel --- */}
      {selected !== undefined && <StrategyDetail strategy={selected} />}
    </div>
  );
}
