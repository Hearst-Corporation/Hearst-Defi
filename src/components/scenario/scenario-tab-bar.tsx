"use client";

import { SegmentedControl } from "@/components/ui/segmented-control";

export type LabTab = "scenario" | "backtest";

interface ScenarioTabBarProps {
  active: LabTab;
  onChange: (tab: LabTab) => void;
}

const TABS = [
  { value: "scenario", label: "Scenario" },
  { value: "backtest", label: "Backtest" },
] as const;

export function ScenarioTabBar({ active, onChange }: ScenarioTabBarProps) {
  return (
    <SegmentedControl
      items={TABS}
      value={active}
      onChange={(v) => onChange(v as LabTab)}
      variant="tablist"
      ariaLabel="Scenario Lab tabs"
      trackClassName="admin-doc-seg-track"
      scroll
    />
  );
}
