import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Uniform product page title — PORTFOLIO canon skeleton (mirror of AdminPageHeader):
 *   H1 bicolore (`titleLead` + `titleAccent`) → kicker « — CONTEXTE » → trait
 *   accent (toujours rendu) → contenu (notices/erreurs APRÈS le trait).
 *
 * API canon: `titleLead` + `titleAccent` + `contextLabel`.
 * API legacy: `title` (+ `accent`, `eyebrow`, `description`).
 */
export function ProductPageHeader({
  eyebrow,
  title,
  titleLead,
  titleAccent,
  accent,
  contextLabel,
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
  eyebrow?: string;
  /** Legacy single-string title. */
  title?: string;
  /** Canon: portion blanche du titre. */
  titleLead?: string;
  /** Canon: portion accent vert du titre (bicolore). */
  titleAccent?: string;
  /** Legacy trailing accent segment appended to `title`. */
  accent?: ReactNode;
  /** Canon: kicker court uppercase (« — INVESTMENT FLOW »). */
  contextLabel?: string;
  description?: ReactNode;
  /** Block above eyebrow (back link, centered icon in align=center flows). */
  lead?: ReactNode;
  /** Optional media slot to the left of the title stack (avatar, icon). */
  media?: ReactNode;
  /** Commandes primaires — alignées à DROITE de la toolbar. */
  actions?: ReactNode;
  /** Segmentation / list-state — alignés à GAUCHE de la toolbar. */
  filters?: ReactNode;
  /** Slot rendu AU-DESSUS du trait accent (ex. stepper du funnel invest). */
  beforeRule?: ReactNode;
  children?: ReactNode;
  className?: string;
  align?: "start" | "center";
}) {
  const centered = align === "center";

  return (
    <header
      className={cn(
        "product-page-header",
        centered && "product-page-header--center",
        className,
      )}
    >
      <div
        className={cn(
          "product-page-header__row",
          centered && "product-page-header__row--center",
        )}
      >
        <div
          className={cn(
            "product-page-header__main",
            centered && "product-page-header__main--center",
          )}
        >
          {media ? <div className="shrink-0">{media}</div> : null}
          <div
            className={cn(
              "product-page-header__title-stack",
              centered && "product-page-header__title-stack--center",
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
