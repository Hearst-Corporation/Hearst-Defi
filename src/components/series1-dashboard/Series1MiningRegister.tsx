// Series1MiningRegister — the operational read behind the accumulation.
//
// Mining figures are kept SEPARATE from the investor outcome (they are an
// operational report, not a return), and every row keeps its own provenance.
// Rows are drawn by Series1DashboardRow, whose separators are per-row borders
// rather than a `gap-px` grid gutter (canon F2).

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { surfaceNoticeWell } from "@/lib/ui/surface-classes";

import {
  Series1DashboardCard,
  Series1DashboardCardHeader,
  Series1DashboardRow,
} from "./Series1DashboardSection";
import { Series1DataState } from "./Series1DataState";

export interface Series1RegisterRow {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  muted?: boolean;
}

export function Series1MiningRegister({
  title,
  caption,
  rows,
  motive,
  trailing,
  className,
}: {
  title: string;
  caption?: ReactNode;
  rows: readonly Series1RegisterRow[];
  /** Stated ONCE for the whole card (canon §5), not per row. */
  motive: string | null;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <Series1DashboardCard variant="quiet" className={className}>
      <Series1DashboardCardHeader title={title} caption={caption} trailing={trailing} />
      <div className="flex flex-1 flex-col">
        {rows.map((row) => (
          <Series1DashboardRow
            key={row.label}
            label={row.label}
            value={row.value}
            hint={row.hint}
            muted={row.muted}
          />
        ))}
      </div>
      {motive ? (
        <div className={cn(surfaceNoticeWell, "px-[var(--ct-space-5)] py-[var(--ct-space-3)]")}>
          <Series1DataState motive={motive} />
        </div>
      ) : null}
    </Series1DashboardCard>
  );
}
