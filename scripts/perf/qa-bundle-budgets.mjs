#!/usr/bin/env node
/**
 * scripts/perf/qa-bundle-budgets.mjs
 *
 * POURQUOI CE SCRIPT EXISTE
 * Le repo n'avait AUCUN chiffre de poids : pas de bundle-analyzer, pas de
 * budget, aucun artefact de build conservé. Et `next build` sous Turbopack
 * n'imprime plus la table « Route / Size / First Load JS » — la mesure doit
 * donc se faire à la source, dans `.next/`.
 *
 * CE QU'IL MESURE
 * Le poids TRANSFÉRÉ (gzip) des chunks JS servis à la première visite d'une
 * route, en résolvant, pour chaque entrée cliente de `.next/static/chunks/`,
 * l'ensemble des chunks qu'elle référence. Le gzip est appliqué au contenu réel
 * sur disque : c'est déterministe, sans navigateur, sans serveur, donc sans la
 * variance qui rend un Lighthouse CI inutilisable comme gate.
 *
 * CE QU'IL PROTÈGE — et ce qu'il ne prétend pas protéger
 * Le RATCHET porte sur une seule métrique fiable : le poids gzip cumulé des
 * chunks clients. C'est déterministe et ça ne se laisse pas berner.
 *
 * Le compte de chunks par paquet est INFORMATIF, pas un gate — sauf quand un
 * `maxChunks` explicite est déclaré. Raison mesurée : passer un module en
 * `next/dynamic` fait MONTER son nombre de chunks (le splitting l'éclate) alors
 * même qu'on vient de le sortir du First Load. Un compte en hausse peut donc
 * signifier une amélioration ; en faire un gate produirait des faux rouges.
 * `maxChunks: 0` reste légitime pour un paquet censé avoir DISPARU du repo :
 * là, zéro veut dire zéro.
 *
 * CE QU'IL NE MESURE PAS — à dire, pour ne pas surinterpréter
 * Pas le First Load JS par route : `next build` sous Turbopack ne l'imprime
 * plus, et les manifests de cette version n'exposent pas le graphe par entrée.
 * C'est une mesure AGRÉGÉE. Le poids par route se mesure au navigateur
 * (scripts/perf/qa-network-guardrails.mjs), pas ici.
 *
 * USAGE
 *   node scripts/perf/qa-bundle-budgets.mjs            # vérifie vs baseline
 *   node scripts/perf/qa-bundle-budgets.mjs --write    # (re)pose la baseline
 *   node scripts/perf/qa-bundle-budgets.mjs --json     # sortie machine
 *   node scripts/perf/qa-bundle-budgets.mjs --dir <p>  # autre .next
 *
 * RATCHET : la baseline ne peut que DESCENDRE, comme scripts/quality-gate.mjs
 * et scripts/admin-honesty-baseline.json. `--write` refuse une hausse sans
 * --force, pour qu'une régression ne puisse pas être absorbée par mégarde.
 *
 * EXIT : 0 = ok · 1 = budget dépassé ou invariant violé · 2 = mesure impossible
 * (jamais un faux vert : pas de build ⇒ on le dit, on ne passe pas).
 */

import { gzipSync } from "node:zlib";
import { readdirSync, readFileSync, existsSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = decodeURIComponent(new URL("../..", import.meta.url).pathname);
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const optValue = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};

const NEXT_DIR = optValue("--dir") ?? join(ROOT, ".next");
const BASELINE_PATH = join(ROOT, "scripts/perf/bundle-baseline.json");

/**
 * Paquets lourds suivis chunk par chunk.
 * Détectés par une signature textuelle qui SURVIT à la minification (nom de
 * classe CSS, chaîne littérale) — le nom du paquet, lui, disparaît au bundling.
 * `maxChunks: 0` = invariant dur (le paquet ne doit plus exister nulle part).
 */
const TRACKED_PACKAGES = [
  // Classes CSS émises par Recharts : littérales, donc intactes après minification.
  { id: "recharts", needles: ["recharts-wrapper", "recharts-surface", "recharts-layer"] },
  // ⚠️ Signatures VÉRIFIÉES sur un build réel : `AnimatePresence` et
  // `VisualElement` sont manglés et ne matchent JAMAIS — s'y fier donnait un
  // faux vert. `motionValue` / `MotionConfig` / `whileHover` survivent (clés
  // d'API et noms de props conservés).
  {
    id: "framer-motion",
    needles: ["motionValue", "MotionConfig", "whileHover"],
    maxChunks: 0,
  },
  // sonner : le nom du composant survit dans le markup généré.
  { id: "sonner", needles: ["[data-sonner-toaster]", "sonner-toast"] },
];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".js")) out.push(p);
  }
  return out;
}

function measure() {
  const staticChunks = join(NEXT_DIR, "static", "chunks");
  if (!existsSync(staticChunks)) {
    console.error(
      `[qa-bundle] pas de build à ${relative(ROOT, staticChunks)} — lance \`pnpm build\` d'abord.`,
    );
    process.exit(2);
  }

  const files = walk(staticChunks);
  if (files.length === 0) {
    console.error("[qa-bundle] aucun chunk .js trouvé — build incomplet ?");
    process.exit(2);
  }

  let rawTotal = 0;
  let gzTotal = 0;
  const offenders = new Map(); // id -> Set(chunk)

  for (const f of files) {
    const buf = readFileSync(f);
    rawTotal += buf.length;
    gzTotal += gzipSync(buf, { level: 9 }).length;

    const text = buf.toString("utf8");
    for (const { id, needles } of TRACKED_PACKAGES) {
      if (needles.some((n) => text.includes(n))) {
        if (!offenders.has(id)) offenders.set(id, new Set());
        offenders.get(id).add(relative(staticChunks, f));
      }
    }
  }

  return {
    chunkCount: files.length,
    rawBytes: rawTotal,
    gzBytes: gzTotal,
    staticBytes: dirSize(join(NEXT_DIR, "static")),
    packageChunks: Object.fromEntries(
      TRACKED_PACKAGES.map(({ id }) => [id, offenders.get(id)?.size ?? 0]),
    ),
    packageSamples: Object.fromEntries(
      [...offenders].map(([k, v]) => [k, [...v].slice(0, 5)]),
    ),
  };
}

function dirSize(dir) {
  if (!existsSync(dir)) return 0;
  let total = 0;
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) stack.push(p);
      else total += statSync(p).size;
    }
  }
  return total;
}

const kb = (n) => `${(n / 1024).toFixed(1)} kB`;

const result = measure();

if (flag("--json")) {
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = 0;
} else {
  console.log("── poids des chunks clients ──");
  console.log(`  chunks         ${result.chunkCount}`);
  console.log(`  brut           ${kb(result.rawBytes)}`);
  console.log(`  gzip           ${kb(result.gzBytes)}`);
  console.log(`  .next/static   ${kb(result.staticBytes)}`);
  for (const [id, n] of Object.entries(result.packageChunks)) {
    console.log(`  ${id.padEnd(14)} ${n} chunk(s)`);
  }
}

if (flag("--write")) {
  const prev = existsSync(BASELINE_PATH)
    ? JSON.parse(readFileSync(BASELINE_PATH, "utf8"))
    : null;
  if (prev && result.gzBytes > prev.gzBytes && !flag("--force")) {
    console.error(
      `\n[qa-bundle] REFUS de MONTER la baseline (${kb(prev.gzBytes)} → ${kb(result.gzBytes)}).` +
        `\n            La baseline ne fait que descendre. --force pour passer outre, en le justifiant.`,
    );
    process.exit(1);
  }
  writeFileSync(
    BASELINE_PATH,
    `${JSON.stringify({ ...result, updatedAt: new Date().toISOString() }, null, 2)}\n`,
  );
  console.log(`\nbaseline écrite → ${relative(ROOT, BASELINE_PATH)}`);
  process.exit(0);
}

let failed = false;

// ── Invariants durs (maxChunks explicite) ───────────────────────────────────
for (const { id, maxChunks } of TRACKED_PACKAGES) {
  if (maxChunks === undefined) continue;
  const n = result.packageChunks[id] ?? 0;
  if (n > maxChunks) {
    failed = true;
    console.error(`\n✖ ${id} : ${n} chunk(s), maximum autorisé ${maxChunks}`);
    for (const s of result.packageSamples[id] ?? []) console.error(`    ${s}`);
  }
}

// ── Ratchet ─────────────────────────────────────────────────────────────────
if (existsSync(BASELINE_PATH)) {
  const base = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));

  const delta = result.gzBytes - base.gzBytes;
  const pct = ((delta / base.gzBytes) * 100).toFixed(1);
  if (delta > 0) {
    failed = true;
    console.error(
      `\n✖ poids gzip en HAUSSE : ${kb(base.gzBytes)} → ${kb(result.gzBytes)} (+${kb(delta)}, +${pct} %)`,
    );
  } else {
    console.log(
      `\n✓ poids : ${kb(base.gzBytes)} → ${kb(result.gzBytes)} (${kb(delta)}, ${pct} %)`,
    );
  }

  // Informatif — voir l'en-tête : un compte en hausse peut signaler un
  // `next/dynamic` qui vient de sortir le paquet du First Load. Seul un
  // `maxChunks` explicite fait échouer (traité plus haut).
  for (const [id, n] of Object.entries(result.packageChunks)) {
    const was = base.packageChunks?.[id];
    if (was === undefined) continue;
    const arrow = n === was ? "=" : n < was ? "↓" : "↑";
    console.log(`  ${id.padEnd(14)} ${was} → ${n} chunk(s) ${arrow}`);
  }
} else {
  console.log("\n(pas de baseline — lance --write pour la poser)");
}

if (failed) process.exit(1);
console.log("✓ budgets bundle ok");
