import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { EmptySurface } from "@/components/ui/empty-surface";
import { SystemPanel } from "@/components/ui/system-panel";

const CELL = "dashboard-command-cell";

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
        variant="inline"
        className={CELL}
        message={emptyMessage}
        ariaLabel={emptyAriaLabel}
      />
    );
  }

  const Shell = surface === "card" ? Card : SystemPanel;
  return <Shell className={CELL}>{children}</Shell>;
}
