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
        // Light rakes across the panel from the top-left, fading well before
        // the opposite corner — the fill stays the panel tone, the gradient
        // only bends it.
        background:
          "linear-gradient(150deg, rgba(255,255,255,0.028), rgba(255,255,255,0) 18rem), var(--s1-panel)",
        borderColor: "var(--s1-line-strong)",
        boxShadow: "var(--s1-shadow-panel)",
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
      style={{
        // Header band sits a touch above the panel body, closed by a rule that
        // reads as a real edge (hairline + a sliver of shade under it).
        background: "linear-gradient(180deg, rgba(255,255,255,0.022), rgba(255,255,255,0))",
        borderColor: "var(--s1-line-strong)",
        boxShadow: "0 1px 0 var(--s1-shade)",
      }}
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-[0.14em] uppercase" style={{ color: "var(--s1-text)" }}>
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
