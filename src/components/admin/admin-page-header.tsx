import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Uniform admin page title. Optional `lead` (back links on deep routes only),
 * `eyebrow` (rare context label — not a breadcrumb trail), `description`,
 * and `actions` on the same row as the H1.
 */
export function AdminPageHeader({
  title,
  eyebrow,
  description,
  lead,
  actions,
  children,
  className,
}: {
  title: string;
  eyebrow?: string;
  description?: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-4", className)}>
      <div className="flex min-h-9 flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-1">
          {lead}
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h1 className="h1 shrink-0">{title}</h1>
          {description ? (
            <div className="body-md max-w-xl ct-text-muted">{description}</div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {children}
    </header>
  );
}
