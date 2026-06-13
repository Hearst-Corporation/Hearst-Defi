"use client";

// ScenarioModeToggle — Single / Compare sub-tab toggle.
// Extracted from lab-shell.tsx. Behaviour preserved.

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
      className="doc-flow-tablist"
      onKeyDown={handleKeyDown}
    >
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
              "rounded-md border-b-2 px-3 py-1.5 body-xs font-semibold uppercase tracking-wide ct-transition-base",
              isActive
                ? "ct-text-strong border-b-(--ct-border-strong)"
                : "ct-text-muted border-b-transparent hover:ct-text-primary",
            )}
          >
            {mode}
          </button>
        );
      })}
    </div>
  );
}
