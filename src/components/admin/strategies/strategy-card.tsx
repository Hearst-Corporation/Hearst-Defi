/**
 * StrategyCard — compact strategy entry for the Strategy Hub library grid.
 *
 * Renders name, status pill, family, meta row, AllocationMiniBar, MiniMetric chips
 * (conditional/modelled outputs only — no fabricated numbers), tags, and an action
 * row. selected state triggers an accent border.
 *
 * Token-only. Sleeve colours come from AllocationMiniBar (lab-colors.ts) — no hex
 * literals in this file. No forbidden words.
 */

"use client";

import { cn } from "@/lib/cn";
import {
  PRODUCT_FAMILY_LABEL,
  PRIORITY_LABEL,
  RISK_LABEL,
  bpsToPct,
  type ProductStrategy,
  type RiskProfileKey,
} from "@/lib/product-strategies";
import { AllocationMiniBar, MiniMetric } from "./strategy-card-charts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StrategyCardProps {
  strategy: ProductStrategy;
  selected?: boolean;
  onSelect: (id: string) => void;
  onEdit: (strategy: ProductStrategy) => void;
  onDuplicate: (id: string) => void;
  onOpenLab: (strategy: ProductStrategy) => void;
  onTogglePublish: (strategy: ProductStrategy) => void;
  onUseForProduct: (strategy: ProductStrategy) => void;
  onArchive: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Status pill
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<string, string> = {
  active: "Live",
  draft: "Draft",
  archived: "Archived",
};

function StatusPill({ status }: { status: string }) {
  const isLive = status === "active";
  const isArchived = status === "archived";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-(--ct-space-2) py-(--ct-space-0_5)",
        "text-[length:var(--ct-text-2xs)] font-semibold tabular-nums shrink-0",
        isLive &&
          "bg-[color-mix(in_srgb,var(--ct-accent)_15%,transparent)] text-[var(--ct-accent)] border border-[color-mix(in_srgb,var(--ct-accent)_30%,transparent)]",
        isArchived &&
          "bg-[color-mix(in_srgb,var(--ct-text-muted)_8%,transparent)] text-[var(--ct-text-muted)] border border-[var(--ct-border-soft)]",
        !isLive &&
          !isArchived &&
          "bg-[color-mix(in_srgb,var(--ct-text-strong)_8%,transparent)] text-[var(--ct-text-secondary)] border border-[var(--ct-border-soft)]",
      )}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Tag chip
// ---------------------------------------------------------------------------

function Tag({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-(--ct-radius-sm) bg-[color-mix(in_srgb,var(--ct-text-strong)_6%,transparent)] border border-[var(--ct-border-soft)] px-(--ct-space-1_5) py-(--ct-space-0_5) text-[length:var(--ct-text-2xs)] ct-text-tertiary">
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Action button (compact ghost)
// ---------------------------------------------------------------------------

function ActionBtn({
  label,
  onClick,
  accent,
  danger,
}: {
  label: string;
  onClick: (e: React.MouseEvent) => void;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      className={cn(
        "inline-flex items-center rounded-(--ct-radius-sm) px-(--ct-space-2) py-(--ct-space-1)",
        "text-[length:var(--ct-text-2xs)] font-medium ct-transition-base",
        "border border-[var(--ct-border-soft)]",
        accent &&
          "text-[var(--ct-accent)] border-[color-mix(in_srgb,var(--ct-accent)_30%,transparent)] hover:bg-[color-mix(in_srgb,var(--ct-accent)_8%,transparent)]",
        danger &&
          "text-[var(--ct-status-danger)] border-[color-mix(in_srgb,var(--ct-status-danger)_25%,transparent)] hover:bg-[color-mix(in_srgb,var(--ct-status-danger)_6%,transparent)]",
        !accent &&
          !danger &&
          "ct-text-secondary hover:ct-surface-2 hover:ct-text-strong",
      )}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Projection range helper — honest display of scenario performance range
// ---------------------------------------------------------------------------

function scenarioPerfRange(strategy: ProductStrategy, profile: RiskProfileKey): string {
  const sc = strategy.scenarios[profile];
  const low = sc.assumptions.totalPerformanceLowBps;
  const high = sc.assumptions.totalPerformanceHighBps;
  if (low === undefined || high === undefined) return "—";
  return `${bpsToPct(low).toFixed(0)}–${bpsToPct(high).toFixed(0)}%`;
}

function scenarioDistRange(strategy: ProductStrategy, profile: RiskProfileKey): string {
  const sc = strategy.scenarios[profile];
  const low = sc.assumptions.distributionTargetLowBps;
  const high = sc.assumptions.distributionTargetHighBps;
  if (low === undefined || high === undefined) return "—";
  return `${bpsToPct(low).toFixed(0)}–${bpsToPct(high).toFixed(0)}%`;
}

// ---------------------------------------------------------------------------
// StrategyCard
// ---------------------------------------------------------------------------

export function StrategyCard({
  strategy,
  selected,
  onSelect,
  onEdit,
  onDuplicate,
  onOpenLab,
  onTogglePublish,
  onUseForProduct,
  onArchive,
}: StrategyCardProps) {
  const defaultScenario: RiskProfileKey = strategy.defaultRiskProfile;
  const allocation = strategy.scenarios[defaultScenario].allocation;

  const perfRange = scenarioPerfRange(strategy, defaultScenario);
  const distRange = scenarioDistRange(strategy, defaultScenario);

  // Tags: derive from family / risk / priority
  const tags: string[] = [
    PRODUCT_FAMILY_LABEL[strategy.productFamily] ?? strategy.productFamily,
    RISK_LABEL[defaultScenario] ?? defaultScenario,
    PRIORITY_LABEL[strategy.defaultPriority] ?? strategy.defaultPriority,
  ];

  const publishLabel =
    strategy.status === "active" ? "Unpublish" : "Publish";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={() => onSelect(strategy.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(strategy.id);
        }
      }}
      className={cn(
        "flex flex-col gap-(--ct-space-3) min-w-0 rounded-(--ct-radius-lg) border",
        "bg-[var(--ct-surface-card)] p-(--ct-space-4) ct-transition-base cursor-pointer",
        "hover:border-[color-mix(in_srgb,var(--ct-accent)_30%,transparent)]",
        selected
          ? "border-[var(--ct-accent)] shadow-[0_0_0_1px_var(--ct-accent)]"
          : "border-[var(--ct-border-soft)]",
        strategy.status === "archived" && "opacity-70",
      )}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-(--ct-space-2) min-w-0">
        <div className="flex-1 min-w-0">
          <p className="text-[length:var(--ct-text-sm)] font-bold ct-text-strong leading-snug break-words">
            {strategy.name}
          </p>
          <p className="text-[length:var(--ct-text-2xs)] ct-text-tertiary mt-(--ct-space-0_5)">
            {PRODUCT_FAMILY_LABEL[strategy.productFamily] ?? strategy.productFamily}
          </p>
        </div>
        <StatusPill status={strategy.status} />
      </div>

      {/* ── Meta row ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-(--ct-space-3) text-[length:var(--ct-text-2xs)] ct-text-secondary min-w-0">
        <span>
          <span className="ct-text-tertiary">Risk</span>{" "}
          <span className="font-medium ct-text-strong">
            {RISK_LABEL[strategy.defaultRiskProfile] ?? strategy.defaultRiskProfile}
          </span>
        </span>
        <span>
          <span className="ct-text-tertiary">Horizon</span>{" "}
          <span className="font-medium ct-text-strong">
            {strategy.defaultHorizonMonths}m
          </span>
        </span>
        <span>
          <span className="ct-text-tertiary">Priority</span>{" "}
          <span className="font-medium ct-text-strong">
            {PRIORITY_LABEL[strategy.defaultPriority] ?? strategy.defaultPriority}
          </span>
        </span>
      </div>

      {/* ── Allocation bar ─────────────────────────────────────────────────── */}
      <AllocationMiniBar allocation={allocation} />

      {/* ── Metric chips — modelled, honest ───────────────────────────────── */}
      <div className="flex flex-wrap gap-(--ct-space-2) min-w-0">
        <MiniMetric
          label="Perf. range (mod.)"
          value={perfRange}
          tone="muted"
        />
        <MiniMetric
          label="Dist. target (mod.)"
          value={distRange}
          tone="muted"
        />
        <MiniMetric
          label="Horizon"
          value={`${strategy.defaultHorizonMonths}mo`}
          tone="muted"
        />
      </div>
      <p className="text-[length:var(--ct-text-2xs)] ct-text-tertiary italic">
        Modelled — conditional on stated assumptions, not guaranteed.
      </p>

      {/* ── Tags ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-(--ct-space-1_5) min-w-0">
        {tags.map((t) => (
          <Tag key={t} label={t} />
        ))}
      </div>

      {/* ── Actions ────────────────────────────────────────────────────────── */}
      <div
        className="flex flex-wrap gap-(--ct-space-1_5) pt-(--ct-space-2) border-t border-[var(--ct-border-soft)] min-w-0"
        onClick={(e) => e.stopPropagation()}
      >
        <ActionBtn label="Edit" onClick={() => onEdit(strategy)} />
        <ActionBtn label="Duplicate" onClick={() => onDuplicate(strategy.id)} />
        <ActionBtn label="Open Lab" onClick={() => onOpenLab(strategy)} accent />
        <ActionBtn
          label={publishLabel}
          onClick={() => onTogglePublish(strategy)}
          accent={strategy.status !== "active"}
        />
        <ActionBtn
          label="Use for Product"
          onClick={() => onUseForProduct(strategy)}
          accent
        />
        {strategy.status !== "archived" && (
          <ActionBtn
            label="Archive"
            onClick={() => onArchive(strategy.id)}
            danger
          />
        )}
      </div>
    </div>
  );
}
