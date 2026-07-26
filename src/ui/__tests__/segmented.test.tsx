import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { Segmented, nextSegmentedIndex } from "@/ui/segmented";

/**
 * Contrat du contrôle segmenté (mission P3-2).
 *
 * L'environnement Vitest du repo est `node` : pas de jsdom, pas de RTL. Le
 * rendu se vérifie donc par `renderToStaticMarkup`, et la navigation clavier
 * par la fonction pure `nextSegmentedIndex` — qui est précisément pourquoi elle
 * est extraite du composant plutôt qu'enfouie dans le gestionnaire d'évènement.
 */

const ROOT = process.cwd();
const SRC = readFileSync(join(ROOT, "src/ui/segmented.tsx"), "utf8");

/**
 * Les assertions de doctrine portent sur le CODE ÉMIS, pas sur la prose. Un
 * commentaire qui explique pourquoi `layoutId` de framer-motion est écarté doit
 * pouvoir le nommer — sinon le gardien interdit d'expliquer la décision qu'il
 * protège.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

const CODE = stripComments(SRC);

const ITEMS = [
  { value: "day", label: "24h" },
  { value: "month", label: "30 days" },
  { value: "all", label: "All time" },
] as const;

describe("rôles et attributs ARIA", () => {
  it("radiogroup (défaut) : role=radiogroup + radio + aria-checked", () => {
    const html = renderToStaticMarkup(
      <Segmented items={ITEMS} value="day" onChange={vi.fn()} ariaLabel="Range" />,
    );
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('role="radio"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('aria-checked="false"');
    // aria-selected appartient au tablist : le mélanger est une faute ARIA.
    expect(html).not.toContain("aria-selected");
  });

  it("tablist : role=tablist + tab + aria-selected, et pas aria-checked", () => {
    const html = renderToStaticMarkup(
      <Segmented
        items={ITEMS}
        value="month"
        onChange={vi.fn()}
        ariaLabel="View"
        variant="tablist"
      />,
    );
    expect(html).toContain('role="tablist"');
    expect(html).toContain('role="tab"');
    expect(html).toContain('aria-selected="true"');
    expect(html).not.toContain("aria-checked");
  });

  it("le groupe est nommé et orienté", () => {
    const html = renderToStaticMarkup(
      <Segmented items={ITEMS} value="day" onChange={vi.fn()} ariaLabel="Range" />,
    );
    expect(html).toContain('aria-label="Range"');
    expect(html).toContain('aria-orientation="horizontal"');
  });

  it("roving tabindex : UN seul arrêt de tabulation, sur l'élément actif", () => {
    const html = renderToStaticMarkup(
      <Segmented items={ITEMS} value="month" onChange={vi.fn()} ariaLabel="Range" />,
    );
    expect(html.match(/tabindex="0"/g) ?? []).toHaveLength(1);
    expect(html.match(/tabindex="-1"/g) ?? []).toHaveLength(2);
  });

  it("les boutons sont type=button (jamais un submit qui poste un formulaire)", () => {
    const html = renderToStaticMarkup(
      <Segmented items={ITEMS} value="day" onChange={vi.fn()} ariaLabel="Range" />,
    );
    expect(html.match(/type="button"/g) ?? []).toHaveLength(3);
  });
});

describe("navigation clavier", () => {
  it("Flèches droite/bas avancent, et bouclent", () => {
    expect(nextSegmentedIndex("ArrowRight", 0, 3)).toBe(1);
    expect(nextSegmentedIndex("ArrowDown", 1, 3)).toBe(2);
    expect(nextSegmentedIndex("ArrowRight", 2, 3)).toBe(0);
  });

  it("Flèches gauche/haut reculent, et bouclent", () => {
    expect(nextSegmentedIndex("ArrowLeft", 2, 3)).toBe(1);
    expect(nextSegmentedIndex("ArrowUp", 1, 3)).toBe(0);
    expect(nextSegmentedIndex("ArrowLeft", 0, 3)).toBe(2);
  });

  it("Home et End vont aux extrémités", () => {
    expect(nextSegmentedIndex("Home", 2, 3)).toBe(0);
    expect(nextSegmentedIndex("End", 0, 3)).toBe(2);
  });

  it("toute autre touche rend null — sinon on volerait Tab et ⌘K", () => {
    for (const key of ["Tab", "Enter", " ", "a", "Escape", "k"]) {
      expect(nextSegmentedIndex(key, 0, 3)).toBeNull();
    }
  });

  it("aucune valeur sélectionnée ou groupe vide : on ne navigue pas", () => {
    expect(nextSegmentedIndex("ArrowRight", -1, 3)).toBeNull();
    expect(nextSegmentedIndex("ArrowRight", 0, 0)).toBeNull();
    expect(nextSegmentedIndex("ArrowRight", 5, 3)).toBeNull();
  });

  it("un seul segment : les flèches restent sur place, sans planter", () => {
    expect(nextSegmentedIndex("ArrowRight", 0, 1)).toBe(0);
    expect(nextSegmentedIndex("ArrowLeft", 0, 1)).toBe(0);
  });

  it("le focus suit la sélection (moitié non négociable du roving tabindex)", () => {
    expect(CODE).toMatch(/btnRefs\.current\[next\]\?\.focus\(\)/);
  });
});

describe("la pastille — mesurée, pas devinée", () => {
  it("n'est PAS rendue au premier rendu (aucun flash à x=0)", () => {
    const html = renderToStaticMarkup(
      <Segmented items={ITEMS} value="day" onChange={vi.fn()} ariaLabel="Range" />,
    );
    // Avant mesure, `pill` vaut null : rien de positionné n'est émis.
    expect(html).not.toContain("translateX");
    expect(html).not.toContain("will-change");
  });

  it("glisse en transform, mesuré au layout + ResizeObserver", () => {
    expect(CODE).toMatch(/useLayoutEffect/);
    expect(CODE).toMatch(/ResizeObserver/);
    expect(CODE).toMatch(/translateX\(\$\{pill\.x\}px\)/);
    // Conteneur ET boutons : c'est la largeur des boutons qui bouge quand la
    // police variable finit de charger.
    expect(CODE).toMatch(/ro\.observe\(track\)/);
    expect(CODE).toMatch(/for \(const btn of btnRefs\.current\) if \(btn\) ro\.observe\(btn\)/);
    expect(CODE).toMatch(/ro\.disconnect\(\)/);
  });

  it("will-change est posé ICI, et seulement ici (élément unique, animé en continu)", () => {
    expect(CODE).toMatch(/willChange: "transform"/);
    expect((CODE.match(/willChange/g) ?? []).length).toBe(1);
  });

  it("aucune dépendance d'animation : pas de framer-motion, pas de layoutId", () => {
    expect(CODE).not.toMatch(/from\s+["'][^"']*framer-motion/);
    expect(CODE).not.toMatch(/layoutId/);
  });

  it("ne boucle pas sur le ResizeObserver (l'état est conservé si rien ne bouge)", () => {
    expect(CODE).toMatch(/prev\.x === x && prev\.w === w \? prev/);
  });
});

describe("doctrine visuelle", () => {
  it("aucune couleur en dur — que des rôles, et aucun modificateur dark:", () => {
    expect(CODE).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(CODE).not.toMatch(/\bdark:/);
    expect(CODE).not.toMatch(/\btext-white\b|\btext-black\b|\btext-zinc-/);
  });

  it("la sélection reste sobre : aucun remplissage d'accent", () => {
    const html = renderToStaticMarkup(
      <Segmented items={ITEMS} value="day" onChange={vi.fn()} ariaLabel="Range" />,
    );
    expect(html).not.toContain("bg-accent");
  });

  it("les durées viennent des tokens, jamais d'un littéral", () => {
    expect(CODE).not.toMatch(/duration-\[?\d/);
    expect(CODE).toMatch(/duration-\(--dur-base\)/);
    expect(CODE).toMatch(/ease-standard/);
  });

  it("n'importe pas le segmented-control catalyst (ses tokens sont fantômes)", () => {
    expect(CODE).not.toMatch(/catalyst\/segmented-control/);
    expect(CODE).not.toMatch(/ct-seg-/);
  });
});
