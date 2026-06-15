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
    // Symmetry: the empty cell fills the same Card chrome as a populated one,
    // with a short centered "No data yet" headline and the descriptive text as
    // detail. `widget` (vs `inline`) centers the content so vide and plein
    // modules align on the same grid. No data is fabricated — this is purely the
    // awaiting-state presentation; the `ready` (populated) branch is unchanged.
    return (
      <Card className={cn(CELL, "dashboard-command-cell--awaiting")}>
        <EmptySurface
          variant="widget"
          message="No data yet"
          detail={emptyMessage}
          ariaLabel={emptyAriaLabel ?? emptyMessage}
        />
      </Card>
    );
  }

  return <Card className={CELL}>{children}</Card>;
}
