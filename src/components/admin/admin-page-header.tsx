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
  actionsLayout = "inline",
  children,
  className,
}: {
  title: string;
  eyebrow?: string;
  description?: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  /** Stack actions vertically on narrow panels (dashboard vault pills). */
  actionsLayout?: "inline" | "stack";
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("admin-page-header", className)}>
      <div className="admin-page-header__row">
        <div className="admin-page-header__main">
          {lead}
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h1 className="h1 shrink-0">{title}</h1>
          {description ? (
            <div className="body-md mt-1 ct-prose-md ct-text-muted">{description}</div>
          ) : null}
        </div>
        {actions ? (
          <div
            className={cn(
              "admin-page-header__actions",
              actionsLayout === "stack" && "admin-page-header__actions--stack",
            )}
          >
            {actions}
          </div>
        ) : null}
      </div>
      {children}
    </header>
  );
}
