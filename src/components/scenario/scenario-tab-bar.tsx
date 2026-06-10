"use client";

// ScenarioTabBar — top-level tab toggle (Scenario / Backtest).
// Extracted from lab-shell.tsx. Behaviour preserved (arrow-key nav, ARIA).

import { Button } from "@/components/ui/button";
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
      onChange(tabs[(idx + 1) % tabs.length]!);
    } else if (e.key === "ArrowLeft") {
      onChange(tabs[(idx - 1 + tabs.length) % tabs.length]!);
    }
  }

  return (
    <nav
      aria-label="Scenario Lab tabs"
      className="flex gap-1 glass-panel-subtle p-1 w-fit"
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
            className={cn(
              "rounded-sm px-5 py-2 text-sm font-semibold capitalize shadow-none active:scale-100",
              isActive
                ? "bg-[var(--ct-accent)] text-[var(--ct-bg-deep)] hover:bg-[var(--ct-accent)] hover:text-[var(--ct-bg-deep)]"
                : "ct-text-body hover:ct-text-primary",
            )}
          >
            {tab === "scenario" ? "Scenario" : "Backtest"}
          </Button>
        );
      })}
    </nav>
  );
}
