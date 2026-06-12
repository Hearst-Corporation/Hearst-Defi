"use client";

// ScenarioModeToggle — Single / Compare sub-tab toggle.
// Extracted from lab-shell.tsx. Behaviour preserved.

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export type ScenarioMode = "single" | "compare";

interface ScenarioModeToggleProps {
  active: ScenarioMode;
  onChange: (mode: ScenarioMode) => void;
}

const TABLIST_CLASS = "scenario-lab-tablist";
const TAB_BASE_CLASS =
  "scenario-lab-tab px-4 uppercase shadow-none active:scale-100";
const TAB_ACTIVE_CLASS = "hover:ct-bg-accent hover:ct-text-deep";
const TAB_INACTIVE_CLASS = "ct-text-body hover:ct-text-primary";

export function ScenarioModeToggle({
  active,
  onChange,
}: ScenarioModeToggleProps) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLElement>) {
    const modes: ScenarioMode[] = ["single", "compare"];
    const idx = modes.indexOf(active);
    if (e.key === "ArrowRight") {
      e.preventDefault();
      onChange(modes[(idx + 1) % modes.length]!);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      onChange(modes[(idx - 1 + modes.length) % modes.length]!);
    }
  }

  return (
    <div
      role="tablist"
      aria-label="Scenario mode"
      aria-orientation="horizontal"
      className={TABLIST_CLASS}
      onKeyDown={handleKeyDown}
    >
      {(["single", "compare"] as ScenarioMode[]).map((mode) => {
        const isActive = active === mode;
        return (
          <Button
            key={mode}
            type="button"
            role="tab"
            id={`tab-mode-${mode}`}
            aria-controls={`tabpanel-mode-${mode}`}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            variant="ghost"
            size="md"
            onClick={() => onChange(mode)}
            data-active={isActive}
            className={cn(
              TAB_BASE_CLASS,
              "body-xs font-semibold tracking-wide",
              isActive ? TAB_ACTIVE_CLASS : TAB_INACTIVE_CLASS,
            )}
          >
            {mode}
          </Button>
        );
      })}
    </div>
  );
}
