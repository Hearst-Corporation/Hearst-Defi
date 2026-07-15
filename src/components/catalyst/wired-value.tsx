/**
 * WiredValue — affiche une valeur issue d'un `Wired<T>` (voir
 * `src/lib/chain/dynavault.ts`) en respectant le non-négociable du repo :
 * ZÉRO donnée inventée. Une lecture qui n'a pas abouti rend un em-dash neutre
 * accompagné de son MOTIF — jamais `0`, jamais `"N/A"`, jamais une valeur de repli.
 *
 * Convention couleur : BLEU = la valeur vient du nouveau contrat / des routes v2.
 *
 * Le type des props est volontairement STRUCTUREL (`WiredLike<T>`) plutôt qu'un
 * import de `@/lib/chain/dynavault` : ce module est `server-only` et ce composant
 * doit rester montable depuis n'importe quelle surface. Un `Wired<T>` de
 * dynavault (union `status: "wired" | "unavailable"`) y est assignable tel quel.
 */
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { WiredChip, type WiredSource } from "./wired-chip";

/**
 * Forme structurelle acceptée. Compatible avec `Wired<T>` de
 * `src/lib/chain/dynavault.ts` sans créer de dépendance de module.
 */
export type WiredLike<T> =
  | { status: "wired"; value: T; source?: WiredSource }
  | { status: "unavailable"; reason?: string };

export interface WiredValueProps<T> {
  wired: WiredLike<T>;
  /** Formatte la valeur lue. Appelé UNIQUEMENT quand `status === "wired"`. */
  render: (value: T) => ReactNode;
  /** Nom de la métrique — exposé aux lecteurs d'écran pour situer la valeur. */
  label?: string;
  className?: string;
}

export function WiredValue<T>({
  wired,
  render,
  label,
  className,
}: WiredValueProps<T>) {
  const wrapper = cn(
    "inline-flex items-center gap-[var(--ct-space-2)]",
    className,
  );

  if (wired.status === "wired") {
    return (
      <span className={wrapper}>
        {label !== undefined ? <span className="sr-only">{label}</span> : null}
        <span className="text-info">{render(wired.value)}</span>
        <WiredChip state="wired" source={wired.source ?? "v2"} />
      </span>
    );
  }

  // Indisponible : aucune valeur n'est fabriquée. L'em-dash est un placeholder
  // muet ; c'est le chip qui porte le motif (panne RPC ≠ contrat non déployé).
  return (
    <span className={wrapper}>
      {label !== undefined ? <span className="sr-only">{label}</span> : null}
      <span aria-hidden className="text-[var(--ct-text-faint)]">
        —
      </span>
      <WiredChip state="unavailable" reason={wired.reason} />
    </span>
  );
}
