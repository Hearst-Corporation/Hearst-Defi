import type { ReactNode } from "react";

import { surfaceClassName } from "@/lib/ui/surface-classes";

/**
 * Series 1 shell panel — same surface grammar as the dashboard (DS doctrine
 * §4): a raised card from `surfaceClassName("secondary")`, tokens only. The
 * previous `bg-white … dark:bg-zinc-950/40` twin recipe is gone — one panel
 * recipe across the investor journey.
 */
export function Series1Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={surfaceClassName("secondary", className)}>{children}</div>;
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
