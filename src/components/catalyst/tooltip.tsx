// Catalyst Tooltip — canon, CSS pur. Zéro état React, zéro librairie de motion.
//
// POURQUOI. Ce fichier était le SEUL importeur de la librairie de motion tierce
// dans tout `src/` — son nom n'est volontairement écrit NULLE PART ici, pour que
// le grep de non-régression du repo reste à zéro hit, commentaires compris.
// (39,1 kB gz embarqués sur 33 routes via ses 4 importeurs : admin/dashboard/
// kpi-strip, catalyst/provenance-badge, catalyst/wired-chip, catalyst/metric).
// L'élément est désormais monté en PERMANENCE (il est déjà `pointer-events-none`,
// donc invisible au pointeur) et sa visibilité est pilotée par le groupe nommé
// `group/tt` : l'animation de SORTIE devient gratuite — c'est exactement ce que
// `AnimatePresence` achetait. Plus aucun hook ⇒ plus de `"use client"` : la
// chaîne des 4 importeurs redevient rendable en RSC.
//
// GROUPE NOMMÉ. `group/tt` et non `group` : ces tooltips vivent dans des cellules
// KPI qui portent déjà un `group` parent (cf. `catalyst/metric` variant premium,
// `card-premium group`). Un groupe anonyme se ferait capturer par le mauvais
// ancêtre.
//
// TOKENS. Greenfield uniquement (`src/styles/theme.css`). L'ancienne version
// référençait `--ct-space-1_5`, qui n'est défini NULLE PART (ni theme.css, ni
// legacy-bridge.css) : le `py` ne s'appliquait donc pas. `py-1.5` (6 px) rend
// enfin le padding vertical voulu. Deltas visuels assumés et volontaires :
// surface `--ct-surface-inset` (#0c0c0e) → `bg-surface-overlay` (#1f1f23) et
// bordure 5 % → `border-border` (10 %) — un tooltip est un OVERLAY, pas un
// enfoncement ; c'est aussi ce que fait déjà `src/ui/tooltip.tsx`. Le reste est
// pixel-identique (`shadow-md` == l'ancien `--ct-shadow-soft`, `text-foreground`
// == `--ct-text-strong`, `rounded-md`, `px-3` == `--ct-space-3`, `mb-2` ==
// `--ct-space-2`), positions et flèche inchangées.
//
// MOTION. Tailwind v4 compile `scale-*` / `translate-*` vers les propriétés
// INDIVIDUELLES `scale:` et `translate:`, pas vers `transform:` (vérifié contre
// la sortie compilée de tailwindcss@4.3.0). Une transition sur `transform`
// n'animerait donc QUE l'opacité — la liste nomme `translate` et `scale`.
// Aucun token `--ct-dur-*` / `--ct-ease` : ils ne résolvent pas au runtime.
//
// A11Y — arbitrage explicite. En CSS pur, aucun attribut ne peut basculer au
// survol : `aria-hidden` serait figé à `true`, donc le contenu resterait
// invisible à l'AT (l'état actuel : le tooltip n'existait même pas dans le DOM).
// Et `aria-describedby` exigerait un id unique, donc `useId`, donc `"use client"`
// — ce que cette réécriture supprime précisément. Choix retenu : le tooltip est
// PRÉSENT dans l'arbre d'accessibilité avec `role="tooltip"`, lu dans l'ordre du
// document juste après son déclencheur, et le wrapper est focusable (`tabIndex`)
// pour que `group-focus-within/tt` donne la parité clavier au survol.

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type TooltipSide = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  className?: string;
  side?: TooltipSide;
}

/** Ancrage — géométrie identique à la version animée précédente. */
const PLACEMENT: Record<TooltipSide, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

/**
 * Décalage d'entrée/sortie (4 px, comme le `y: ±4` de framer). L'AXE est choisi
 * pour ne jamais entrer en collision avec la translation de centrage du
 * placement : top/bottom sont centrés en X → on décale en Y ; left/right sont
 * centrés en Y → on décale en X. (La version framer décalait en Y sur les quatre
 * côtés, ce qui écrasait le `-translate-y-1/2` de centrage de left/right.)
 */
const OFFSET: Record<TooltipSide, string> = {
  top: "translate-y-1 group-hover/tt:translate-y-0 group-focus-within/tt:translate-y-0",
  bottom:
    "-translate-y-1 group-hover/tt:translate-y-0 group-focus-within/tt:translate-y-0",
  left: "translate-x-1 group-hover/tt:translate-x-0 group-focus-within/tt:translate-x-0",
  right:
    "-translate-x-1 group-hover/tt:translate-x-0 group-focus-within/tt:translate-x-0",
};

/** Flèche — offsets et bordures repris tels quels de la version précédente. */
const ARROW: Record<TooltipSide, string> = {
  top: "bottom-[-5px] left-1/2 -translate-x-1/2 border-t-0 border-l-0",
  bottom:
    "top-[-5px] left-1/2 -translate-x-1/2 border-b-0 border-r-0 border-t border-l",
  left: "right-[-5px] top-1/2 -translate-y-1/2 border-t border-l-0 border-b-0 border-r",
  right:
    "left-[-5px] top-1/2 -translate-y-1/2 border-b border-r-0 border-t-0 border-l",
};

export function Tooltip({
  content,
  children,
  className,
  side = "top",
}: TooltipProps) {
  return (
    // `tabIndex` : les déclencheurs réels (badges, labels, cellules KPI) ne sont
    // pas focusables — sans lui, `group-focus-within/tt` ne se déclencherait
    // jamais et le tooltip resterait réservé à la souris.
    <div className="group/tt relative inline-block" tabIndex={0}>
      {children}
      <div
        role="tooltip"
        data-tooltip=""
        data-side={side}
        className={cn(
          "pointer-events-none absolute z-50 whitespace-nowrap",
          "rounded-md border border-border bg-surface-overlay px-3 py-1.5 body-xs text-foreground shadow-md",
          "opacity-0 scale-95",
          "group-hover/tt:opacity-100 group-hover/tt:scale-100",
          "group-focus-within/tt:opacity-100 group-focus-within/tt:scale-100",
          "transition-[opacity,translate,scale] duration-150 ease-out motion-reduce:transition-none",
          PLACEMENT[side],
          OFFSET[side],
          className,
        )}
      >
        {content}
        <div
          aria-hidden="true"
          className={cn(
            "absolute h-2 w-2 rotate-45 border-b border-r border-border bg-surface-overlay",
            ARROW[side],
          )}
        />
      </div>
    </div>
  );
}
