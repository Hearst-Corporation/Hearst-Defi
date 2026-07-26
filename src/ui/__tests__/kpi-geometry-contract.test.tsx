import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Kpi, KpiGrid } from "@/ui/kpi";

/**
 * Contrat de STABILITÉ GÉOMÉTRIQUE.
 *
 * RÈGLE PRODUIT (Adrien, 2026-07-26)
 * « Chaque placeholder a l'espace, chaque data a l'espace, et il n'y a AUCUN
 * changement de forme ni de volume quand une donnée arrive, se charge, ou
 * vaut zéro. »
 *
 * POURQUOI CE GARDIEN EXISTE
 * Le squelette d'un composant DÉRIVE toujours de ce qu'il remplace, parce que
 * rien ne les relie. Trois sauts ont été mesurés sur le DOM rendu avant ce
 * test : le squelette ne réservait pas la ligne de badge, la valeur n'avait
 * aucune largeur réservée (`0 USDC` vs `1,250,000 USDC`), et `unavailable`
 * rendait un `<p>` hors du conteneur de valeur.
 *
 * CE QU'IL VÉRIFIE, ET COMMENT
 * L'ÉGALITÉ entre états, jamais une chaîne golden. Un golden fige un rendu ;
 * ici on veut figer une RELATION — les quatre états doivent partager la même
 * ossature. Un golden aurait été mis à jour sans réfléchir au premier échec.
 *
 * CE QU'IL NE PEUT PAS VÉRIFIER (dit franchement)
 * Les tests tournent en `environment: "node"` : aucun layout n'est calculé, on
 * ne peut donc pas mesurer des pixels. On vérifie que les CLASSES qui portent
 * la géométrie sont présentes et identiques — c'est une condition nécessaire,
 * pas une preuve visuelle. La preuve finale reste l'œil humain.
 */

const LABEL = "Principal deployed";
const HINT = "On-chain vault assets";

/** Les quatre états qu'une tuile traverse réellement en production. */
const STATES = {
  loading: <Kpi label={LABEL} value="—" state="loading" hint={HINT} />,
  zero: <Kpi label={LABEL} value="0 USDC" provenance="live" hint={HINT} />,
  value: (
    <Kpi label={LABEL} value="1,250,000 USDC" provenance="live" hint={HINT} />
  ),
  unavailable: (
    <Kpi
      label={LABEL}
      value="—"
      state="unavailable"
      unavailableReason="the vault contract could not be read"
      hint={HINT}
    />
  ),
} as const;

const render = (el: React.ReactElement) => renderToStaticMarkup(el);

/** Extrait les `class="…"` dans l'ordre du document. */
function classAttrs(html: string): string[] {
  return [...html.matchAll(/class="([^"]*)"/g)].map((m) => m[1] ?? "");
}

/** Vrai si UNE des classes du document contient tous les fragments donnés. */
function hasBox(html: string, ...fragments: string[]): boolean {
  return classAttrs(html).some((c) => fragments.every((f) => c.includes(f)));
}

describe("Kpi — la géométrie ne dépend jamais de la donnée", () => {
  it("les 4 états partagent la même racine", () => {
    const roots = Object.entries(STATES).map(([k, el]) => {
      const first = classAttrs(render(el))[0] ?? "";
      // `aria-busy` et l'animation d'entrée ne sont pas de la géométrie.
      return [k, first.replace(/\banimate-\S+/g, "").trim()] as const;
    });
    const [, reference] = roots[0] as readonly [string, string];
    for (const [name, cls] of roots) {
      expect(
        cls,
        `l'état "${name}" a une racine différente : la grille se décalerait ` +
          `au passage d'un état à l'autre.`,
      ).toBe(reference);
    }
  });

  it("les 4 états réservent la boîte de valeur (hauteur ET largeur)", () => {
    for (const [name, el] of Object.entries(STATES)) {
      const html = render(el);
      expect(
        hasBox(html, "min-h-8"),
        `"${name}" ne réserve pas la HAUTEUR de la valeur — une raison sur ` +
          `deux lignes ou une valeur absente ferait varier la hauteur de la tuile.`,
      ).toBe(true);
      expect(
        hasBox(html, "min-w-[12ch]"),
        `"${name}" ne réserve pas la LARGEUR de la valeur — la colonne se ` +
          `redimensionnerait selon le nombre de chiffres reçus.`,
      ).toBe(true);
    }
  });

  it("les 4 états réservent la ligne de label + provenance", () => {
    for (const [name, el] of Object.entries(STATES)) {
      expect(
        hasBox(render(el), "flex", "items-center", "gap-2"),
        `"${name}" ne rend pas la ligne label+badge : au chargement, le badge ` +
          `de provenance apparaîtrait et pousserait la ligne.`,
      ).toBe(true);
    }
  });

  it("le squelette réserve la place du badge, même sans provenance connue", () => {
    // Au chargement on ne SAIT PAS encore s'il y aura un badge. Réserver est
    // le seul choix qui ne bouge dans aucun des deux cas.
    expect(hasBox(render(STATES.loading), "w-14")).toBe(true);
  });

  it("une raison longue ne pousse jamais le hint (bornée à une ligne)", () => {
    const html = render(
      <Kpi
        label={LABEL}
        value="—"
        state="unavailable"
        unavailableReason={
          "the vault contract could not be read because the RPC endpoint " +
          "returned a persistent error across all configured providers"
        }
        hint={HINT}
      />,
    );
    expect(
      hasBox(html, "line-clamp-1"),
      "une raison longue passerait sur plusieurs lignes et décalerait la rangée.",
    ).toBe(true);
    // L'information n'est pas perdue pour autant.
    expect(html).toContain("title=");
  });

  it("zéro est affiché comme une VALEUR, pas comme une absence", () => {
    // Le pendant de la doctrine « jamais de zéro fabriqué » : un zéro MESURÉ
    // se lit comme un chiffre, avec sa provenance, pas comme un trou.
    const html = render(STATES.zero);
    expect(html).toContain("0 USDC");
    expect(html).toContain("hc-metric-value");
    expect(html).not.toContain("Unavailable");
  });

  it("une rangée entière reste alignée quels que soient les états mélangés", () => {
    // Le cas réel : 4 KPI dont un chargé, un à zéro, un indisponible.
    const html = render(
      <KpiGrid>
        <Kpi label="A" value="0 USDC" provenance="live" />
        <Kpi label="B" value="1,250,000 USDC" provenance="live" />
        <Kpi label="C" value="—" state="loading" />
        <Kpi label="D" value="—" state="unavailable" unavailableReason="rpc down" />
      </KpiGrid>,
    );
    const boxes = classAttrs(html).filter((c) => c.includes("min-h-8"));
    expect(
      boxes.length,
      "chacune des 4 tuiles doit réserver sa boîte de valeur (hauteur).",
    ).toBe(4);
    // La réservation de LARGEUR vit sur l'ENFANT de la boîte (le span de valeur
    // ou le <p> de raison), pas sur la boîte flex elle-même : c'est le contenu
    // qui doit avoir un plancher, sinon flex le laisse se contracter.
    const reserves = classAttrs(html).filter((c) => c.includes("min-w-[12ch]"));
    expect(
      reserves.length,
      "chacune des 4 tuiles doit réserver la largeur de sa valeur.",
    ).toBe(4);
  });
});
