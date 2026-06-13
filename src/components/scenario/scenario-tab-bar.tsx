"use client";

// ScenarioTabBar — top-level tab toggle (Scenario / Backtest).
// Extracted from lab-shell.tsx. Behaviour preserved (arrow-key nav, ARIA).

import { cn } from "@/lib/cn";

export type LabTab = "scenario" | "backtest";

interface ScenarioTabBarProps {
  active: LabTab;
  onChange: (tab: LabTab) => void;
}

export function ScenarioTabBar({ active, onChange }: ScenarioTabBarProps) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLElement>) {
    const tabs: LabTab[] = ["scenario", "backtest"];
    const idx = tabs.indexOf(active);
    if (e.key === "ArrowRight") {
      e.preventDefault();
      onChange(tabs[(idx + 1) % tabs.length]!);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      onChange(tabs[(idx - 1 + tabs.length) % tabs.length]!);
    }
  }

  return (
    <nav
      role="tablist"
      aria-label="Scenario Lab tabs"
      aria-orientation="horizontal"
      className="doc-flow-tablist"
      onKeyDown={handleKeyDown}
    >
      {(["scenario", "backtest"] as LabTab[]).map((tab) => {
        const isActive = active === tab;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`tab-${tab}`}
            aria-controls={`tabpanel-${tab}`}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab)}
            className={cn(
              "rounded-md border-b-2 px-3 py-1.5 body-sm font-medium ct-transition-base",
              isActive
                ? "ct-text-strong border-b-(--ct-border-strong)"
                : "ct-text-muted border-b-transparent hover:ct-text-primary",
            )}
          >
            {tab === "scenario" ? "Scenario" : "Backtest"}
          </button>
        );
      })}
    </nav>
  );
}
