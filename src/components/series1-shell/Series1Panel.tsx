import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Series 1 shell panel — FLAT by canon. Dense row panels are not cards: no
 * fill, no ring stack, just a hairline frame so a page never becomes a wall
 * of identical raised plaques (doctrine §4 "plaques identiques partout" /
 * anti cage-in-cage, and the standing "panneaux denses = PLATS" rule).
 * Depth belongs to the ONE hero object of the route, not to every block.
 */
export function Series1Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-(--ct-radius-xl) border border-(--ct-border-soft)",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Series1PanelHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-(--ct-border-soft) px-5 py-4">
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-[0.14em] text-(--ct-text-muted) uppercase">
          {title}
        </p>
        {description ? (
          <p className="mt-1 text-xs leading-5 text-(--ct-text-faint)">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Series1Row({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <span className="text-sm text-(--ct-text-muted)">{label}</span>
      <span className="text-right text-sm font-semibold text-(--ct-text-strong) tabular-nums">
        {value}
        {hint ? (
          <span className="mt-0.5 block text-[10px] font-normal text-(--ct-text-faint)">
            {hint}
          </span>
        ) : null}
      </span>
    </div>
  );
}

export function Series1RowList({ children }: { children: ReactNode }) {
  return <div className="s1-row-list">{children}</div>;
}
