import Link from "next/link";

import { Button } from "@/ui/button";

/**
 * Paire d'actions de tête de page — partagée par les DEUX bridges.
 *
 * POURQUOI ELLE VIT ICI ET PAS DANS CHAQUE BRIDGE
 * Le découplage produit ↔ admin a dupliqué `_shared/layout.tsx` en
 * `_shared/product-layout.tsx`, et c'était le bon geste : les deux rendent des
 * vocabulaires visuels différents (canon admin vs greenfield `hc-*`), donc
 * `PageLayout`, `Panel`, `Row`… divergent LÉGITIMEMENT.
 *
 * `PageActions` est la seule exception mesurée : les deux copies étaient
 * identiques au caractère près (aucune classe, aucun token — elle ne fait que
 * composer `Link` + `Button`, qui portent déjà leur propre style). Une copie
 * sans divergence n'est pas un découplage, c'est une dette : le jour où l'ordre
 * des boutons change, il change dans un seul des deux fichiers.
 *
 * RÈGLE DE PLACEMENT : ce module n'accueille QUE des primitives dont les deux
 * bridges ont strictement le même rendu. Dès qu'une divergence est voulue, la
 * primitive redescend dans chaque bridge — ne pas paramétrer par un booléen
 * `isAdmin`, ce serait recréer le couplage qu'on vient de défaire.
 */
export function PageActions({
  primary,
  secondary,
}: {
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <>
      {secondary ? (
        <Link href={secondary.href}>
          <Button variant="secondary">{secondary.label}</Button>
        </Link>
      ) : null}
      <Link href={primary.href}>
        <Button>{primary.label}</Button>
      </Link>
    </>
  );
}
