import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * DetailsList — la primitive greenfield pour les listes de propriétés
 * (clé → valeur), qui étaient jusqu'ici écrites à la main dans chaque vue.
 *
 * POURQUOI UN `<dl>` ET PAS UNE PILE DE `<div>`
 * Une succession de `<div><p>Label</p><p>Value</p></div>` ne dit rien à une
 * technologie d'assistance : le lien entre l'étiquette et sa valeur n'existe
 * que visuellement. `<dl>/<dt>/<dd>` porte cette relation dans le document, et
 * les lecteurs d'écran l'annoncent comme telle.
 *
 * POURQUOI PAS DE `tabular-nums` PAR DÉFAUT
 * La version précédente l'appliquait à toutes les valeurs — y compris à des
 * adresses e-mail et à des badges. Les chiffres tabulaires servent à aligner
 * des colonnes de nombres ; sur du texte ils élargissent les glyphes sans
 * raison. Ici c'est un choix explicite, par ligne (`numeric`).
 */

export interface DetailsItem {
  /** Étiquette lisible. */
  label: ReactNode;
  /** Valeur. Une absence se dit avec `<StatusValue>`, jamais avec "" ni 0. */
  value: ReactNode;
  /** Précision sous l'étiquette (unité, cadence, portée). */
  hint?: ReactNode;
  /**
   * Aligne la valeur en chiffres tabulaires. À réserver aux nombres, montants,
   * pourcentages et dates numériques — jamais à du texte libre.
   */
  numeric?: boolean;
  /** Clé de liste. À défaut, l'index est utilisé. */
  id?: string;
}

export function DetailsList({
  items,
  className,
}: {
  items: readonly DetailsItem[];
  className?: string;
}) {
  return (
    <dl className={cn("m-0 divide-y divide-border-subtle", className)}>
      {items.map((item, i) => (
        <div
          key={item.id ?? i}
          className="flex flex-wrap items-start justify-between gap-3 px-5 py-3.5"
        >
          <div className="min-w-0">
            <dt className="text-sm text-muted">{item.label}</dt>
            {item.hint ? (
              <dd className="hc-caption m-0 mt-0.5">{item.hint}</dd>
            ) : null}
          </div>
          <dd
            className={cn(
              "m-0 text-sm font-medium text-foreground",
              item.numeric && "tabular-nums",
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
