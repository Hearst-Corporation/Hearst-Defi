"use client";

/**
 * StrategyIndexClient — the Strategy Hub body.
 *
 * Canon shape: one AdminSectionCard with an embedded KPI strip (library
 * headline numbers + CTA), an actionable status filter row, and the card
 * grid. One compliance line for the whole library — never per card.
 */

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

import { AdminSectionCard } from "@/components/admin/admin-page-shell";
import { EmptySurface } from "@/components/catalyst/empty-surface";
import { SegmentedControl, type SegmentedItem } from "@/components/catalyst/segmented-control";
import { CockpitButton } from "@/components/catalyst/cockpit-button";
import type { HeroKpi } from "@/lib/data/cockpit";
import type { ProductStrategy } from "@/lib/product-strategies";
import {
  useStrategyStore,
  strategyToProductPayload,
} from "@/components/admin/strategies/use-strategy-store";
import { StrategyCard } from "@/components/admin/strategies/strategy-card";
import { CreateStrategyModal } from "@/components/admin/strategies/create-strategy-modal";
import { saveStrategyWorkspace } from "@/app/admin/strategies/actions";
import { LAB_BASE_COLLATERAL, LAB_BASE_RULES } from "@/lib/strategy-data-lab";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function latestUpdatedAt(strategies: ProductStrategy[]): string {
  if (strategies.length === 0) return "—";
  const sorted = [...strategies].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  return formatDate(sorted[0]?.updatedAt ?? "");
}

type StatusFilter = "all" | "active" | "draft" | "archived";

const FILTER_ITEMS: ReadonlyArray<SegmentedItem<StatusFilter>> = [
  { value: "all", label: "All" },
  { value: "active", label: "Live" },
  { value: "draft", label: "Drafts" },
  { value: "archived", label: "Archived" },
];

// ---------------------------------------------------------------------------
// StrategyIndexClient
// ---------------------------------------------------------------------------

export function StrategyIndexClient({
  initialStrategies,
}: {
  initialStrategies: ProductStrategy[];
}) {
  const router = useRouter();
  const store = useStrategyStore(initialStrategies);
  const [modalOpen, setModalOpen] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("all");

  const live = store.strategies.filter((s) => s.status === "active").length;
  const drafts = store.strategies.filter((s) => s.status === "draft").length;
  const lastUpdated = latestUpdatedAt(store.strategies);

  const visible = useMemo(
    () =>
      filter === "all"
        ? store.strategies
        : store.strategies.filter((s) => s.status === filter),
    [filter, store.strategies],
  );

  const kpis: HeroKpi[] = [
    {
      label: "Strategies",
      value: String(store.strategies.length),
      sublabel: "templates in library",
      provenance: "live",
    },
    {
      label: "Live",
      value: String(live),
      sublabel: "active templates",
      provenance: "live",
      accent: live > 0,
    },
    {
      label: "Drafts",
      value: String(drafts),
      sublabel: "awaiting calibration",
      provenance: "live",
    },
    {
      label: "Last updated",
      value: lastUpdated,
      sublabel: "most recent change",
      provenance: "live",
    },
  ];

  const openCreate = useCallback(() => {
    setModalOpen(true);
  }, []);

  const handleModalSave = useCallback(
    async (s: ProductStrategy) => {
      // Create local optimistic
      const created = store.create(s);

      // Persist to DB
      const rulesWithScenario = LAB_BASE_RULES.map((r) => ({
        ...r,
        scenario: created.defaultRiskProfile,
      }));
      await saveStrategyWorkspace(created, LAB_BASE_COLLATERAL, rulesWithScenario);

      router.push(`/admin/strategies/${created.slug}`);
    },
    [store, router],
  );

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(store.strategies, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "strategies-export.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [store.strategies]);

  const handleSelectStrategy = useCallback(
    (id: string) => {
      const strategy = store.strategies.find((s) => s.id === id);
      if (strategy) {
        router.push(`/admin/strategies/${strategy.slug}`);
      }
    },
    [store.strategies, router],
  );

  const handleOpenCollateralStudio = useCallback(
    (strategy: ProductStrategy) => {
      router.push(`/admin/strategies/${strategy.slug}?tab=collateral`);
    },
    [router],
  );

  const handleUseForProduct = useCallback(
    (strategy: ProductStrategy) => {
      const { objective } = strategyToProductPayload(
        strategy,
        strategy.defaultRiskProfile,
      );
      router.push(
        `/admin/product-workspace?objective=${encodeURIComponent(objective)}`,
      );
    },
    [router],
  );

  return (
    <div className="flex flex-col gap-(--ct-space-5) min-w-0">
      <AdminSectionCard
        kpis={kpis}
        kpiTitle="Strategy Library"
        kpiSubtitle="Mining-backed strategy templates — three calibrated scenarios each"
        kpiAction={
          <div className="flex flex-wrap items-center gap-(--ct-space-2)">
            <CockpitButton variant="ghost" size="md" onClick={handleExport}>
              Export
            </CockpitButton>
            <CockpitButton variant="primary" size="md" onClick={openCreate}>
              + New Strategy
            </CockpitButton>
          </div>
        }
        ariaLabel="Strategy library"
      >
        <div className="flex flex-wrap items-center justify-between gap-(--ct-space-3) border-b border-[var(--ct-border-soft)] px-5 py-(--ct-space-3) lg:px-6">
          <SegmentedControl
            items={FILTER_ITEMS}
            value={filter}
            onChange={setFilter}
            ariaLabel="Filter strategies by status"
            variant="radiogroup"
            scroll={false}
          />
          <span className="text-[length:var(--ct-text-2xs)] ct-text-tertiary tabular-nums">
            {visible.length} of {store.strategies.length} shown
          </span>
        </div>

        <div className="p-5 lg:p-6">
          {visible.length === 0 ? (
            store.strategies.length === 0 ? (
              <EmptySurface
                message="No strategies yet"
                detail="Create your first strategy template to begin configuring product scenarios."
                variant="widget"
              >
                <CockpitButton variant="primary" size="md" onClick={openCreate}>
                  + New Strategy
                </CockpitButton>
              </EmptySurface>
            ) : (
              <EmptySurface
                message="No strategies match this filter"
                detail="Switch the status filter to see the rest of the library."
                variant="widget"
              />
            )
          ) : (
            <div className="flex flex-col gap-(--ct-space-4)">
              <div className="grid min-w-0 grid-cols-1 gap-(--ct-space-4) lg:grid-cols-2 2xl:grid-cols-3">
                {visible.map((s) => (
                  <StrategyCard
                    key={s.id}
                    strategy={s}
                    selected={false}
                    onSelect={handleSelectStrategy}
                    onUseForProduct={handleUseForProduct}
                    onOpenCollateral={handleOpenCollateralStudio}
                  />
                ))}
              </div>
              <p className="text-[length:var(--ct-text-2xs)] ct-text-faint">
                All figures are modelled, conditional on stated assumptions, and not
                guaranteed.
              </p>
            </div>
          )}
        </div>
      </AdminSectionCard>

      <CreateStrategyModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        mode="create"
        onSave={handleModalSave}
        now={new Date().toISOString()}
      />
    </div>
  );
}
