import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Aucun token `--ct-*` FANTÔME.
 *
 * POURQUOI CE GARDIEN EXISTE
 * L'audit DS de /proof-center a trouvé trois tokens utilisés mais définis
 * NULLE PART. C'est le pire mode de panne du CSS : rien n'échoue. Tailwind
 * compile bien `border-radius: var(--ct-radius-full)` ; c'est le NAVIGATEUR
 * qui, ne trouvant pas la variable, retombe sur la valeur initiale. Ni
 * typecheck, ni lint, ni build, ni test ne voient quoi que ce soit.
 *
 * Ce que ça coûtait réellement, mesuré sur le DOM servi :
 *  · `rounded-(--ct-radius-full)` → `border-radius: 0` : les pastilles rondes
 *    du stepper d'événements étaient CARRÉES (12 occurrences dans le HTML) ;
 *  · `ring-[var(--ct-surface-page)]` → anneau transparent : la pastille de la
 *    timeline touchait la ligne verticale au lieu d'être détourée ;
 *  · `opacity-[var(--ct-opacity-60)]` → opacité ignorée, donc 1 : une valeur
 *    PÉRIMÉE s'affichait exactement comme une valeur fraîche. Celui-là n'est
 *    pas cosmétique — c'est un défaut d'honnêteté de la donnée.
 *
 * CE QU'IL VÉRIFIE
 * Tout `--ct-*` LU dans le TSX doit être DÉFINI dans une feuille chargée au
 * runtime. Les feuilles d'archive (`cockpit.css`, `globals.css`) ne comptent
 * pas : elles ne sont jamais chargées par l'application, et c'est précisément
 * ce qui a permis à ces tokens de paraître valides.
 */

const ROOT = process.cwd();

/** Feuilles RÉELLEMENT chargées au runtime (cf. app.css). */
const RUNTIME_SHEETS = [
  "src/styles/palette.css",
  "src/styles/theme.css",
  "src/styles/legacy-bridge.css",
  "src/styles/typography.css",
  "src/styles/app.css",
];

/**
 * Un token peut légitimement être posé en `style={{ "--ct-x": … }}` sur un
 * élément : il est alors défini à l'exécution, pas dans une feuille.
 */
function locallyDefined(source: string, token: string): boolean {
  return new RegExp(`["']${token}["']\\s*:`).test(source);
}

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      if (entry === "node_modules" || entry === "__tests__") continue;
      walk(abs, out);
      continue;
    }
    if (!/\.tsx?$/.test(entry)) continue;
    if (/\.(test|stories)\.tsx?$/.test(entry)) continue;
    out.push(abs);
  }
  return out;
}

/** Neutralise les commentaires SANS changer le nombre de lignes. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, "");
}

function definedTokens(): Set<string> {
  let css = "";
  for (const sheet of RUNTIME_SHEETS) {
    try {
      css += readFileSync(join(ROOT, sheet), "utf8");
    } catch {
      /* feuille absente = elle ne définit rien ; le test le dira autrement */
    }
  }
  return new Set([...css.matchAll(/(--ct-[a-z0-9-]+)\s*:/g)].map((m) => m[1] as string));
}

describe("tokens: aucun `--ct-*` fantôme", () => {
  it("les feuilles runtime définissent bien des tokens (garde-fou du garde-fou)", () => {
    // Si le chemin d'une feuille change, `definedTokens()` renverrait un
    // ensemble vide et TOUT deviendrait fantôme — un échec de 300 lignes qui
    // se ferait désarmer plutôt que lire. On échoue ici, avec la bonne cause.
    expect(
      definedTokens().size,
      "aucun --ct-* trouvé dans les feuilles runtime : un chemin de " +
        `RUNTIME_SHEETS est probablement obsolète (${RUNTIME_SHEETS.join(", ")}).`,
    ).toBeGreaterThan(20);
  });

  it("aucun NOUVEAU token fantôme (ratchet descendant)", () => {
    const defined = definedTokens();
    const found = new Map<string, string[]>();

    for (const file of walk(join(ROOT, "src"))) {
      const code = stripComments(readFileSync(file, "utf8"));
      const rel = relative(ROOT, file);
      code.split("\n").forEach((line, i) => {
        for (const m of line.matchAll(/--ct-[a-z0-9-]+/g)) {
          const token = m[0];
          // `continue` et NON `return` : dans un callback de forEach, `return`
          // abandonne la LIGNE entière — un token valide en début de ligne
          // masquait alors un fantôme situé après lui.
          if (defined.has(token)) continue;
          if (locallyDefined(code, token)) continue; // posé en style inline
          const at = found.get(token) ?? [];
          at.push(`${rel}:${i + 1}`);
          found.set(token, at);
        }
      });
    }

    /**
     * RATCHET, et non tolérance zéro d'emblée : l'audit a trouvé 77 tokens
     * fantômes hérités, presque tous dans du code qui n'atteint aucune route
     * rendue. Exiger zéro tout de suite aurait imposé une refonte de 17 fichiers
     * du canon Catalyst dans un commit d'audit — et une gate impossible à
     * satisfaire se fait désarmer, pas respecter.
     * La baseline ne peut que DESCENDRE (même contrat que quality-gate.mjs).
     */
    const baseline: { tokens: string[] } = JSON.parse(
      readFileSync(join(ROOT, "src/lib/ds/__tests__/phantom-token-baseline.json"), "utf8"),
    );
    const tolerated = new Set(baseline.tokens);
    const fresh = [...found.entries()]
      .filter(([t]) => !tolerated.has(t))
      .map(([t, at]) => `${t}  ← ${at[0]}`);

    expect(
      fresh,
      "NOUVEAU token `--ct-*` lu mais défini nulle part dans une feuille chargée " +
        "au runtime. Le navigateur retombe en silence sur la valeur initiale : " +
        "`border-radius` → 0 (une pastille ronde devient carrée), une couleur → " +
        "transparent, `opacity` → 1 (une donnée périmée se lit comme fraîche). " +
        "Aucune gate ne peut le voir autrement. Préférer l'utilitaire canon " +
        "(`rounded-full`, `ring-surface-page`, `opacity-60`) à un shim de plus " +
        "dans un pont qui doit décroître.",
    ).toEqual([]);

    // Le ratchet mord dans l'autre sens : une baseline qui n'a pas suivi une
    // amélioration ment sur la dette réelle.
    const stale = baseline.tokens.filter((t) => !found.has(t));
    expect(
      stale,
      "Ces tokens ne sont plus fantômes — retirer de phantom-token-baseline.json " +
        "(la dette doit refléter le réel, sinon elle autorise une régression).",
    ).toEqual([]);
  });
});
