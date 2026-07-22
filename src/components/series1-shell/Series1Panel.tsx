import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

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
        "overflow-hidden rounded-xl bg-white ring-1 ring-zinc-950/[0.08] dark:bg-zinc-950/40 dark:ring-white/10",
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
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-950/5 px-5 py-4 dark:border-white/5">
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-[0.14em] text-zinc-950 uppercase dark:text-white">
          {title}
        </p>
        {description ? (
          <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{description}</p>
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
      <span className="text-sm text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="text-right text-sm font-semibold text-zinc-950 dark:text-white">
        {value}
        {hint ? (
          <span className="mt-0.5 block text-[10px] font-normal text-zinc-500 dark:text-zinc-400">
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
