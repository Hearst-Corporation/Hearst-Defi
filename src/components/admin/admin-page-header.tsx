import { Suspense, type ReactNode } from "react";

import { AdminSubNav } from "@/components/nav/admin-sub-nav";
import { cn } from "@/lib/cn";

/**
 * Uniform admin page title — PORTFOLIO canon skeleton. Le HEADER COMPLET =
 *   H1 bicolore (`titleLead` blanc + `titleAccent` vert)
 *   → kicker « — CONTEXTE » (`contextLabel`)
 *   → section-nav (sous-niveau du titre, ENTRE le kicker et le trait)
 *   → trait accent (`.page-canon-rule`) qui CLÔT le bloc header.
 * Puis, hors header :
 *   → toolbar canon : `filters` à GAUCHE · `actions` (création) à DROITE
 *   → contenu (`children`).
 *
 * Le titre est TOUJOURS le premier repère ; la section-nav lui est subordonnée.
 *
 * API canon: `titleLead` + `titleAccent` + `contextLabel` (+ `filters`/`actions`).
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
  actions,
  filters,
  subNav = true,
  children,
  className,
}: {
  /** Legacy single-string title (pages non migrées). */
  title?: string;
  /** Canon: portion blanche du titre. */
  titleLead?: string;
  /** Canon: portion accent vert du titre (bicolore). */
  titleAccent?: string;
  /** Legacy trailing accent segment appended to `title`. */
  accent?: ReactNode;
  /** Canon: kicker court uppercase (« — OPERATOR CONSOLE »). */
  contextLabel?: string;
  eyebrow?: string;
  description?: ReactNode;
  lead?: ReactNode;
  /** Commandes primaires de création — alignées à DROITE de la toolbar. */
  actions?: ReactNode;
  /** Segmentation / list-state (tabs, statuts) — alignés à GAUCHE de la toolbar. */
  filters?: ReactNode;
  /** Render the section-nav between the kicker and the rule. Default true. */
  subNav?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("admin-page-header", className)}>
      <div className="admin-page-header__row">
        <div className="admin-page-header__main">
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
            <div className="body-md ct-prose-md ct-text-muted">{description}</div>
          ) : null}
        </div>
      </div>
      {subNav ? (
        <Suspense fallback={null}>
          <AdminSubNav />
        </Suspense>
      ) : null}
      <div className="page-canon-rule" aria-hidden="true" />
      {filters || actions ? (
        <div className="page-canon-toolbar">
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
