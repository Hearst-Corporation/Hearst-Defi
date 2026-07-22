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
      className={cn("overflow-hidden rounded-[var(--s1-radius)] border", className)}
      style={{
        background: "var(--s1-panel)",
        borderColor: "var(--s1-line)",
        boxShadow: "var(--s1-shadow)",
      }}
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
    <div
      className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4"
      style={{ borderColor: "var(--s1-line)" }}
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-[0.14em] uppercase" style={{ color: "var(--s1-muted)" }}>
          {title}
        </p>
        {description ? (
          <p className="mt-1 text-xs leading-5" style={{ color: "var(--s1-muted)" }}>
            {description}
          </p>
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
      <span className="text-sm" style={{ color: "var(--s1-muted)" }}>
        {label}
      </span>
      <span className="text-right text-sm font-semibold" style={{ color: "var(--s1-text)" }}>
        {value}
        {hint ? (
          <span className="mt-0.5 block text-[10px] font-normal" style={{ color: "var(--s1-muted)" }}>
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
