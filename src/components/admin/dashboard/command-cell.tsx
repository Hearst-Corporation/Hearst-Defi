import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { EmptySurface } from "@/components/ui/empty-surface";
import { SystemPanel } from "@/components/ui/system-panel";
import { cn } from "@/lib/cn";

const CELL = "dashboard-command-cell";
const EMPTY_CELL = cn(CELL, "min-h-32");

type DashboardCommandCellProps = {
  ready: boolean;
  emptyMessage: string;
  emptyAriaLabel?: string;
  /** card = primary row modules; panel = quieter instrumentation */
  surface?: "card" | "panel";
  children: ReactNode;
};

/** DS §9 — live module shell or chart empty; never nested placeholder in active shell. */
export function DashboardCommandCell({
  ready,
  emptyMessage,
  emptyAriaLabel,
  surface = "panel",
  children,
}: DashboardCommandCellProps) {
  if (!ready) {
    return (
      <EmptySurface
        variant="chart"
        className={EMPTY_CELL}
        message={emptyMessage}
        ariaLabel={emptyAriaLabel}
      />
    );
  }

  const Shell = surface === "card" ? Card : SystemPanel;
  return <Shell className={CELL}>{children}</Shell>;
}
