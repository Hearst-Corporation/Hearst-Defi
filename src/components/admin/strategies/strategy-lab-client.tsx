"use client";

/**
 * Strategy Lab Client — orchestrates the three tabs of the Strategy Lab:
 *   1. Library & Scenarios — strategy selector + pool allocation hero + scenario comparison + library
 *   2. Projection — manual projection panel + strategy test panel
 *   3. Data Lab — strategy data lab (with its own internal sub-tabs)
 *
 * Receives serialized strategies from the Server Component parent.
 * All state is local; no fetch, no DB, no LLM calls here.
 */

import { useState } from "react";

import { cn } from "@/lib/cn";
import { PoolAllocationHero } from "./pool-allocation-hero";
import { ScenarioComparisonCards } from "./scenario-comparison-cards";
import { StrategyLibrary } from "./strategy-library";
import { ManualProjectionPanel } from "./manual-projection-panel";
import { StrategyTestPanel } from "./strategy-test-panel";
import { StrategyDataLab } from "./data-lab/strategy-data-lab";
import {
  PRODUCT_FAMILY_LABEL,
  type ProductStrategy,
  type RiskProfileKey,
} from "@/lib/product-strategies";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabId = "library" | "projection" | "data-lab";

interface StrategyLabClientProps {
  strategies: ProductStrategy[];
}

// ---------------------------------------------------------------------------
// Strategy selector chip
// ---------------------------------------------------------------------------

interface StrategySelectorProps {
  strategies: ProductStrategy[];
  activeId: string;
  onSelect: (id: string) => void;
}

function StrategySelector({ strategies, activeId, onSelect }: StrategySelectorProps) {
  return (
    <div className="flex gap-(--ct-space-2) overflow-x-auto pb-1">
      {strategies.map((s) => {
        const isActive = s.id === activeId;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            className={cn(
              "flex shrink-0 flex-col gap-(--ct-space-0_5) rounded-(--ct-radius-xl) border px-(--ct-space-3) py-(--ct-space-2) text-left transition-colors",
              isActive
                ? "border-[var(--ct-border-accent)] bg-[color-mix(in_srgb,var(--ct-accent)_15%,transparent)]"
                : "border-[var(--ct-border-soft)] bg-surface-inset hover:border-[var(--ct-border)] hover:bg-surface-card",
            )}
          >
            <span
              className={cn(
                "text-[length:var(--ct-text-sm)] font-medium leading-tight",
                isActive ? "ct-text-accent" : "ct-text-strong",
              )}
            >
              {s.name}
            </span>
            <span className="flex items-center gap-(--ct-space-1_5) text-[length:var(--ct-text-2xs)] ct-text-tertiary">
              <span>{PRODUCT_FAMILY_LABEL[s.productFamily]}</span>
              <span
                aria-hidden
                className={cn(
                  "inline-block h-(--ct-space-1) w-(--ct-space-1) rounded-(--ct-radius-full)",
                  s.status === "active"
                    ? "bg-[var(--ct-accent)]"
                    : s.status === "draft"
                      ? "bg-[var(--ct-text-tertiary)]"
                      : "bg-[var(--ct-border)]",
                )}
              />
              <span>{s.status}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab nav
// ---------------------------------------------------------------------------

const TABS: { id: TabId; label: string }[] = [
  { id: "library", label: "Library & Scenarios" },
  { id: "projection", label: "Projection" },
  { id: "data-lab", label: "Data Lab" },
];

interface TabNavProps {
  activeTab: TabId;
  onTabChange: (id: TabId) => void;
}

function TabNav({ activeTab, onTabChange }: TabNavProps) {
  return (
    <div
      className="sticky top-0 z-10 flex gap-(--ct-space-1) rounded-(--ct-radius-xl) border border-[var(--ct-border-soft)] bg-[var(--ct-bg-deep)] p-(--ct-space-1)"
      role="tablist"
      aria-label="Strategy lab sections"
    >
      {TABS.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex-1 rounded-(--ct-radius-lg) px-(--ct-space-3) py-(--ct-space-1_5) text-[length:var(--ct-text-sm)] font-medium transition-colors",
              isActive
                ? "border border-[var(--ct-border-accent)] bg-[color-mix(in_srgb,var(--ct-accent)_15%,transparent)] ct-text-accent"
                : "border border-transparent ct-text-tertiary hover:ct-text-body hover:bg-surface-inset",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function StrategyLabClient({ strategies }: StrategyLabClientProps) {
  const defaultStrategy =
    strategies.find((s) => s.status === "active") ?? strategies[0];

  const [activeStrategyId, setActiveStrategyId] = useState<string>(
    defaultStrategy?.id ?? "",
  );
  const [activeScenario, setActiveScenario] = useState<RiskProfileKey>("balanced");
  const [activeTab, setActiveTab] = useState<TabId>("library");

  const activeStrategy = strategies.find((s) => s.id === activeStrategyId) ?? strategies[0];

  return (
    <div className="flex flex-col gap-(--ct-space-6) p-(--ct-space-5)">
      {/* Horizontal sub-nav */}
      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab: Library & Scenarios */}
      {activeTab === "library" && (
        <div className="flex flex-col gap-(--ct-space-6)">
          {strategies.length > 0 && (
            <StrategySelector
              strategies={strategies}
              activeId={activeStrategyId}
              onSelect={setActiveStrategyId}
            />
          )}

          {activeStrategy != null && (
            <PoolAllocationHero
              strategy={activeStrategy}
              activeScenario={activeScenario}
            />
          )}

          {activeStrategy != null && (
            <ScenarioComparisonCards
              strategy={activeStrategy}
              activeScenario={activeScenario}
              onScenarioChange={setActiveScenario}
            />
          )}

          <StrategyLibrary />
        </div>
      )}

      {/* Tab: Projection */}
      {activeTab === "projection" && (
        <div className="flex flex-col gap-(--ct-space-6)">
          <ManualProjectionPanel />
          <StrategyTestPanel />
        </div>
      )}

      {/* Tab: Data Lab */}
      {activeTab === "data-lab" && (
        <div className="flex flex-col gap-(--ct-space-6)">
          <StrategyDataLab />
        </div>
      )}
    </div>
  );
}
