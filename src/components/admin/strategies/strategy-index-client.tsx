"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

import { AdminSectionCard } from "@/components/admin/admin-page-shell";
import { cn } from "@/lib/cn";
import type { ProductStrategy } from "@/lib/product-strategies";
import { useStrategyStore, persistencePending } from "@/components/admin/strategies/use-strategy-store";
import { StrategyCard } from "@/components/admin/strategies/strategy-card";
import { CreateStrategyModal } from "@/components/admin/strategies/create-strategy-modal";
import { CockpitButton } from "@/components/catalyst/cockpit-button";
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

function countDistinctFamilies(strategies: ProductStrategy[]): number {
  return new Set(strategies.map((s) => s.productFamily)).size;
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
            Export all
          </button>
        </div>
      )}
    </div>
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

  const live = store.strategies.filter((s) => s.status === "active").length;
  const drafts = store.strategies.filter((s) => s.status === "draft").length;
  const families = countDistinctFamilies(store.strategies);
  const lastUpdated = latestUpdatedAt(store.strategies);

  const openCreate = useCallback(() => {
    setModalOpen(true);
  }, []);

  const handleModalSave = useCallback(
    async (s: ProductStrategy) => {
      // Create local optimistic
      const created = store.create(s);
      
      // Persist to DB
      const rulesWithScenario = LAB_BASE_RULES.map(r => ({ ...r, scenario: created.defaultRiskProfile }));
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

  const handleOpenLabFromCard = useCallback(
    (strategy: ProductStrategy) => {
      router.push(`/admin/strategies/${strategy.slug}?tab=lab`);
    },
    [router],
  );

  const handleUseForProduct = useCallback(
    (strategy: ProductStrategy) => {
      // In the new UX, maybe we navigate to the strategy workspace to do this, 
      // or we handle it from there. For now, open the strategy workspace with a query param.
      router.push(`/admin/strategies/${strategy.slug}?use=true`);
    },
    [router],
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
                  selected={false}
                  onSelect={handleSelectStrategy}
                  onOpenLab={handleOpenLabFromCard}
                  onUseForProduct={handleUseForProduct}
                />
              ))}
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
