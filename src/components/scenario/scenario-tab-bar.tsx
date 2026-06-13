"use client";

// ScenarioTabBar — top-level tab toggle (Scenario / Backtest).
// Extracted from lab-shell.tsx. Behaviour preserved (arrow-key nav, ARIA).

import { Button } from "@/components/ui/button";

export type LabTab = "scenario" | "backtest";

interface ScenarioTabBarProps {
  active: LabTab;
  onChange: (tab: LabTab) => void;
}

const TABLIST_CLASS = "scenario-lab-tablist";
const TAB_BASE_CLASS =
  "scenario-lab-tab px-3 capitalize shadow-none active:scale-100";

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
      className={TABLIST_CLASS}
      onKeyDown={handleKeyDown}
    >
      {(["scenario", "backtest"] as LabTab[]).map((tab) => {
        const isActive = active === tab;
        return (
          <Button
            key={tab}
            type="button"
            role="tab"
            id={`tab-${tab}`}
            aria-controls={`tabpanel-${tab}`}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            variant="ghost"
            size="sm"
            onClick={() => onChange(tab)}
            data-active={isActive}
            className={TAB_BASE_CLASS}
          >
            {tab === "scenario" ? "Scenario" : "Backtest"}
          </Button>
        );
      })}
    </nav>
  );
}
