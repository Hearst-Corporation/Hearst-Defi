"use client";

// ScenarioModeToggle — Single / Compare sub-tab toggle.
// Witness consumer for the SegmentedControl primitive (ARIA + roving tabindex +
// keyboard + focus ring now live in the primitive, not hand-rolled here).

import {
  SegmentedControl,
  type SegmentedItem,
} from "@/components/ui/segmented-control";

export type ScenarioMode = "single" | "compare";

interface ScenarioModeToggleProps {
  active: ScenarioMode;
  onChange: (mode: ScenarioMode) => void;
}

const MODES: ReadonlyArray<SegmentedItem<ScenarioMode>> = [
  {
    value: "single",
    label: "Single",
    id: "tab-mode-single",
    controls: "tabpanel-mode-single",
  },
  {
    value: "compare",
    label: "Compare",
    id: "tab-mode-compare",
    controls: "tabpanel-mode-compare",
  },
];

export function ScenarioModeToggle({
  active,
  onChange,
}: ScenarioModeToggleProps) {
  return (
    <SegmentedControl
      items={MODES}
      value={active}
      onChange={onChange}
      ariaLabel="Scenario mode"
      variant="tablist"
      className="shrink-0"
      trackClassName="admin-doc-seg-track"
      itemClassName="uppercase body-xs font-semibold tracking-wide"
    />
  );
}
