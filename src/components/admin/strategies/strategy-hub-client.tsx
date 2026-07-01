"use client";

/**
 * StrategyHubClient — Strategy Studio root client component.
 *
 * The old hub/tabs/dashboard stack is replaced by:
 *   1. a lighter Strategy Library
 *   2. an inline Strategy Studio that opens below the library
 *   3. a secondary Advanced Data Lab section
 *
 * No top-level tabs. The dominant interaction is now live allocation editing.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

import { AdminSectionCard } from "@/components/admin/admin-page-shell";
import { cn } from "@/lib/cn";
import type {
  ProductStrategy,
  RiskProfileKey,
  ScenarioAllocation,
  ScenarioAssumptions,
} from "@/lib/product-strategies";
import { bpsToPct } from "@/lib/product-strategies";
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
import { CockpitButton } from "@/components/catalyst/cockpit-button";
import { Modal } from "@/components/catalyst/modal";

type SleeveKey = keyof ScenarioAllocation;

const ALLOCATION_KEYS: readonly SleeveKey[] = [
  "miningBps",
  "btcBps",
  "stableReserveBps",
  "yieldOverlayBps",
];

const DATA_LAB_SECTION_ID = "strategy-data-lab";

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

function pctToBps(percent: number): number {
  return Math.round(percent * 100);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function rebalanceAllocation(
  allocation: ScenarioAllocation,
  changedKey: SleeveKey,
  nextBps: number,
): ScenarioAllocation {
  const target = clamp(Math.round(nextBps), 0, 10_000);
  const next: ScenarioAllocation = { ...allocation, [changedKey]: target };
  const remaining = 10_000 - target;
  const otherKeys = ALLOCATION_KEYS.filter((key) => key !== changedKey);
  const othersTotal = otherKeys.reduce((sum, key) => sum + allocation[key], 0);

  if (otherKeys.length === 0) return next;

  if (remaining <= 0) {
    otherKeys.forEach((key) => {
      next[key] = 0;
    });
    return next;
  }

  if (othersTotal <= 0) {
    const even = Math.floor(remaining / otherKeys.length);
    let leftover = remaining - even * otherKeys.length;
    otherKeys.forEach((key) => {
      next[key] = even + (leftover > 0 ? 1 : 0);
      if (leftover > 0) leftover -= 1;
    });
    return next;
  }

  const distributed = otherKeys.map((key) => {
    const raw = (remaining * allocation[key]) / othersTotal;
    return {
      key,
      value: Math.max(0, Math.floor(raw)),
      remainder: raw - Math.floor(raw),
    };
  });

  let assigned = distributed.reduce((sum, item) => sum + item.value, 0);
  const ordered = [...distributed].sort((a, b) => b.remainder - a.remainder);
  let cursor = 0;

  while (assigned < remaining && ordered.length > 0) {
    ordered[cursor % ordered.length]!.value += 1;
    assigned += 1;
    cursor += 1;
  }

  distributed.forEach((item) => {
    next[item.key] = item.value;
  });

  return next;
}

function buildLiveAssumptions(
  allocation: ScenarioAllocation,
  previous: ScenarioAssumptions,
): ScenarioAssumptions {
  const mining = bpsToPct(allocation.miningBps);
  const btc = bpsToPct(allocation.btcBps);
  const stable = bpsToPct(allocation.stableReserveBps);
  const yieldOverlay = bpsToPct(allocation.yieldOverlayBps);

  const growthMix = mining + btc;
  const protectionMix = stable + yieldOverlay;

  const distributionMid =
    2.2 + mining * 0.04 + btc * 0.008 + stable * 0.05 + yieldOverlay * 0.075;
  const distributionSpread =
    1.1 +
    Math.max(0, btc - 15) * 0.015 +
    Math.max(0, growthMix - protectionMix) * 0.01;

  const performanceMid =
    4.0 + mining * 0.1 + btc * 0.16 + stable * 0.025 + yieldOverlay * 0.085;
  const performanceSpread =
    2.4 +
    btc * 0.05 +
    Math.max(0, growthMix - protectionMix) * 0.015 +
    previous.volatilityMultiplier * 0.6;

  const floorPct = 3.0 + stable * 0.05 + yieldOverlay * 0.03 + mining * 0.01;
  const volMultiplier = clamp(
    0.8 + growthMix * 0.008 + btc * 0.004 - stable * 0.002,
    0.75,
    1.35,
  );
  const btcAnnualVol = clamp(0.42 + btc * 0.008 + mining * 0.004, 0.35, 0.95);

  return {
    ...previous,
    btcAnnualVol: Number(btcAnnualVol.toFixed(2)),
    volatilityMultiplier: Number(volMultiplier.toFixed(2)),
    distributionTargetLowBps: Math.max(
      100,
      Math.round((distributionMid - distributionSpread / 2) * 100),
    ),
    distributionTargetHighBps: Math.max(
      200,
      Math.round((distributionMid + distributionSpread / 2) * 100),
    ),
    totalPerformanceLowBps: Math.max(
      300,
      Math.round((performanceMid - performanceSpread / 2) * 100),
    ),
    totalPerformanceHighBps: Math.max(
      500,
      Math.round((performanceMid + performanceSpread / 2) * 100),
    ),
    floorBps: Math.max(100, Math.round(floorPct * 100)),
  };
}

function scrollToSection(id: string): void {
  if (typeof document === "undefined") return;
  const element = document.getElementById(id);
  if (!element) return;
  element.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------------------------------------------------------------------------
// More menu (secondary actions)
// ---------------------------------------------------------------------------

interface MoreMenuProps {
  onExport: () => void;
}

function MoreMenu({ onExport }: MoreMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <CockpitButton
        variant="ghost"
        size="md"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More actions"
        title="More actions"
      >
        •••
      </CockpitButton>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute right-0 top-full mt-(--ct-space-1) z-50 min-w-[160px]",
            "rounded-(--ct-radius-md) border border-[var(--ct-border-soft)]",
            "bg-[var(--ct-bg-panel)] shadow-lg py-(--ct-space-1)",
          )}
        >
          <button
            role="menuitem"
            className={cn(
              "w-full flex items-center gap-(--ct-space-2) px-(--ct-space-3) py-(--ct-space-2)",
              "text-[length:var(--ct-text-sm)] ct-text-secondary text-left",
              "hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_6%,transparent)]",
              "focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ct-accent)]",
              "transition-colors",
            )}
            onClick={() => {
              onExport();
              setOpen(false);
            }}
          >
            Export config
          </button>
        </div>
      )}
    </div>
  );
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
// Empty states
// ---------------------------------------------------------------------------

function EmptyLibrary({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-center gap-(--ct-space-4) py-(--ct-space-12) text-center">
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

function StudioEmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-center gap-(--ct-space-4) py-(--ct-space-12) text-center">
      <p className="text-[length:var(--ct-text-sm)] font-semibold ct-text-strong">
        Select a strategy to open the studio
      </p>
      <p className="text-[length:var(--ct-text-xs)] ct-text-tertiary max-w-xs">
        Choose an existing strategy from the library, or create a new one to start adjusting the allocation live.
      </p>
      <CockpitButton variant="secondary" size="md" onClick={onNew}>
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
  const [activeScenario, setActiveScenario] = useState<RiskProfileKey>("balanced");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [modalInitial, setModalInitial] = useState<ProductStrategy | undefined>(undefined);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productModalStrategy, setProductModalStrategy] = useState<ProductStrategy | null>(null);
  const [pendingLabScroll, setPendingLabScroll] = useState(false);

  const selected = store.strategies.find((s) => s.id === store.selectedId) ?? null;
  const live = store.strategies.filter((s) => s.status === "active").length;
  const drafts = store.strategies.filter((s) => s.status === "draft").length;
  const families = countDistinctFamilies(store.strategies);
  const lastUpdated = latestUpdatedAt(store.strategies);

  const now = useCallback(() => new Date().toISOString(), []);

  useEffect(() => {
    if (!selected || !pendingLabScroll) return;
    setPendingLabScroll(false);
    window.setTimeout(() => scrollToSection(DATA_LAB_SECTION_ID), 0);
  }, [selected, pendingLabScroll]);

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
        setActiveScenario(created.defaultRiskProfile);
      } else {
        store.update(s.id, s);
        if (store.selectedId === s.id) {
          setActiveScenario(s.defaultRiskProfile);
        }
      }
    },
    [modalMode, store],
  );

  const handleModalOpenLab = useCallback(
    (s: ProductStrategy) => {
      if (modalMode === "create") {
        const created = store.create(s);
        store.select(created.id);
        setActiveScenario(created.defaultRiskProfile);
      } else {
        store.update(s.id, s);
        store.select(s.id);
      }
      setPendingLabScroll(true);
    },
    [modalMode, store],
  );

  const handleOpenDataLab = useCallback(() => {
    if (!selected) return;
    scrollToSection(DATA_LAB_SECTION_ID);
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
        store.update(s.id, { status: "draft", updatedAt: now() });
      } else {
        store.update(s.id, { status: "active", updatedAt: now() });
      }
    },
    [now, store],
  );

  const handleUseForProduct = useCallback(
    (s: ProductStrategy) => {
      store.select(s.id);
      setActiveScenario(s.defaultRiskProfile);
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
      if (copy) {
        store.select(copy.id);
        setActiveScenario(copy.defaultRiskProfile);
      }
    },
    [store, now],
  );

  const handleSelectStrategy = useCallback(
    (id: string) => {
      const nextStrategy = store.strategies.find((s) => s.id === id);
      store.select(id);
      if (nextStrategy) {
        setActiveScenario(nextStrategy.defaultRiskProfile);
      }
    },
    [store],
  );

  const handleOpenLabFromCard = useCallback(
    (strategy: ProductStrategy) => {
      store.select(strategy.id);
      setActiveScenario(strategy.defaultRiskProfile);
      setPendingLabScroll(true);
    },
    [store],
  );

  const handleAllocationChange = useCallback(
    (sleeve: SleeveKey, nextPercent: number) => {
      if (!selected) return;
      const currentScenario = selected.scenarios[activeScenario];
      const nextAllocation = rebalanceAllocation(
        currentScenario.allocation,
        sleeve,
        pctToBps(Number.isFinite(nextPercent) ? nextPercent : 0),
      );
      const nextAssumptions = buildLiveAssumptions(
        nextAllocation,
        currentScenario.assumptions,
      );

      store.update(selected.id, {
        scenarios: {
          ...selected.scenarios,
          [activeScenario]: {
            ...currentScenario,
            allocation: nextAllocation,
            assumptions: nextAssumptions,
          },
        },
        updatedAt: now(),
      });
    },
    [activeScenario, now, selected, store],
  );

  return (
    <div className="flex flex-col gap-(--ct-space-5) min-w-0">
      <AdminSectionCard
        title="Strategy Library"
        subtitle={`${store.strategies.length} strategies · ${live} live · ${drafts} drafts · ${families} families · last updated ${lastUpdated}`}
        headerTrailing={
          <div className="flex flex-wrap items-center gap-(--ct-space-2)">
            <CockpitButton variant="primary" size="md" onClick={openCreate}>
              + New Strategy
            </CockpitButton>
            <MoreMenu onExport={handleExport} />
          </div>
        }
      >
        <div className="p-5 lg:p-6">
          {persistencePending ? (
            <div className="mb-(--ct-space-4) flex items-center gap-(--ct-space-2) rounded-(--ct-radius-lg) border border-[var(--ct-border-soft)] bg-[color-mix(in_srgb,var(--ct-status-warning)_10%,transparent)] px-(--ct-space-4) py-(--ct-space-3) text-[length:var(--ct-text-xs)] ct-text-tertiary">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--ct-status-warning)]" />
              Local draft studio — persistence is still pending.
            </div>
          ) : null}

          {store.strategies.length === 0 ? (
            <EmptyLibrary onNew={openCreate} />
          ) : (
            <div className="grid min-w-0 grid-cols-1 gap-(--ct-space-4) lg:grid-cols-2 2xl:grid-cols-3">
              {store.strategies.map((s) => (
                <StrategyCard
                  key={s.id}
                  strategy={s}
                  selected={s.id === store.selectedId}
                  onSelect={handleSelectStrategy}
                  onOpenLab={handleOpenLabFromCard}
                  onUseForProduct={handleUseForProduct}
                />
              ))}
            </div>
          )}
        </div>
      </AdminSectionCard>

      <AdminSectionCard
        title="Strategy Studio"
        subtitle={
          selected
            ? `${selected.name} · live allocation controls, central KPI zone, and scenario-aware preview.`
            : "Select a strategy to start adjusting the allocation live."
        }
        headerTrailing={
          selected ? (
            <div className="flex flex-wrap items-center gap-(--ct-space-2)">
              <CockpitButton variant="secondary" size="md" onClick={() => openEdit(selected)}>
                Edit Metadata
              </CockpitButton>
              <CockpitButton
                variant="secondary"
                size="md"
                onClick={() => handleDuplicate(selected.id)}
              >
                Duplicate
              </CockpitButton>
              <CockpitButton
                variant="secondary"
                size="md"
                onClick={() => handleTogglePublish(selected)}
              >
                {selected.status === "active" ? "Return to Draft" : "Make Live"}
              </CockpitButton>
              <CockpitButton variant="secondary" size="md" onClick={handleOpenDataLab}>
                Open Data Lab
              </CockpitButton>
              <CockpitButton
                variant="primary"
                size="md"
                onClick={() => handleUseForProduct(selected)}
              >
                Use for New Product →
              </CockpitButton>
            </div>
          ) : null
        }
      >
        <div className="p-5 lg:p-6">
          {selected ? (
            <div className="flex min-w-0 flex-col gap-(--ct-space-5)">
              <PoolAllocationHero
                strategy={selected}
                activeScenario={activeScenario}
                onScenarioChange={setActiveScenario}
                onAllocationChange={handleAllocationChange}
              />

              <ScenarioComparisonCards
                strategy={selected}
                activeScenario={activeScenario}
                onScenarioChange={setActiveScenario}
              />
            </div>
          ) : (
            <StudioEmptyState onNew={openCreate} />
          )}
        </div>
      </AdminSectionCard>

      {selected ? (
        <AdminSectionCard
          title="Advanced Data Lab"
          subtitle="Open deeper backtests, stress, and sensitivity studies only when you need them."
          ariaLabel="Advanced strategy data lab"
        >
          <div className="p-5 lg:p-6" id={DATA_LAB_SECTION_ID}>
            <StrategyDataLab strategy={selected} scenario={activeScenario} />
          </div>
        </AdminSectionCard>
      ) : null}

      <CreateStrategyModal
        key={`${modalMode}-${modalInitial?.id ?? "new"}`}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        mode={modalMode}
        initial={modalInitial}
        onSave={handleModalSave}
        onOpenLab={handleModalOpenLab}
        now={now()}
      />

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
