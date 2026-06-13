"use client";

// ScenarioTabBar — top-level tab toggle (Scenario / Backtest).
// Uses admin segmented control (ct-seg-track + ct-seg-btn) — same contract as doc-flow.

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
      className="ct-seg-scroll min-w-0"
      onKeyDown={handleKeyDown}
    >
      <div className="admin-doc-seg-track ct-seg-track">
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
              className={cn("ct-seg-btn capitalize", isActive && "active")}
            >
              {tab === "scenario" ? "Scenario" : "Backtest"}
            </button>
          );
        })}
      </div>
    </div>
  );
}
