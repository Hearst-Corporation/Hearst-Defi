import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { EmptySurface } from "@/components/ui/empty-surface";

const CELL = "dashboard-command-cell";

type DashboardCommandCellProps = {
  ready: boolean;
  emptyMessage: string;
  emptyAriaLabel?: string;
  children: ReactNode;
};

/** DS §9 — live module shell or chart empty; never nested placeholder in active shell. */
export function DashboardCommandCell({
  ready,
  emptyMessage,
  emptyAriaLabel,
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

  return <Card className={CELL}>{children}</Card>;
}
