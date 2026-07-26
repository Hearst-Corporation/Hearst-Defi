import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Pureté du greenfield.
 *
 * POURQUOI CE GARDIEN EXISTE
 * `admin-canon-*` n'est défini que dans `src/app/admin/admin-canon.css`, importé
 * par le SEUL layout admin. Une vue produit qui porte ces classes ne « style pas
 * moins » qu'ailleurs : elle ne style RIEN — y compris le `min-width: 0` dont
 * dépend la non-explosion des cellules denses. C'est un échec silencieux : ni
 * `typecheck`, ni `lint`, ni `build` ne voient une classe CSS absente.
 *
 * Le vocabulaire `ct-*` / `--ct-*`, lui, est un pont de compatibilité à ratchet
 * DÉCROISSANT. Il n'est pas mort, mais les primitives NEUVES ne doivent pas s'y
 * accrocher : chaque nouvelle dépendance repousse d'autant sa suppression.
 *
 * PÉRIMÈTRE : les modules greenfield listés ci-dessous, pas le repo entier —
 * un gardien qui échoue sur du legacy connu se fait désarmer dans la semaine.
 */

const ROOT = decodeURIComponent(new URL("../../../..", import.meta.url).pathname);

/** Modules reconstruits en greenfield : ils n'ont aucune dette à porter. */
const GREENFIELD = [
  "src/ui/page-shell.tsx",
  "src/ui/details-list.tsx",
  "src/ui/status-value.tsx",
  "src/views/investor/profile-view.tsx",
];

/** Neutralise les commentaires en PRÉSERVANT le nombre de lignes. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, "");
}

/** `ct-foo` ou `--ct-foo` ou `admin-canon-foo`, hors préfixe de mot. */
const LEGACY_VOCAB = /(?<![\w-])(--ct-[a-z]|ct-[a-z]|admin-canon-)/;

describe("greenfield: aucune dépendance au vocabulaire legacy", () => {
  it("les primitives reconstruites ne portent ni `ct-*` ni `admin-canon-*`", () => {
    const offenders: string[] = [];
    for (const rel of GREENFIELD) {
      const code = stripComments(readFileSync(join(ROOT, rel), "utf8"));
      code.split("\n").forEach((line, i) => {
        if (LEGACY_VOCAB.test(line)) offenders.push(`${rel}:${i + 1} → ${line.trim()}`);
      });
    }
    expect(
      offenders,
      "`admin-canon-*` n'est chargé que sous /admin : sur une route produit ces " +
        "classes ne posent RIEN, et l'échec est silencieux. `ct-*` est un pont à " +
        "ratchet décroissant — une primitive neuve qui s'y accroche repousse sa " +
        "suppression. Utiliser les recettes `hc-*` (app.css) ou des utilitaires.",
    ).toEqual([]);
  });

  /**
   * Le gardien d'EMPLOI de l'accent ne lit que le TSX. Or `.hc-link` — le lien
   * canonique du produit — portait `text-accent` DANS le CSS, donc illisible en
   * thème clair sans qu'aucun test ne le voie. Les recettes `hc-*` sont couvertes
   * ici, à la source.
   */
  it("aucune recette `hc-*` n'applique `text-accent` nu (illisible en clair)", () => {
    const css = readFileSync(join(ROOT, "src/styles/app.css"), "utf8");
    const offenders: string[] = [];
    css.split("\n").forEach((line, i) => {
      if (!/@apply/.test(line)) return;
      if (/(?<![\w-])text-accent(?![\w-])/.test(line)) {
        offenders.push(`src/styles/app.css:${i + 1} → ${line.trim()}`);
      }
    });
    expect(
      offenders,
      "`text-accent` est le vert de REMPLISSAGE : ~1,2:1 sur surface claire. " +
        "Pour du texte ou un lien, c'est `text-accent-ink` (≈6,9:1, deux thèmes).",
    ).toEqual([]);
  });

  it("les recettes `hc-prose` et `hc-caption` existent (sinon la purge est un no-op)", () => {
    const css = readFileSync(join(ROOT, "src/styles/app.css"), "utf8");
    // Une classe absente ne lève AUCUNE erreur — remplacer `ct-metric-caption`
    // par un `hc-caption` inexistant produirait du texte non stylé, silencieusement.
    expect(css, "hc-prose remplace ct-prose-md").toMatch(/\.hc-prose\s*\{/);
    expect(css, "hc-caption remplace ct-metric-caption").toMatch(/\.hc-caption\s*\{/);
  });

  it("les recettes greenfield sont dans une couche RÉELLEMENT compilée", () => {
    /**
     * Tailwind v4 ignore SILENCIEUSEMENT un second `@layer components` placé
     * après `@layer utilities` — c'est ce qui avait fait disparaître toute la
     * coque (`.hc-shell`, `.hc-rail`) sans qu'aucune gate ne bronche. On vérifie
     * donc qu'il n'existe qu'UNE ouverture de chaque couche.
     */
    const css = readFileSync(join(ROOT, "src/styles/app.css"), "utf8");
    const components = css.match(/@layer\s+components\s*\{/g) ?? [];
    expect(
      components.length,
      "Tailwind v4 ne compile QUE le premier `@layer components` rencontré avant " +
        "`@layer utilities` — un second bloc est ignoré sans le moindre message.",
    ).toBeLessThanOrEqual(1);
  });
});
