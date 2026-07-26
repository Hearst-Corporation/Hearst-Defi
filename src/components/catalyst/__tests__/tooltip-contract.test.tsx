import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Tooltip } from "@/components/catalyst/tooltip";

/**
 * Contrat du Tooltip canon (mission P1-TOOLTIP).
 *
 * Ce composant était le SEUL importeur de la librairie de motion tierce du repo.
 * La réécriture en CSS pur repose sur trois invariants que ce fichier verrouille :
 *   1. aucune librairie de motion, aucun `"use client"` (les 4 importeurs
 *      redeviennent rendables en RSC) ;
 *   2. le tooltip est monté EN PERMANENCE — c'est ce qui rend l'animation de
 *      sortie gratuite (ce que payait `AnimatePresence`) et ce qui expose enfin
 *      le contenu à l'AT ;
 *   3. les 4 côtés produisent des ancrages DISTINCTS.
 *
 * Le repo teste les composants via `renderToStaticMarkup` (vitest env = node,
 * pas de @testing-library/react installé) — cf. wired-chip.test.tsx.
 */

const SOURCE_REL = "src/components/catalyst/tooltip.tsx";
const SOURCE = readFileSync(join(process.cwd(), SOURCE_REL), "utf8");

/**
 * Le fichier DOCUMENTE ce qu'il a supprimé (`--ct-space-1_5`…) : un grep brut
 * mordrait ses propres commentaires. Les assertions de source portent donc sur
 * le CODE seul. (Piège connu du repo : « grep matche les commentaires ».)
 */
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(
  /^[ \t]*\/\/.*$/gm,
  "",
);

/**
 * Le nom du paquet est ASSEMBLÉ, jamais écrit en clair : la non-régression du
 * repo est un `grep -rn "<paquet>" src/` qui doit rester à ZÉRO hit, y compris
 * dans ce test. L'assertion garde tout son sens — c'est bien la chaîne complète
 * qui est cherchée dans la source.
 */
const MOTION_PKG = ["framer", "motion"].join("-");

const SIDES = ["top", "bottom", "left", "right"] as const;

describe("Tooltip — zéro dépendance de motion", () => {
  it("n'importe aucune librairie de motion tierce", () => {
    expect(SOURCE).not.toContain(MOTION_PKG);
    expect(CODE).not.toContain("AnimatePresence");
    expect(CODE).not.toMatch(/from\s+["']motion["']/);
    expect(CODE).not.toMatch(/^import\b(?!\s+type\b).*\bfrom\s+["'](?!@\/)/m);
  });

  it('n\'utilise plus aucun hook React, donc plus de "use client"', () => {
    expect(CODE).not.toMatch(/^\s*["']use client["']/m);
    expect(CODE).not.toMatch(/\buseState\b|\buseEffect\b|\buseId\b|\buseRef\b/);
  });

  it("le stripper de commentaires fait vraiment son travail", () => {
    // Sans ce garde-fou, une regex cassée rendrait CODE == SOURCE et TOUTES les
    // assertions `not.toContain` ci-dessus passeraient pour une mauvaise raison.
    expect(SOURCE).toContain("POURQUOI");
    expect(CODE).not.toContain("POURQUOI");
    expect(CODE).toContain("export function Tooltip");
  });

  it("n'utilise aucun token de durée/easing --ct-* (ils ne résolvent pas)", () => {
    // `--ct-space-1_5`, référencé par l'ancienne version, n'existe ni dans
    // theme.css ni dans legacy-bridge.css : plus AUCUN `--ct-*` dans ce fichier.
    expect(CODE).not.toContain("--ct-");
  });
});

describe("Tooltip — monté en permanence (pas de gate d'état)", () => {
  it("rend le contenu dans le DOM sans aucune interaction", () => {
    const html = renderToStaticMarkup(
      <Tooltip content="Live production data">
        <span>KPI</span>
      </Tooltip>,
    );
    expect(html).toContain("Live production data");
    expect(html).toContain("KPI");
  });

  it("rend un contenu ReactNode riche, pas seulement une string", () => {
    const html = renderToStaticMarkup(
      <Tooltip
        content={
          <div>
            <div>Titre</div>
            <div>Description</div>
          </div>
        }
      >
        <span>KPI</span>
      </Tooltip>,
    );
    expect(html).toContain("Titre");
    expect(html).toContain("Description");
  });

  it("est neutre au pointeur et caché par défaut (opacity-0)", () => {
    const html = renderToStaticMarkup(
      <Tooltip content="tip">
        <span>x</span>
      </Tooltip>,
    );
    expect(html).toContain("pointer-events-none");
    expect(html).toContain("opacity-0");
  });

  it("pilote sa visibilité par le groupe NOMMÉ group/tt (hover + focus-within)", () => {
    const html = renderToStaticMarkup(
      <Tooltip content="tip">
        <span>x</span>
      </Tooltip>,
    );
    expect(html).toContain("group/tt");
    expect(html).toContain("group-hover/tt:opacity-100");
    expect(html).toContain("group-focus-within/tt:opacity-100");
  });

  it("respecte prefers-reduced-motion", () => {
    const html = renderToStaticMarkup(
      <Tooltip content="tip">
        <span>x</span>
      </Tooltip>,
    );
    expect(html).toContain("motion-reduce:transition-none");
    expect(html).toContain("duration-150");
  });
});

describe("Tooltip — accessibilité", () => {
  it("expose role=\"tooltip\"", () => {
    const html = renderToStaticMarkup(
      <Tooltip content="tip">
        <span>x</span>
      </Tooltip>,
    );
    expect(html).toContain('role="tooltip"');
  });

  it("rend le déclencheur focusable (parité clavier du survol)", () => {
    const html = renderToStaticMarkup(
      <Tooltip content="tip">
        <span>x</span>
      </Tooltip>,
    );
    expect(html).toContain('tabindex="0"');
  });

  it("garde la flèche décorative hors de l'arbre d'accessibilité", () => {
    const html = renderToStaticMarkup(
      <Tooltip content="tip">
        <span>x</span>
      </Tooltip>,
    );
    expect(html).toContain('aria-hidden="true"');
  });
});

describe("Tooltip — les 4 côtés produisent des ancrages distincts", () => {
  const markup = Object.fromEntries(
    SIDES.map((side) => [
      side,
      renderToStaticMarkup(
        <Tooltip content="tip" side={side}>
          <span>x</span>
        </Tooltip>,
      ),
    ]),
  ) as Record<(typeof SIDES)[number], string>;

  it.each([
    ["top", "bottom-full"],
    ["bottom", "top-full"],
    ["left", "right-full"],
    ["right", "left-full"],
  ] as const)("side=%s ancre sur %s", (side, anchor) => {
    expect(markup[side]).toContain(anchor);
    expect(markup[side]).toContain(`data-side="${side}"`);
  });

  it("les 4 rendus sont deux à deux différents", () => {
    const seen = new Set(SIDES.map((side) => markup[side]));
    expect(seen.size).toBe(SIDES.length);
  });

  it("le décalage d'entrée n'écrase jamais la translation de centrage", () => {
    // top/bottom sont centrés en X → le décalage se fait en Y.
    expect(markup.top).toContain("-translate-x-1/2");
    expect(markup.top).toContain("translate-y-1");
    expect(markup.bottom).toContain("-translate-x-1/2");
    expect(markup.bottom).toContain("-translate-y-1");
    // left/right sont centrés en Y → le décalage se fait en X.
    expect(markup.left).toContain("-translate-y-1/2");
    expect(markup.left).toContain("translate-x-1");
    expect(markup.right).toContain("-translate-y-1/2");
    expect(markup.right).toContain("-translate-x-1");
  });

  it("le défaut reste `top` (API inchangée pour les 4 appelants)", () => {
    const implicit = renderToStaticMarkup(
      <Tooltip content="tip">
        <span>x</span>
      </Tooltip>,
    );
    expect(implicit).toContain('data-side="top"');
  });
});

describe("Tooltip — surfaces issues de tokens qui résolvent", () => {
  it("n'écrit aucune couleur en dur", () => {
    expect(CODE).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(CODE).not.toMatch(/\brgba?\(/);
  });

  it("consomme les tokens greenfield de theme.css", () => {
    const html = renderToStaticMarkup(
      <Tooltip content="tip">
        <span>x</span>
      </Tooltip>,
    );
    for (const cls of [
      "bg-surface-overlay",
      "border-border",
      "text-foreground",
      "shadow-md",
    ]) {
      expect(html).toContain(cls);
    }
  });
});
