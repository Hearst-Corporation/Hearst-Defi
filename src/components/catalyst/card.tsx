/**
 * Catalyst Card — LA surface de module de Hearst Connect.
 *
 * POURQUOI CE FICHIER A ÉTÉ RECONSTRUIT
 * Il s'appuyait sur `.ct-card`, `.ct-glass-panel`, `.ct-overlay-surface0`,
 * `.ct-z-base` et `.ct-transition-opacity-slow` — cinq classes qui ne vivent
 * QUE dans `cockpit.css`, archive Storybook jamais chargée par l'application.
 * Résultat : chez ses 11 importeurs (proof-center, features/investor-ui,
 * error-shell…), `<Card>` rendait un `<div>` **sans fond, sans bordure et sans
 * padding**. Le composant existait, son style non.
 *
 * Il repose désormais sur `.hc-surface` (src/styles/typography.css), écrite sur
 * les tokens duals `--hc-*` : une seule règle, deux thèmes, micro-gradient et
 * élévation compris.
 *
 * L'API publique est INCHANGÉE (`material`, `density`, `hoverOverlay`,
 * `contentClassName`) — aucun importeur n'a une ligne à modifier.
 */

import { cn } from "@/lib/cn";

export function Card({
  className,
  contentClassName,
  hoverOverlay = true,
  density = "default",
  material = "glass",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  hoverOverlay?: boolean;
  /** Layout/espacement de la coque interne — le flex/grid posé sur la carte
   *  elle-même n'atteint pas les enfants. */
  contentClassName?: string;
  density?: "default" | "compact";
  /** `glass` (défaut) = surface de module avec sheen et élévation ;
   *  `flat` = même fond, sans sheen ni ombre, pour les listes et tables denses
   *  (évite l'effet cage-dans-cage). */
  material?: "glass" | "flat";
}) {
  return (
    <div
      className={cn(
        "hc-surface overflow-hidden",
        material === "flat" && "hc-surface--flat",
        // `hoverOverlay` signifie « cette carte réagit au survol » : on active
        // l'affordance interactive plutôt qu'un calque d'opacité maison.
        hoverOverlay && "hc-surface--interactive",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          density === "compact" ? "p-4" : "hc-surface__body",
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mb-4 flex items-start justify-between gap-3", className)}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  // `.h3` est désormais défini au runtime (typography.css §8) — il ne l'était
  // pas, et ces titres rendaient avec le style navigateur par défaut.
  return <h3 className={cn("h3", className)} {...props} />;
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("ct-metric-caption", className)} {...props} />;
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(className)} {...props} />;
}
