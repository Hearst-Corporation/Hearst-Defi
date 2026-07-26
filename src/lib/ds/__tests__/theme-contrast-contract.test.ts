import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * CONTRAT DE CONTRASTE DU THÈME DUAL.
 *
 * POURQUOI IL EXISTE
 * Interdire `dark:` protégeait UNE apparence. Depuis le passage au thème dual,
 * il faut protéger DEUX apparences correctes — et le thème sombre précédent
 * échouait déjà WCAG AA sans que rien ne le dise : `--color-subtle` plafonnait
 * à 3,90:1 et `--color-faint` à 2,29:1, ce dernier servant de couleur de TEXTE
 * sur 156 sites. Ce test calcule vraiment les ratios ; il ne fait pas semblant.
 *
 * CE QU'IL VÉRIFIE
 *  1. theme.css n'a aucun hex dans son bloc @theme inline (les valeurs vivent
 *     dans palette.css) ;
 *  2. les deux thèmes définissent EXACTEMENT le même jeu de clés `--hc-*` ;
 *  3. les 3 rangs de texte atteignent AA (4,5:1) sur les 6 surfaces × 2 thèmes,
 *     `faint` ≥ 3:1 (non-textuel), `accent-ink` ≥ 4,5:1 ;
 *  4. aucune ombre à base de noir en dur dans le bloc clair.
 */

const ROOT = decodeURIComponent(new URL("../../../..", import.meta.url).pathname);
const PALETTE = readFileSync(join(ROOT, "src/styles/palette.css"), "utf8");
const THEME = readFileSync(join(ROOT, "src/styles/theme.css"), "utf8");

/* ── Résolution des valeurs ─────────────────────────────────────────────── */

function blockAfter(source: string, selector: string): string {
  const idx = source.indexOf(selector);
  if (idx === -1) throw new Error(`bloc introuvable : ${selector}`);
  const open = source.indexOf("{", idx);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  throw new Error(`bloc non fermé : ${selector}`);
}

function declarations(block: string): Map<string, string> {
  const out = new Map<string, string>();
  // Déclarations `--x: valeur;` de premier niveau (les @keyframes internes
  // n'en contiennent pas de --hc-*, on peut rester simple).
  for (const m of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out.set(m[1]!.trim(), m[2]!.trim());
  }
  return out;
}

const RAMPS = declarations(blockAfter(PALETTE, ":root {"));
const DARK = declarations(blockAfter(PALETTE, '[data-theme="dark"] {'));
const LIGHT = declarations(blockAfter(PALETTE, '[data-theme="light"] {'));

/** Résout une valeur en couleur RGB, en suivant var() et color-mix(). */
function resolve(
  value: string,
  scope: Map<string, string>,
  depth = 0,
): [number, number, number] | null {
  if (depth > 8) return null;
  const v = value.trim();

  const hex = /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(v);
  if (hex) {
    const h = hex[1]!;
    const full =
      h.length === 3
        ? h
            .split("")
            .map((c) => c + c)
            .join("")
        : h;
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
    ];
  }

  const varMatch = /^var\(\s*(--[\w-]+)\s*\)$/.exec(v);
  if (varMatch) {
    const key = varMatch[1]!;
    const next = scope.get(key) ?? RAMPS.get(key);
    return next ? resolve(next, scope, depth + 1) : null;
  }

  // color-mix(in <space>, A p%, B) — on ne résout que le cas utilisé ici :
  // un mélange avec un pourcentage explicite sur la première couleur.
  const mix = /^color-mix\(\s*in\s+[\w-]+\s*,\s*(.+)\)$/.exec(v);
  if (mix) {
    const parts = splitTop(mix[1]!);
    if (parts.length !== 2) return null;
    const [aRaw, bRaw] = parts;
    const aPct = /(\d+(?:\.\d+)?)%\s*$/.exec(aRaw!);
    if (!aPct) return null;
    const p = Number(aPct[1]) / 100;
    const a = resolve(aRaw!.replace(/\s*\d+(?:\.\d+)?%\s*$/, ""), scope, depth + 1);
    const bClean = bRaw!.trim();
    // `transparent` sur une surface : on ne peut pas juger le contraste d'une
    // couleur non résolue — ces tokens ne sont pas des rangs de texte.
    if (bClean === "transparent") return null;
    const b = resolve(bClean, scope, depth + 1);
    if (!a || !b) return null;
    return [0, 1, 2].map((i) => Math.round(a[i]! * p + b[i]! * (1 - p))) as [
      number,
      number,
      number,
    ];
  }

  return null;
}

/** Découpe sur les virgules de premier niveau (ignore celles des parenthèses). */
function splitTop(input: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of input) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

/* ── WCAG ───────────────────────────────────────────────────────────────── */

function luminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function ratio(
  fg: [number, number, number],
  bg: [number, number, number],
): number {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (a + 0.05) / (b + 0.05);
}

const SURFACES = [
  "--hc-canvas",
  "--hc-surface",
  "--hc-surface-inset",
  "--hc-surface-card",
  "--hc-surface-raised",
  "--hc-surface-overlay",
] as const;

const THEMES = [
  { name: "dark", scope: DARK },
  { name: "light", scope: LIGHT },
] as const;

describe("thème dual — contrat de contraste", () => {
  it("theme.css @theme inline ne contient aucun hex", () => {
    const inline = blockAfter(THEME, "@theme inline {");
    const hexes = inline.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    expect(
      hexes,
      "Les valeurs de couleur vivent dans palette.css (--hc-*). theme.css ne " +
        "fait que les exposer à Tailwind.",
    ).toEqual([]);
  });

  it("les deux thèmes définissent le même jeu de clés --hc-*", () => {
    const darkKeys = [...DARK.keys()].filter((k) => k.startsWith("--hc-")).sort();
    const lightKeys = [...LIGHT.keys()]
      .filter((k) => k.startsWith("--hc-"))
      .sort();
    const missingInLight = darkKeys.filter((k) => !lightKeys.includes(k));
    const missingInDark = lightKeys.filter((k) => !darkKeys.includes(k));
    expect(
      { missingInLight, missingInDark },
      "Une clé présente dans un seul thème = un rôle qui retombe sur la valeur " +
        "de l'autre thème, donc un contraste non garanti.",
    ).toEqual({ missingInLight: [], missingInDark: [] });
  });

  for (const { name, scope } of THEMES) {
    for (const surfaceKey of SURFACES) {
      const surface = resolve(`var(${surfaceKey})`, scope);

      it(`${name} — rangs de texte AA sur ${surfaceKey.replace("--hc-", "")}`, () => {
        expect(surface, `surface non résolue : ${surfaceKey}`).not.toBeNull();
        const bg = surface!;

        for (const token of ["--hc-fg", "--hc-muted", "--hc-subtle"] as const) {
          const fg = resolve(`var(${token})`, scope);
          expect(fg, `couleur non résolue : ${token}`).not.toBeNull();
          const r = ratio(fg!, bg);
          expect(
            Number(r.toFixed(2)),
            `${name} ${token} sur ${surfaceKey} = ${r.toFixed(2)}:1 (AA exige 4.5)`,
          ).toBeGreaterThanOrEqual(4.5);
        }

        // `faint` est NON-TEXTUEL par contrat : filets, points, désactivé.
        const faint = resolve("var(--hc-faint)", scope);
        const rf = ratio(faint!, bg);
        expect(
          Number(rf.toFixed(2)),
          `${name} --hc-faint sur ${surfaceKey} = ${rf.toFixed(2)}:1 (≥ 3 exigé pour du non-textuel)`,
        ).toBeGreaterThanOrEqual(3);
      });
    }

    it(`${name} — accent-ink lisible sur canvas et card`, () => {
      const ink = resolve("var(--hc-accent-ink)", scope)!;
      for (const s of ["--hc-canvas", "--hc-surface-card"] as const) {
        const bg = resolve(`var(${s})`, scope)!;
        const r = ratio(ink, bg);
        expect(
          Number(r.toFixed(2)),
          `${name} accent-ink sur ${s} = ${r.toFixed(2)}:1 — c'est la couleur ` +
            `des liens, icônes et anneaux de focus, elle doit atteindre AA.`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    });

    it(`${name} — texte sur remplissage d'accent lisible`, () => {
      const on = resolve("var(--hc-accent-on)", scope)!;
      const fill = resolve("var(--hc-accent)", scope)!;
      const r = ratio(on, fill);
      expect(Number(r.toFixed(2))).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("le thème clair n'utilise aucune ombre à base de noir en dur", () => {
    const lightBlock = blockAfter(PALETTE, '[data-theme="light"] {');
    const elev = [...lightBlock.matchAll(/--hc-elev-[\w-]+:\s*([^;]+);/g)].map(
      (m) => m[1]!,
    );
    const offenders = elev.filter((v) => /#000\b|\bblack\b/.test(v));
    expect(
      offenders,
      "Sur fond clair, une ombre noire pure salit — l'élévation passe par " +
        "l'encre de la palette (--hc-ink).",
    ).toEqual([]);
  });
});
