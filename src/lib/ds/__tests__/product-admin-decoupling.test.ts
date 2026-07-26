import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Découplage produit ↔ canon admin.
 *
 * POURQUOI CE GARDIEN EXISTE
 * `views/_shared/layout.tsx` délègue au canon admin — et c'est CORRECT pour
 * l'admin : `admin-canon-start-pattern.test.ts` verrouille cette délégation.
 * Le problème n'est pas le bridge, c'est QUI l'importe.
 *
 * Six vues investisseur + `not-found.tsx` l'importaient, et héritaient donc de
 * `admin-canon-page-frame`, définie UNIQUEMENT dans `src/app/admin/admin-canon.css`
 * — feuille importée par le seul layout admin. Hors /admin, cette classe ne pose
 * RIEN, et la perte n'est pas cosmétique : elle porte `min-width: 0` sur le cadre
 * ET sur chacun de ses enfants directs. Sans elle, les enfants gardent
 * `min-width: auto` et une cellule dense fait DÉBORDER la grille au lieu de
 * tronquer. C'est un échec parfaitement silencieux : ni typecheck, ni lint, ni
 * build ne voient une classe CSS absente.
 *
 * Le pendant greenfield est `views/_shared/product-layout.tsx`, même API.
 */

const ROOT = process.cwd();

/** Arbres dont les modules servent des routes NON-admin. */
const PRODUCT_TREES = [
  "src/views/investor",
  "src/views/dashboard",
  "src/views/auth",
  "src/app/(product)",
];

/** Fichiers produit isolés, hors des arbres ci-dessus. */
const PRODUCT_FILES = ["src/app/not-found.tsx"];

/** Le bridge admin lui-même, et le shell dont il tire ses classes. */
const ADMIN_ONLY_MODULES = [
  "@/views/_shared/layout",
  "@/components/admin/admin-page-shell",
  "@/components/admin/admin-page-header",
];

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
      if (entry === "__tests__" || entry === "node_modules") continue;
      walk(abs, out);
      continue;
    }
    if (!/\.tsx?$/.test(entry)) continue;
    if (/\.(test|stories)\.tsx?$/.test(entry)) continue;
    out.push(abs);
  }
  return out;
}

/** Neutralise les commentaires en PRÉSERVANT le nombre de lignes. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, "");
}

function productFiles(): string[] {
  const out = PRODUCT_TREES.flatMap((t) => walk(join(ROOT, t)));
  out.push(...PRODUCT_FILES.map((f) => join(ROOT, f)));
  return out;
}

describe("produit: aucune dépendance au canon admin", () => {
  it("le périmètre est non vide (sinon le gardien est vert pour rien)", () => {
    // Un gardien qui ne balaie aucun fichier passe toujours — et ment.
    expect(productFiles().length).toBeGreaterThan(10);
  });

  it("aucune vue produit n'importe le bridge ni le shell admin", () => {
    const offenders: string[] = [];
    for (const file of productFiles()) {
      const rel = relative(ROOT, file);
      const code = stripComments(readFileSync(file, "utf8"));
      code.split("\n").forEach((line, i) => {
        for (const mod of ADMIN_ONLY_MODULES) {
          // `"…/layout"` exactement : ne doit PAS mordre sur `product-layout`.
          if (new RegExp(`["']${mod.replace(/[/()]/g, "\\$&")}["']`).test(line)) {
            offenders.push(`${rel}:${i + 1} → ${mod}`);
          }
        }
      });
    }
    expect(
      offenders,
      "Ces modules posent `admin-canon-*`, définies uniquement dans " +
        "src/app/admin/admin-canon.css (importée par le seul layout admin). Hors " +
        "/admin elles ne posent RIEN — dont le `min-width: 0` qui empêche une " +
        "cellule dense de faire déborder la grille. Utiliser " +
        "`@/views/_shared/product-layout` (API identique) ou `@/ui/page-shell`.",
    ).toEqual([]);
  });

  it("le bridge produit expose bien toute l'API du bridge admin", () => {
    /**
     * Sans cette assertion, une primitive manquante côté produit pousserait
     * doucement une vue à réimporter le bridge admin « juste pour celle-là ».
     */
    const admin = readFileSync(join(ROOT, "src/views/_shared/layout.tsx"), "utf8");
    const product = readFileSync(
      join(ROOT, "src/views/_shared/product-layout.tsx"),
      "utf8",
    );
    const exportsOf = (src: string) =>
      new Set(
        [...src.matchAll(/export\s+(?:function|type|const)\s+(\w+)/g)].map(
          (m) => m[1],
        ),
      );
    const missing = [...exportsOf(admin)].filter((n) => !exportsOf(product).has(n));
    expect(
      missing,
      "Le bridge produit doit couvrir toute l'API du bridge admin : une " +
        "primitive absente est une invitation à réimporter le canon admin.",
    ).toEqual([]);
  });

  it("le bridge produit ne porte lui-même aucun vocabulaire admin", () => {
    const src = stripComments(
      readFileSync(join(ROOT, "src/views/_shared/product-layout.tsx"), "utf8"),
    );
    expect(src).not.toMatch(/admin-canon-/);
    expect(src, "`--ct-*` est un pont décroissant : pas dans du code neuf").not.toMatch(
      /--ct-/,
    );
  });
});
