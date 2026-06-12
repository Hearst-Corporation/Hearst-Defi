import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function VaultFlowSection({
  id,
  title,
  provenance,
  children,
  className,
}: {
  id: string;
  title: string;
  provenance?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id={id} className="h2">
          {title}
        </h2>
        {provenance}
      </div>
      {children}
    </section>
  );
}

export function VaultPanelHeader({
  title,
  eyebrow,
  trailing,
}: {
  title: string;
  eyebrow?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b ct-bc-soft px-4 py-3">
      <div className="flex flex-col gap-0.5">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h3 className="h3 ct-text-body">{title}</h3>
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}

export function VaultKpiCell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="stat-label">{label}</span>
      <span className="h4 tabular mono ct-text-strong">{children}</span>
    </div>
  );
}
