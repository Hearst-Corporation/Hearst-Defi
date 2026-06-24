import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Uniform admin page title — mirror of ProductPageHeader.
 * API canon: `titleLead` + `titleAccent` + `contextLabel`.
 * API legacy: `title` (+ `accent`, `eyebrow`, `description`).
 */
export function AdminPageHeader({
  title,
  titleLead,
  titleAccent,
  accent,
  contextLabel,
  eyebrow,
  description,
  lead,
  media,
  actions,
  filters,
  beforeRule,
  children,
  className,
  align = "start",
}: {
  title?: string;
  titleLead?: string;
  titleAccent?: string;
  accent?: ReactNode;
  contextLabel?: string;
  eyebrow?: string;
  description?: ReactNode;
  lead?: ReactNode;
  media?: ReactNode;
  actions?: ReactNode;
  filters?: ReactNode;
  beforeRule?: ReactNode;
  children?: ReactNode;
  className?: string;
  align?: "start" | "center";
}) {
  const centered = align === "center";

  return (
    <header
      className={cn(
        "admin-page-header",
        centered && "admin-page-header--center",
        className,
      )}
    >
      <div
        className={cn(
          "admin-page-header__row",
          centered && "admin-page-header__row--center",
        )}
      >
        <div
          className={cn(
            "admin-page-header__main",
            centered && "admin-page-header__main--center",
          )}
        >
          {media ? <div className="shrink-0">{media}</div> : null}
          <div
            className={cn(
              "admin-page-header__title-stack",
              centered && "admin-page-header__title-stack--center",
            )}
          >
            {lead}
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h1 className="h1 shrink-0">
              {titleLead != null || titleAccent != null ? (
                <>
                  {titleLead}
                  {titleAccent ? (
                    <>
                      {titleLead ? " " : null}
                      <span className="h1-accent">{titleAccent}</span>
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  {title}
                  {accent ? <> <span className="h1-accent">{accent}</span></> : null}
                </>
              )}
            </h1>
            {contextLabel ? (
              <p className="page-canon-kicker">{contextLabel}</p>
            ) : null}
            {description ? (
              <div
                className={cn(
                  "body-md ct-prose-md ct-text-muted",
                  centered && "mx-auto",
                )}
              >
                {description}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {beforeRule}
      <div className="page-canon-rule" aria-hidden="true" />
      {filters || actions ? (
        <div
          className={cn(
            "page-canon-toolbar",
            centered && "page-canon-toolbar--center",
          )}
        >
          <div className="page-canon-toolbar__filters">{filters}</div>
          {actions ? (
            <div className="page-canon-toolbar__actions">{actions}</div>
          ) : null}
        </div>
      ) : null}
      {children}
    </header>
  );
}
