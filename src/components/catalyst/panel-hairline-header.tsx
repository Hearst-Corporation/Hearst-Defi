import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Hairline card header — micro label + optional trailing slot.
 * Portfolio canon: ct-bento-label, bottom hairline, px-5 py-4.
 */
export function PanelHairlineHeader({
  title,
  trailing,
  className,
}: {
  title: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-[var(--ct-border-soft)] px-5 py-4",
        className,
      )}
    >
      <span className="ct-bento-label inline-flex min-w-0 items-center gap-2">
        {title}
      </span>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}
