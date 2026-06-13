"use client";

// ScenarioTabBar — top-level tab toggle (Scenario / Backtest).
// Uses the same admin filter tab primitive as /admin/vaults (admin-doc-inline-row + ct-pill).

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
    <div
      role="tablist"
      aria-label="Scenario Lab tabs"
      aria-orientation="horizontal"
      className="admin-doc-inline-row"
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
            className={cn("ct-pill capitalize", isActive && "accent")}
          >
            {tab === "scenario" ? "Scenario" : "Backtest"}
          </button>
        );
      })}
    </div>
  );
}
