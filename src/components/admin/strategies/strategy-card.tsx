/**
 * StrategyCard — calmer library card for the Strategy Studio.
 *
 * The card now acts primarily as a selector into the Studio, not as a dense
 * inline command bar. It keeps only the most useful read-ahead information and
 * three focused actions.
 */

"use client";

import { Card } from "@/components/catalyst/card";
import { cn } from "@/lib/cn";
import {
  PRODUCT_FAMILY_LABEL,
  RISK_LABEL,
  bpsToPct,
  type ProductStrategy,
  type RiskProfileKey,
} from "@/lib/product-strategies";
import { AllocationMiniBar } from "./strategy-card-charts";

export interface StrategyCardProps {
  strategy: ProductStrategy;
  selected?: boolean;
  onSelect: (id: string) => void;
  onUseForProduct: (strategy: ProductStrategy) => void;
  onOpenCollateral?: (strategy: ProductStrategy) => void;
}

const STATUS_LABEL: Record<string, string> = {
  active: "Live",
  draft: "Draft",
  archived: "Archived",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function StatusPill({ status }: { status: string }) {
  const isLive = status === "active";
  const isArchived = status === "archived";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-(--ct-space-2) py-(--ct-space-0_5)",
        "text-[length:var(--ct-text-2xs)] font-semibold tabular-nums shrink-0",
        isLive &&
          "border-[color-mix(in_srgb,var(--ct-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-accent)_14%,transparent)] text-[var(--ct-accent)]",
        isArchived &&
          "border-[var(--ct-border-soft)] bg-[color-mix(in_srgb,var(--ct-text-muted)_8%,transparent)] text-[var(--ct-text-muted)]",
        !isLive &&
          !isArchived &&
          "border-[var(--ct-border-soft)] bg-[color-mix(in_srgb,var(--ct-text-strong)_8%,transparent)] text-[var(--ct-text-secondary)]",
      )}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function ActionBtn({
  label,
  onClick,
  accent,
}: {
  label: string;
  onClick: (e: React.MouseEvent) => void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      className={cn(
        "inline-flex items-center rounded-(--ct-radius-sm) border px-(--ct-space-2_5) py-(--ct-space-1_5)",
        "text-[length:var(--ct-text-2xs)] font-medium transition-colors",
        accent
          ? "border-[color-mix(in_srgb,var(--ct-accent)_30%,transparent)] text-[var(--ct-accent)] hover:bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)]"
          : "border-[var(--ct-border-soft)] ct-text-secondary hover:ct-text-strong hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_4%,transparent)]",
      )}
    >
      {label}
    </button>
  );
}

function rangeLabel(
  strategy: ProductStrategy,
  profile: RiskProfileKey,
  kind: "performance" | "distribution",
): string {
  const assumptions = strategy.scenarios[profile].assumptions;
  const low =
    kind === "performance"
      ? assumptions.totalPerformanceLowBps
      : assumptions.distributionTargetLowBps;
  const high =
    kind === "performance"
      ? assumptions.totalPerformanceHighBps
      : assumptions.distributionTargetHighBps;

  if (low === undefined || high === undefined) return "—";
  return `${bpsToPct(low).toFixed(1)}–${bpsToPct(high).toFixed(1)}%`;
}

function MetaStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-(--ct-space-0_5)">
      <span className="ct-bento-label">{label}</span>
      <span className="text-[length:var(--ct-text-xs)] font-medium ct-text-strong tabular-nums">
        {value}
      </span>
    </div>
  );
}

export function StrategyCard({
  strategy,
  selected,
  onSelect,
  onUseForProduct,
  onOpenCollateral,
}: StrategyCardProps) {
  const scenarioKey = strategy.defaultRiskProfile;
  const scenario = strategy.scenarios[scenarioKey];

  return (
    <Card
      material="flat"
      hoverOverlay={false}
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
        "h-full min-w-0 cursor-pointer transition-colors",
        selected
          ? "border border-[var(--ct-accent)] shadow-[0_0_0_1px_var(--ct-accent)]"
          : "border border-transparent hover:border-[color-mix(in_srgb,var(--ct-accent)_22%,transparent)]",
        strategy.status === "archived" && "opacity-[var(--ct-opacity-70)]",
      )}
      contentClassName="flex h-full min-w-0 flex-col gap-(--ct-space-4) p-(--ct-space-5)"
    >
      <div className="flex items-start justify-between gap-(--ct-space-3)">
        <div className="min-w-0 flex-1">
          <p className="text-[length:var(--ct-text-sm)] font-semibold leading-snug ct-text-strong break-words">
            {strategy.name}
          </p>
          <p className="mt-(--ct-space-1) text-[length:var(--ct-text-2xs)] ct-text-tertiary">
            {PRODUCT_FAMILY_LABEL[strategy.productFamily]} · {RISK_LABEL[strategy.defaultRiskProfile]}
          </p>
        </div>
        <StatusPill status={strategy.status} />
      </div>

      <p className="text-[length:var(--ct-text-xs)] leading-relaxed ct-text-tertiary [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
        {strategy.description}
      </p>

      <AllocationMiniBar allocation={scenario.allocation} />

      <div className="grid grid-cols-2 gap-(--ct-space-3)">
        <MetaStat label="Perf. range" value={rangeLabel(strategy, scenarioKey, "performance")} />
        <MetaStat label="Dist. target" value={rangeLabel(strategy, scenarioKey, "distribution")} />
        <MetaStat label="Horizon" value={`${strategy.defaultHorizonMonths}m`} />
        <MetaStat label="Updated" value={formatDate(strategy.updatedAt)} />
      </div>

      <div
        className="mt-auto flex flex-wrap items-center justify-between gap-(--ct-space-2) border-t border-[var(--ct-border-soft)] pt-(--ct-space-3)"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-w-0 flex-wrap gap-(--ct-space-2)">
          <ActionBtn label="Use for Product" onClick={() => onUseForProduct(strategy)} />
          {onOpenCollateral ? (
            <ActionBtn
              label="Collateral Studio"
              accent
              onClick={() => onOpenCollateral(strategy)}
            />
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onSelect(strategy.id)}
          className="shrink-0 text-[length:var(--ct-text-2xs)] font-medium ct-text-accent hover:underline"
        >
          Open Studio →
        </button>
      </div>
    </Card>
  );
}
