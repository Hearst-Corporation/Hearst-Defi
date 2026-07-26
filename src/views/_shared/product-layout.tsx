// Bridge PRODUIT — le pendant greenfield de `_shared/layout.tsx`.
//
// POURQUOI CE FICHIER EXISTE
// `_shared/layout.tsx` délègue au canon admin, et c'est correct POUR L'ADMIN :
// le gardien `admin-canon-start-pattern.test.ts` verrouille cette délégation.
// Mais six vues investisseur l'importaient aussi, et héritaient donc de
// `admin-canon-page-frame` — une classe définie UNIQUEMENT dans
// `src/app/admin/admin-canon.css`, importé par le seul layout admin.
//
// Sur une route produit cette classe ne pose RIEN. Ce n'est pas un détail
// esthétique : elle porte `min-width: 0` sur le cadre ET sur chacun de ses
// enfants directs. Sans elle, les enfants gardent `min-width: auto` et une
// cellule dense (table large, adresse longue, valeur non sécable) fait DÉBORDER
// la grille au lieu de tronquer — exactement le bug de cadre visuel déjà
// diagnostiqué côté admin. Elle traînait aussi `min-[1700px]:px-20`, une rupture
// de rythme pensée pour les tables admin, pas pour une lecture investisseur.
//
// L'API est STRICTEMENT celle de `_shared/layout.tsx` : les six vues changent
// une ligne d'import, pas une ligne de markup. Le rendu, lui, change — c'est
// l'objet de la demande.

import { cn } from "@/lib/cn";
import type { Provenance } from "@/lib/provenance";
import { ProvenanceBadge } from "@/ui/badge";

/**
 * Cadre de page produit.
 *
 * `min-w-0` est explicite ici, et sur les enfants directs via `[&>*]:min-w-0` :
 * c'est la protection anti-débordement que `admin-canon-page-frame` apportait
 * et qui était perdue hors /admin. Elle est portée par un utilitaire, donc
 * compilée partout — plus de dépendance à une feuille conditionnelle.
 */
export function PageLayout({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "hc-page flex min-w-0 max-w-full flex-col gap-y-5 [&>*]:min-w-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Header de page produit. Le `h1` vit ici et nulle part ailleurs : la règle
 * « un seul H1, jamais écrit à la main dans une vue » vaut aussi côté produit.
 */
export function PageHeader({
  eyebrow,
  title,
  meta,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  meta?: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex min-w-0 flex-col gap-2">
      {eyebrow || meta ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {eyebrow ? <p className="hc-eyebrow">{eyebrow}</p> : null}
          {meta ? <p className="hc-caption">{meta}</p> : null}
        </div>
      ) : null}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <h1 className="min-w-0 text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {description ? <p className="hc-prose">{description}</p> : null}
    </header>
  );
}

export function Section({
  index,
  title,
  description,
  children,
}: {
  index?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="hc-section-title flex items-center gap-2">
          {index ? (
            <span className="font-mono text-xs text-subtle">{index}</span>
          ) : null}
          {title}
        </h2>
        {description ? <p className="hc-section-subtitle">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * Carte produit — recette canon `.hc-surface`, `overflow-hidden` pour que le
 * contenu épouse le rayon, `min-w-0` pour que les tables denses scrollent
 * DEDANS plutôt que de pousser la page.
 */
export function Panel({
  title,
  description,
  children,
  footer,
}: {
  title?: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="hc-surface flex min-w-0 flex-col overflow-hidden">
      {title || description ? (
        <div className="flex min-w-0 flex-col gap-1 border-b border-border-subtle px-5 py-4">
          {title ? <h3 className="hc-section-title">{title}</h3> : null}
          {description ? (
            <div className="hc-caption">{description}</div>
          ) : null}
        </div>
      ) : null}
      <div className="flex min-w-0 flex-col">{children}</div>
      {footer ? (
        <div className="border-t border-border-subtle px-5 py-4 text-xs text-muted">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export function RowList({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col divide-y divide-border-subtle">
      {children}
    </div>
  );
}

export type RowTone = "ok" | "watch" | "alert" | "idle";

// Pastille de tonalité — gris + accent UNIQUEMENT, jamais de rouge : une Row en
// alerte s'exprime par un texte fort et un préfixe lu par le lecteur d'écran,
// pas par une couleur d'erreur (doctrine « un seul vert, zéro rouge »).
const ROW_TONE_DOT: Record<RowTone, string> = {
  ok: "bg-accent",
  watch: "bg-foreground",
  alert: "bg-foreground",
  idle: "bg-subtle",
};

export function Row({
  label,
  value,
  hint,
  provenance,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  /** Badge de provenance rendu à côté de la valeur. */
  provenance?: Provenance;
  /** Nuance sémantique SANS rouge. Absent = ligne neutre. */
  tone?: RowTone;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-3 px-5 py-3.5">
      <div className="min-w-0">
        <p className="text-sm text-muted">{label}</p>
        {hint ? <p className="mt-0.5 text-xs text-subtle">{hint}</p> : null}
      </div>
      <div className="flex min-w-0 items-center gap-2">
        {tone ? (
          <span
            aria-hidden
            className={cn(
              "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
              ROW_TONE_DOT[tone],
            )}
          />
        ) : null}
        <p
          className={cn(
            "min-w-0 text-sm font-medium tabular-nums text-foreground",
            tone === "alert" && "font-semibold",
          )}
        >
          {tone === "alert" ? (
            <>
              <span aria-hidden className="mr-1.5">
                !
              </span>
              <span className="sr-only">Alert: </span>
            </>
          ) : null}
          {value}
        </p>
        {provenance ? <ProvenanceBadge source={provenance} /> : null}
      </div>
    </div>
  );
}

// `PageActions` vit dans `./page-actions` : les deux bridges en avaient une copie
// IDENTIQUE au caractère près (aucune classe, aucun token). Une copie sans
// divergence est une dette, pas un découplage.
export { PageActions } from "./page-actions";

export function Disclaimer({ children }: { children: React.ReactNode }) {
  return <p className="text-xs leading-relaxed text-subtle">{children}</p>;
}

/**
 * Rythme d'un corps de carte NON-tabulaire — le pendant produit de
 * `FORM_SURFACE` (`admin-canon-form-surface`), qui portait `display:flex`,
 * `gap: 1.25rem`, `min-width: 0` et `padding: 1.5rem` depuis une feuille chargée
 * uniquement sous /admin. Sur une route produit, cette constante ne posait donc
 * ni gouttière ni padding : le contenu était collé aux bords de la carte.
 *
 * Utilitaires Tailwind, donc compilés partout — plus de feuille conditionnelle.
 */
export const PRODUCT_FORM_SURFACE = "flex min-w-0 flex-col gap-5 p-6";
