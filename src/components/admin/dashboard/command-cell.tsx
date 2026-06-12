import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { EmptySurface } from "@/components/ui/empty-surface";
import { cn } from "@/lib/cn";

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
      <Card className={cn(CELL, "dashboard-command-cell--awaiting")}>
        <EmptySurface
          variant="inline"
          message={emptyMessage}
          ariaLabel={emptyAriaLabel}
        />
      </Card>
    );
  }

  return <Card className={CELL}>{children}</Card>;
}
