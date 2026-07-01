"use client";

/**
 * StrategyHubClient — Strategy Hub root client component.
 *
 * Layout:
 *   1. Header block: title, subtitle, CTA row (New Strategy / Open Lab / Export).
 *   2. KPI strip: count, live, drafts, families, last-updated — honest/provenance-labelled.
 *   3. Tabs: Library · Builder · Data Lab.
 *
 * No DB, no server action, no vault creation. Product handoff = router.push with
 * query param only. No forbidden words. All tokens --ct-*, no raw hex.
 */

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/cn";
import type { ProductStrategy, RiskProfileKey } from "@/lib/product-strategies";
import {
  useStrategyStore,
  strategyToProductPayload,
  persistencePending,
} from "@/components/admin/strategies/use-strategy-store";
import { StrategyCard } from "@/components/admin/strategies/strategy-card";
import { CreateStrategyModal } from "@/components/admin/strategies/create-strategy-modal";
import { PoolAllocationHero } from "@/components/admin/strategies/pool-allocation-hero";
import { ScenarioComparisonCards } from "@/components/admin/strategies/scenario-comparison-cards";
import { StrategyDataLab } from "@/components/admin/strategies/data-lab/strategy-data-lab";
import { BentoKpiStrip } from "@/components/catalyst/bento";
import { SegmentedControl } from "@/components/catalyst/segmented-control";
import { CockpitButton } from "@/components/catalyst/cockpit-button";
import { Modal } from "@/components/catalyst/modal";

// ---------------------------------------------------------------------------
// Tab type
// ---------------------------------------------------------------------------

type HubTab = "library" | "builder" | "data-lab";

const TAB_ITEMS: ReadonlyArray<{ value: HubTab; label: string }> = [
  { value: "library", label: "Library" },
  { value: "builder", label: "Builder" },
  { value: "data-lab", label: "Data Lab" },
];

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

function countDistinctFamilies(strategies: ProductStrategy[]): number {
  return new Set(strategies.map((s) => s.productFamily)).size;
}

// ---------------------------------------------------------------------------
// Use-for-Product confirm modal
// ---------------------------------------------------------------------------

interface UseForProductModalProps {
  strategy: ProductStrategy;
  activeScenario: RiskProfileKey;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function UseForProductModal({
  strategy,
  activeScenario,
  isOpen,
  onClose,
  onConfirm,
}: UseForProductModalProps) {
  const payload = strategyToProductPayload(strategy, activeScenario);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Use strategy for new product"
      className="max-w-lg"
    >
      <div className="flex flex-col gap-(--ct-space-4) min-w-0">
        <div className="rounded-(--ct-radius-md) border border-[var(--ct-border-soft)] bg-[color-mix(in_srgb,var(--ct-text-strong)_3%,transparent)] p-(--ct-space-4)">
          <p className="text-[length:var(--ct-text-xs)] font-semibold ct-text-strong mb-(--ct-space-2)">
            {strategy.name}
          </p>
          <p className="text-[length:var(--ct-text-2xs)] ct-text-tertiary mb-(--ct-space-3)">
            Scenario: <span className="ct-text-secondary font-medium">{activeScenario}</span>
          </p>
          <p className="text-[length:var(--ct-text-2xs)] ct-text-muted font-mono break-all">
            {payload.objective}
          </p>
        </div>

        <p className="text-[length:var(--ct-text-xs)] ct-text-tertiary italic">
          This will navigate to the product workspace pre-filled with the strategy
          objective. No vault is created — all product details are configured there.
          Projections are conditional on stated assumptions, not guaranteed.
        </p>

        <div className="flex items-center justify-end gap-(--ct-space-3) pt-(--ct-space-2) border-t border-[var(--ct-border-soft)]">
          <CockpitButton variant="ghost" size="md" onClick={onClose}>
            Cancel
          </CockpitButton>
          <CockpitButton variant="primary" size="md" onClick={onConfirm}>
            Open product workspace →
          </CockpitButton>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyLibrary({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-(--ct-space-4) py-(--ct-space-12) text-center min-w-0">
      <p className="text-[length:var(--ct-text-sm)] font-semibold ct-text-strong">
        No strategies yet
      </p>
      <p className="text-[length:var(--ct-text-xs)] ct-text-tertiary max-w-xs">
        Create your first strategy template to begin configuring product scenarios.
      </p>
      <CockpitButton variant="primary" size="md" onClick={onNew}>
        + New Strategy
      </CockpitButton>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Builder tab: no selection prompt
// ---------------------------------------------------------------------------

function BuilderEmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-(--ct-space-4) py-(--ct-space-10) text-center min-w-0">
      <p className="text-[length:var(--ct-text-sm)] font-semibold ct-text-strong">
        No strategy selected
      </p>
      <p className="text-[length:var(--ct-text-xs)] ct-text-tertiary max-w-xs">
        Select a strategy from the Library, or create a new one to open the Builder.
      </p>
      <CockpitButton variant="primary" size="md" onClick={onNew}>
        + New Strategy
      </CockpitButton>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StrategyHubClient
// ---------------------------------------------------------------------------

export function StrategyHubClient({
  initialStrategies,
}: {
  initialStrategies: ProductStrategy[];
}) {
  const router = useRouter();
  const store = useStrategyStore(initialStrategies);

  // Tab state
  const [tab, setTab] = useState<HubTab>("library");

  // Active scenario for Builder / Data Lab
  const [activeScenario, setActiveScenario] = useState<RiskProfileKey>("balanced");

  // Create/Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [modalInitial, setModalInitial] = useState<ProductStrategy | undefined>(undefined);

  // Use-for-product confirm modal
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productModalStrategy, setProductModalStrategy] = useState<ProductStrategy | null>(null);

  // Selected strategy (derived from store)
  const selected = store.strategies.find((s) => s.id === store.selectedId) ?? null;

  // ── KPI strip ─────────────────────────────────────────────────────────────

  const live = store.strategies.filter((s) => s.status === "active").length;
  const drafts = store.strategies.filter((s) => s.status === "draft").length;
  const families = countDistinctFamilies(store.strategies);
  const lastUpdated = latestUpdatedAt(store.strategies);

  const kpiItems: Parameters<typeof BentoKpiStrip>[0]["items"] = [
    {
      label: "Strategies",
      value: String(store.strategies.length),
      provenance: "manual",
    },
    {
      label: "Live",
      value: String(live),
      accent: live > 0,
      provenance: "manual",
    },
    {
      label: "Drafts",
      value: String(drafts),
      provenance: "manual",
    },
    {
      label: "Families",
      value: String(families),
      provenance: "manual",
    },
    {
      label: "Last updated",
      value: lastUpdated,
      provenance: "manual",
    },
  ];

  // ── Handlers ──────────────────────────────────────────────────────────────

  const now = useCallback(() => new Date().toISOString(), []);

  const openCreate = useCallback(() => {
    setModalMode("create");
    setModalInitial(undefined);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((s: ProductStrategy) => {
    setModalMode("edit");
    setModalInitial(s);
    setModalOpen(true);
  }, []);

  const handleModalSave = useCallback(
    (s: ProductStrategy) => {
      if (modalMode === "create") {
        const created = store.create(s);
        store.select(created.id);
        setTab("builder");
      } else {
        store.update(s.id, s);
      }
    },
    [modalMode, store],
  );

  const handleModalOpenLab = useCallback(
    (s: ProductStrategy) => {
      if (modalMode === "create") {
        const created = store.create(s);
        store.select(created.id);
      } else {
        store.update(s.id, s);
        store.select(s.id);
      }
      setTab("data-lab");
    },
    [modalMode, store],
  );

  const handleOpenDataLab = useCallback(() => {
    if (!selected) return;
    setTab("data-lab");
  }, [selected]);

  const handleExport = useCallback(() => {
    const toExport = selected ? [selected] : store.strategies;
    const blob = new Blob([JSON.stringify(toExport, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = selected
      ? `strategy-${selected.slug}.json`
      : "strategies-export.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [selected, store.strategies]);

  const handleTogglePublish = useCallback(
    (s: ProductStrategy) => {
      if (s.status === "active") {
        store.unpublish(s.id);
      } else {
        store.publish(s.id);
      }
    },
    [store],
  );

  const handleOpenLabFromCard = useCallback(
    (s: ProductStrategy) => {
      store.select(s.id);
      setTab("data-lab");
    },
    [store],
  );

  const handleUseForProduct = useCallback(
    (s: ProductStrategy) => {
      store.select(s.id);
      setProductModalStrategy(s);
      setProductModalOpen(true);
    },
    [store],
  );

  const handleProductConfirm = useCallback(() => {
    if (!productModalStrategy) return;
    const payload = strategyToProductPayload(productModalStrategy, activeScenario);
    router.push(
      `/admin/product-workspace?objective=${encodeURIComponent(payload.objective)}`,
    );
  }, [productModalStrategy, activeScenario, router]);

  const handleDuplicate = useCallback(
    (id: string) => {
      const copy = store.duplicate(id, now());
      if (copy) store.select(copy.id);
    },
    [store, now],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-(--ct-space-5) min-w-0">
      {/* ── Header block ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-(--ct-space-3) min-w-0">
        <div className="min-w-0">
          <h1 className="text-[length:var(--ct-text-xl)] font-bold ct-text-strong">
            Product Strategies
          </h1>
          <p className="text-[length:var(--ct-text-xs)] ct-text-tertiary mt-(--ct-space-1)">
            Create, test, publish and deploy strategy templates for future vaults.
          </p>
        </div>

        {/* CTA row */}
        <div className="flex flex-wrap items-center gap-(--ct-space-2) min-w-0">
          <CockpitButton variant="primary" size="md" onClick={openCreate}>
            + New Strategy
          </CockpitButton>
          <CockpitButton
            variant="secondary"
            size="md"
            onClick={handleOpenDataLab}
            disabled={!selected}
            title={!selected ? "Select a strategy first" : undefined}
          >
            Open Data Lab
          </CockpitButton>
          <CockpitButton variant="secondary" size="md" onClick={handleExport}>
            Export config
          </CockpitButton>

          {/* Persistence notice */}
          {persistencePending && (
            <span className="ml-auto flex items-center gap-(--ct-space-1_5) text-[length:var(--ct-text-2xs)] ct-text-tertiary">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--ct-status-warning)] shrink-0" />
              Local draft state — persistence pending
            </span>
          )}
        </div>
      </div>

      {/* ── KPI strip ─────────────────────────────────────────────────────── */}
      <BentoKpiStrip
        items={kpiItems}
        ariaLabel="Strategy hub overview"
      />

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <SegmentedControl
        items={TAB_ITEMS}
        value={tab}
        onChange={setTab}
        ariaLabel="Strategy hub tabs"
      />

      {/* ── Tab panels ────────────────────────────────────────────────────── */}

      {/* Library */}
      {tab === "library" && (
        <div className="min-w-0">
          {store.strategies.length === 0 ? (
            <EmptyLibrary onNew={openCreate} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-(--ct-space-4) min-w-0">
              {store.strategies.map((s) => (
                <StrategyCard
                  key={s.id}
                  strategy={s}
                  selected={s.id === store.selectedId}
                  onSelect={(id) => {
                    store.select(id);
                    setTab("builder");
                  }}
                  onEdit={openEdit}
                  onDuplicate={handleDuplicate}
                  onOpenLab={handleOpenLabFromCard}
                  onTogglePublish={handleTogglePublish}
                  onUseForProduct={handleUseForProduct}
                  onArchive={store.archive}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Builder */}
      {tab === "builder" && (
        <div className="flex flex-col gap-(--ct-space-5) min-w-0">
          {selected ? (
            <>
              {/* Edit CTA */}
              <div className="flex items-center justify-between gap-(--ct-space-3) min-w-0">
                <p className="text-[length:var(--ct-text-sm)] font-semibold ct-text-strong truncate">
                  {selected.name}
                </p>
                <CockpitButton
                  variant="secondary"
                  size="md"
                  onClick={() => openEdit(selected)}
                >
                  Edit this strategy
                </CockpitButton>
              </div>

              <PoolAllocationHero
                strategy={selected}
                activeScenario={activeScenario}
                onScenarioChange={setActiveScenario}
              />

              <ScenarioComparisonCards
                strategy={selected}
                activeScenario={activeScenario}
                onScenarioChange={setActiveScenario}
              />

              {/* Use-for-Product CTA */}
              <div className="flex items-center gap-(--ct-space-3) pt-(--ct-space-3) border-t border-[var(--ct-border-soft)] min-w-0">
                <CockpitButton
                  variant="primary"
                  size="md"
                  onClick={() => handleUseForProduct(selected)}
                >
                  Use for New Product →
                </CockpitButton>
                <CockpitButton
                  variant="secondary"
                  size="md"
                  onClick={() => handleOpenLabFromCard(selected)}
                >
                  Open Data Lab
                </CockpitButton>
              </div>
            </>
          ) : (
            <BuilderEmptyState onNew={openCreate} />
          )}
        </div>
      )}

      {/* Data Lab */}
      {tab === "data-lab" && (
        <div className="min-w-0">
          {selected ? (
            <StrategyDataLab
              strategy={selected}
              scenario={activeScenario}
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-(--ct-space-4) py-(--ct-space-10) text-center min-w-0">
              <p className="text-[length:var(--ct-text-sm)] font-semibold ct-text-strong">
                No strategy selected
              </p>
              <p className="text-[length:var(--ct-text-xs)] ct-text-tertiary max-w-xs">
                Select a strategy from the Library to open the Data Lab with it
                pre-filled.
              </p>
              <CockpitButton
                variant="secondary"
                size="md"
                onClick={() => setTab("library")}
              >
                Go to Library
              </CockpitButton>
            </div>
          )}
        </div>
      )}

      {/* ── Create / Edit modal ───────────────────────────────────────────── */}
      <CreateStrategyModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        mode={modalMode}
        initial={modalInitial}
        onSave={handleModalSave}
        onOpenLab={handleModalOpenLab}
        now={now()}
      />

      {/* ── Use-for-Product confirm modal ─────────────────────────────────── */}
      {productModalStrategy && (
        <UseForProductModal
          strategy={productModalStrategy}
          activeScenario={activeScenario}
          isOpen={productModalOpen}
          onClose={() => setProductModalOpen(false)}
          onConfirm={handleProductConfirm}
        />
      )}
    </div>
  );
}
