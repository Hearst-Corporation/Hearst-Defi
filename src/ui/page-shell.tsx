import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Coque de page PRODUIT — greenfield, sans aucune dépendance au canon admin.
 *
 * CE QU'ELLE REMPLACE, ET POURQUOI
 * Les vues investisseur passaient par `views/_shared/layout`, qui délègue à
 * `AdminPageFrame` / `AdminSectionCard`. Or les classes que ceux-ci émettent
 * (`admin-canon-page-frame`, `admin-canon-first-block`) ne sont définies que
 * dans `src/app/admin/admin-canon.css`, importé UNIQUEMENT par le layout admin.
 * Sur une route produit, elles sont donc INERTES — dont `min-width: 0`, la
 * protection anti-débordement flex.
 *
 * Trois défauts hérités disparaissent ici :
 *   1. la page entière était enfermée dans une grande carte, puis contenait des
 *      cartes : bordures et rayons empilés (cage dans cage). La page produit
 *      n'est plus une carte — seules ses sections en sont ;
 *   2. le breakpoint `min-[1700px]:px-20`, vestige d'une mise en page admin ;
 *   3. `min-width: 0` est désormais réellement appliqué (`.hc-page`).
 */

export function PageShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  // `.hc-page` porte la largeur max, les gouttières et min-width:0 (app.css).
  return <div className={cn("hc-page", className)}>{children}</div>;
}

export function PageTitle({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: string;
  description?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className="hc-eyebrow">{eyebrow}</p> : null}
        <h1 className="h1">{title}</h1>
        {description ? (
          <p className="hc-prose mt-1">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

/**
 * Section de page : un titre de niveau 2 et son contenu.
 *
 * Le `<section>` interne des vues précédentes n'avait ni titre propre ni
 * `aria-label` — il n'apportait donc rien à la structure du document. Ici, une
 * seule `<section>` porte le titre, et la surface est un simple conteneur.
 */
export function PageSection({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="h2">{title}</h2>
          {description ? (
            <p className="hc-caption mt-0.5">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/**
 * Surface de contenu — la recette canon `.hc-surface`.
 * `flush` retire le rembourrage pour les listes et tables soudées bord à bord.
 */
export function PagePanel({
  children,
  flush = false,
  className,
}: {
  children: ReactNode;
  flush?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("hc-surface overflow-hidden", className)}>
      <div className={flush ? "" : "hc-surface__body"}>{children}</div>
    </div>
  );
}
