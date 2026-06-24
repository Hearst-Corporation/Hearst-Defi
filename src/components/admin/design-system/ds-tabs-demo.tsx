"use client";

import { useId, useState } from "react";

import { SegmentedControl } from "@/components/ui/segmented-control";

/**
 * Interactive demo of the canonical SegmentedControl primitive for the
 * design-system reference page. The only client component on the page — the
 * rest is server-rendered. Selection stays QUIET (surface lift, no accent
 * fill) per the segmented-control contract.
 */
type DemoTab = "overview" | "evidence" | "activity";

const ITEMS: ReadonlyArray<{ value: DemoTab; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "evidence", label: "Evidence" },
  { value: "activity", label: "Activity" },
];

const PANELS: Record<DemoTab, string> = {
  overview: "Tabs switch a view in place — no navigation, no accent fill on the active tab.",
  evidence: "The active surface lifts quietly; the green accent is reserved for the primary action.",
  activity: "Arrow / Home / End keys move the selection (roving tabindex, role=tablist).",
};

export function DsTabsDemo() {
  const [tab, setTab] = useState<DemoTab>("overview");
  const baseId = useId();

  return (
    <div className="admin-doc-stack--tight">
      <SegmentedControl
        items={ITEMS.map((it) => ({
          ...it,
          id: `${baseId}-${it.value}-tab`,
          controls: `${baseId}-${it.value}-panel`,
        }))}
        value={tab}
        onChange={setTab}
        ariaLabel="Design system tabs demo"
      />
      {ITEMS.map((it) => (
        <div
          key={it.value}
          role="tabpanel"
          id={`${baseId}-${it.value}-panel`}
          aria-labelledby={`${baseId}-${it.value}-tab`}
          hidden={it.value !== tab}
          tabIndex={0}
          className="body-sm ct-text-body"
        >
          {PANELS[it.value]}
        </div>
      ))}
    </div>
  );
}
