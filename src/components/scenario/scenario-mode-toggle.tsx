"use client";

// ScenarioModeToggle — Single / Compare sub-tab toggle.

import { cn } from "@/lib/cn";

export type ScenarioMode = "single" | "compare";

interface ScenarioModeToggleProps {
  active: ScenarioMode;
  onChange: (mode: ScenarioMode) => void;
}

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
      className="ct-seg-scroll shrink-0"
      onKeyDown={handleKeyDown}
    >
      <div className="admin-doc-seg-track ct-seg-track">
        {(["single", "compare"] as ScenarioMode[]).map((mode) => {
          const isActive = active === mode;
          return (
            <button
              key={mode}
              type="button"
              role="tab"
              id={`tab-mode-${mode}`}
              aria-controls={`tabpanel-mode-${mode}`}
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(mode)}
              className={cn(
                "ct-seg-btn uppercase body-xs font-semibold tracking-wide",
                isActive && "active",
              )}
            >
              {mode}
            </button>
          );
        })}
      </div>
    </div>
  );
}
