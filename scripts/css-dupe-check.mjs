#!/usr/bin/env node
/**
 * css-dupe-check — garde-fou contre le motif qui a causé le "doublon" KPI strip :
 * une MÊME classe de base (`.foo {`) définie dans 2+ feuilles CSS, dont les
 * règles se superposent et se contredisent (ancienne génération « grille bordée »
 * laissée dans cockpit.css par-dessus le modèle plat de dashboard.css).
 *
 * On ne flague QUE les sélecteurs de base mono-classe (`.foo {` ou `.foo,`).
 * Les overrides scopés légitimes (`.admin-doc .foo`, `.foo.bar`, `.foo:hover`,
 * `.foo > .x`) sont ignorés : ce ne sont pas des redéfinitions de la classe.
 *
 * Ratchet : `css-dupe-baseline.json` liste les doublons connus/acceptés. Le check
 * échoue UNIQUEMENT sur un NOUVEAU doublon (régression). `--update` régénère la
 * baseline. Léger, déterministe, zéro dépendance.
 *
 * Usage:
 *   node scripts/css-dupe-check.mjs           # check (exit 1 si nouveau doublon)
 *   node scripts/css-dupe-check.mjs --report  # liste tout, exit 0
 *   node scripts/css-dupe-check.mjs --update  # fige la baseline sur l'état courant
 */
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const SCAN_DIR = join(ROOT, "src/app");
const BASELINE = join(dirname(fileURLToPath(import.meta.url)), "css-dupe-baseline.json");
const MODE = process.argv.includes("--update") ? "update"
  : process.argv.includes("--report") ? "report" : "check";

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (p.endsWith(".css")) out.push(p);
  }
  return out;
}

// Bare single-class selector at a rule head: preceded by {, }, newline or comma;
// the class token; immediately followed (after ws) by { or , — i.e. not a
// descendant/compound/pseudo selector.
const BARE = /(?:^|[\n,{}])\s*\.([A-Za-z_][\w-]*)\s*(?=[,{])/g;

const defs = new Map(); // class -> Set(relFile)
for (const file of walk(SCAN_DIR)) {
  const rel = relative(ROOT, file);
  const css = readFileSync(file, "utf8");
  let m;
  while ((m = BARE.exec(css))) {
    const cls = m[1];
    if (!defs.has(cls)) defs.set(cls, new Set());
    defs.get(cls).add(rel);
  }
}

const dupes = {};
for (const [cls, files] of defs) {
  if (files.size > 1) dupes[cls] = [...files].sort();
}
const dupeKeys = Object.keys(dupes).sort();

if (MODE === "update") {
  writeFileSync(BASELINE, JSON.stringify(dupes, null, 2) + "\n");
  console.log(`css-dupe-check: baseline figée — ${dupeKeys.length} doublon(s) accepté(s).`);
  process.exit(0);
}

if (MODE === "report") {
  if (dupeKeys.length === 0) { console.log("css-dupe-check: aucun doublon de classe cross-fichier. ✓"); process.exit(0); }
  console.log(`css-dupe-check: ${dupeKeys.length} classe(s) définie(s) dans 2+ feuilles :\n`);
  for (const cls of dupeKeys) console.log(`  .${cls}\n     ${dupes[cls].join("\n     ")}`);
  process.exit(0);
}

// check mode: fail only on NEW dupes vs baseline
const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, "utf8")) : {};
const novel = dupeKeys.filter((c) => !(c in baseline));
if (novel.length === 0) {
  console.log(`css-dupe-check: ✓ (${dupeKeys.length} doublon(s) connu(s), 0 nouveau).`);
  process.exit(0);
}
console.error(`css-dupe-check: ✗ ${novel.length} NOUVEAU(X) doublon(s) de classe CSS cross-fichier :\n`);
for (const cls of novel) console.error(`  .${cls}\n     ${dupes[cls].join("\n     ")}`);
console.error(`\nUne classe de base ne doit vivre que dans UNE feuille (sinon générations qui se superposent = doublon visuel).`);
console.error(`Consolide la classe dans un seul fichier, ou — si c'est volontaire — fige : node scripts/css-dupe-check.mjs --update`);
process.exit(1);
