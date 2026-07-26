import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Gardien de NON-RETOUR du vocabulaire `dark`.
 *
 * POURQUOI IL EXISTE
 * Le repo portait 39 `className="dark …"` sur 37 fichiers et 10 modificateurs
 * `dark:` dans `catalyst/table.tsx`. Les premiers étaient INERTES (aucune règle
 * chargée au runtime ne cible `.dark` — le `@custom-variant` vit dans
 * `globals.css`, une archive Storybook). Les seconds, eux, compilaient avec le
 * défaut Tailwind v4, c'est-à-dire `@media (prefers-color-scheme: dark)` : un
 * utilisateur en OS clair recevait donc déjà une demi-branche de thème clair,
 * accidentelle et incohérente — dont un highlight de focus manquant.
 *
 * CE QU'IL PROTÈGE
 * Le thème est porté par les TOKENS (`[data-theme]` + `--hc-*`), jamais par un
 * modificateur dupliqué ni par une classe figée. Une variante `dark:` double la
 * règle, sort du contrat de contraste, et rend le basculement impossible à
 * garantir. Une classe `dark` en dur fige une surface dans un thème.
 *
 * L'ALLOWLIST EST VIDE ET DOIT LE RESTER : le seul endroit où un thème
 * s'exprime est `src/styles/palette.css`.
 */

const ROOT = decodeURIComponent(new URL("../../../..", import.meta.url).pathname);
const SRC = join(ROOT, "src");

/** Vide par construction — voir l'en-tête. */
const ALLOWLIST = new Set<string>([]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      walk(abs, out);
      continue;
    }
    if (!entry.endsWith(".tsx")) continue;
    if (entry.endsWith(".stories.tsx") || entry.endsWith(".test.tsx")) continue;
    out.push(abs);
  }
  return out;
}

/** Retire commentaires de bloc et de ligne : on ne juge que du code émis. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const FILES = walk(SRC);

describe("no dark: modifier, no hardcoded .dark class", () => {
  it("scanne un périmètre non vide", () => {
    expect(FILES.length).toBeGreaterThan(200);
  });

  it("aucun modificateur `dark:` dans un composant", () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      const rel = file.slice(ROOT.length + 1);
      if (ALLOWLIST.has(rel)) continue;
      const code = stripComments(readFileSync(file, "utf8"));
      code.split("\n").forEach((line, i) => {
        // `dark:` SUIVI IMMÉDIATEMENT d'un caractère de classe — un modificateur
        // Tailwind ne porte jamais d'espace. Sans ce lookahead, la regex mordait
        // sur une clé d'objet TypeScript (`{ light: "", dark: ".dark" }`), qui
        // n'est pas un modificateur.
        if (/\bdark:(?=[a-z[])/.test(line)) offenders.push(`${rel}:${i + 1}`);
      });
    }
    expect(
      offenders,
      "Le thème est porté par les tokens ([data-theme] + --hc-*), jamais par un " +
        "modificateur : une variante `dark:` duplique la règle et sort du contrat " +
        "de contraste. Corrige la couleur au token, pas au modificateur.",
    ).toEqual([]);
  });

  it("aucune classe `dark` figée dans un className", () => {
    const offenders: string[] = [];
    // Token de classe isolé dans un littéral className — pas `dark-mode`, pas
    // un mot contenant « dark », pas une prop nommée darkFoo.
    const RE = /className=\{?["'`][^"'`]*(?:^|["'`\s])dark(?:\s|["'`])/;
    for (const file of FILES) {
      const rel = file.slice(ROOT.length + 1);
      if (ALLOWLIST.has(rel)) continue;
      const code = stripComments(readFileSync(file, "utf8"));
      code.split("\n").forEach((line, i) => {
        if (RE.test(line)) offenders.push(`${rel}:${i + 1}`);
      });
    }
    expect(
      offenders,
      "Une classe `dark` en dur fige la surface dans un thème. Le basculement " +
        "vit dans src/styles/palette.css ([data-theme]), pas dans le JSX.",
    ).toEqual([]);
  });

  it("l'allowlist reste vide", () => {
    expect(ALLOWLIST.size).toBe(0);
  });
});
