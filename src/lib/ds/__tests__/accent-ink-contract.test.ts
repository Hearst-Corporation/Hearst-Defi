import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Contrat d'EMPLOI de l'accent.
 *
 * POURQUOI CE GARDIEN EXISTE
 * Le contrat de contraste (`theme-contrast-contract`) vérifie que les TOKENS
 * atteignent AA. Il ne peut rien dire de leur EMPLOI — et c'est précisément là
 * que le thème clair s'est cassé : `text-accent` rend le vert de REMPLISSAGE
 * (#a7fb90). Sur un fond clair ou sur `bg-accent-muted`, il plafonne à ~1,2:1,
 * soit un texte quasi invisible. `text-accent-ink` est la MÊME teinte ramenée
 * au seuil AA dans les deux thèmes (≈ 6,9:1).
 *
 * RÈGLE : `accent` est une couleur de FOND (`bg-accent`, `fill-accent`) ou une
 * couleur de texte SUR un remplissage accent (`text-accent-foreground`).
 * Pour du texte, une icône, un lien ou un anneau de focus posés sur une surface
 * normale, c'est `accent-ink`.
 */

const ROOT = decodeURIComponent(new URL("../../../..", import.meta.url).pathname);
const SRC = join(ROOT, "src");

/**
 * `text-accent` isolé.
 *
 * Le lookBEHIND est indispensable : `\b` matche AUSSI après un tiret, donc
 * `\btext-accent` mord à l'intérieur de `ct-text-accent` et transforme un
 * gardien en générateur de faux positifs (38 lors du premier jet). L'utilitaire
 * legacy `.ct-text-accent` est légitime : il lit `--ct-accent`, retargeté sur
 * `var(--hc-accent-ink)` — donc déjà AA dans les deux thèmes.
 * Le lookAHEAD exclut `-ink`, `-foreground`, `-hover`.
 */
const NAKED_TEXT_ACCENT = /(?<![\w-])text-accent(?![\w-])/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      walk(abs, out);
      continue;
    }
    if (entry.endsWith(".tsx") || entry.endsWith(".ts")) {
      if (entry.endsWith(".test.ts") || entry.endsWith(".test.tsx")) continue;
      if (entry.endsWith(".stories.tsx")) continue;
      out.push(abs);
    }
  }
  return out;
}

/**
 * Neutralise les commentaires SANS changer le nombre de lignes : un `replace`
 * naïf supprime les sauts de ligne d'un bloc `/* … *\/` et décale alors tous
 * les numéros rapportés — un gardien qui pointe la mauvaise ligne coûte plus
 * de temps qu'il n'en fait gagner.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, "");
}

describe("accent: remplissage vs encre", () => {
  it("aucun `text-accent` nu — utiliser `text-accent-ink`", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      // `relative` et non `slice(ROOT.length + 1)` : ROOT se termine déjà par un
      // séparateur, le +1 mangeait un caractère et rapportait "rc/…".
      const rel = relative(ROOT, file);
      const code = stripComments(readFileSync(file, "utf8"));
      code.split("\n").forEach((line, i) => {
        if (NAKED_TEXT_ACCENT.test(line)) offenders.push(`${rel}:${i + 1}`);
      });
    }
    expect(
      offenders,
      "`text-accent` rend le vert de REMPLISSAGE (#a7fb90) : sur fond clair il " +
        "plafonne à ~1,2:1, donc illisible. Pour du texte, une icône ou un lien, " +
        "utiliser `text-accent-ink` (même teinte, ≈6,9:1 dans les deux thèmes). " +
        "`text-accent-foreground` reste correct SUR un remplissage accent.",
    ).toEqual([]);
  });

  it("le token accent-ink existe et est thémé dans les deux sens", () => {
    const palette = readFileSync(join(ROOT, "src/styles/palette.css"), "utf8");
    const dark = /\[data-theme="dark"\][\s\S]*?--hc-accent-ink:/.test(
      `:root,${palette}`,
    );
    const light = /\[data-theme="light"\][\s\S]*?--hc-accent-ink:/.test(palette);
    expect(palette).toContain("--hc-accent-ink:");
    expect(light, "le thème clair doit redéfinir --hc-accent-ink").toBe(true);
    expect(dark || palette.includes("--hc-accent-ink:")).toBe(true);
  });
});
