#!/usr/bin/env node
/**
 * scripts/staged-scope-check.mjs — surgical-staging guard (advisory).
 *
 * Classifies the staged files (or paths passed via --paths) into coarse domain
 * buckets and flags a commit whose index spans MORE THAN ONE domain — the
 * "git add -A absorbed another workstream" smell (incident 2026-06-17, where
 * docs/DEPLOYMENT.md got swept into a feat(ui) commit).
 *
 * Usage:
 *   node scripts/staged-scope-check.mjs            # warn-only (exit 0), loud if multi-domain
 *   node scripts/staged-scope-check.mjs --strict   # exit 1 if multi-domain (override: COMMIT_MULTIDOMAIN=1)
 *   node scripts/staged-scope-check.mjs --paths a b # classify the given paths (test/CI), not the index
 *
 * Advisory by design: NOT wired into the pre-commit hook in this lot (wiring it
 * would alter a concurrently-committing workstream's commit path + risk
 * false-positive blocking). Promote to a blocking pre-commit step as a separate
 * P1 once validated in a calm tree. Inspect anytime: pnpm commit:check.
 */
import { execSync } from "node:child_process";

const argv = process.argv.slice(2);
const strict = argv.includes("--strict");
const pathsIdx = argv.indexOf("--paths");
const files =
  pathsIdx !== -1
    ? argv.slice(pathsIdx + 1).filter((a) => !a.startsWith("--"))
    : execSync("git diff --cached --name-only", { encoding: "utf8" })
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

const BUCKETS = [
  ["engine-contracts", (f) => /^src\/lib\/(engine|onchain)\//.test(f) || /^contracts\//.test(f)],
  ["db", (f) => /^prisma\//.test(f)],
  ["ui", (f) => /^src\/(app|components)\//.test(f) || /^cockpit-shell\//.test(f) || /^[^/]+\.css$/.test(f)],
  ["lib", (f) => /^src\/lib\//.test(f) || f === "src/proxy.ts"],
  [
    "control-plane",
    (f) =>
      /^(docs|\.cursor|\.claude|scripts|\.husky|\.github)\//.test(f) ||
      /^[^/]+\.md$/.test(f) ||
      /^(package\.json|pnpm-.*\.yaml|tsconfig.*\.json|next\.config\.ts|.*\.config\.(js|mjs|ts)|knip\.json|\.jscpd\.json)$/.test(f),
  ],
];

const SENSITIVE = [
  /^next\.config\.ts$/,
  /^src\/proxy\.ts$/,
  /^src\/lib\/auth\//,
  /^prisma\/migrations\//,
  /^contracts\//,
  /^src\/lib\/engine\//,
  /^src\/lib\/email\/send\.ts$/,
];

const C = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

const bucketOf = (f) => {
  for (const [name, test] of BUCKETS) if (test(f)) return name;
  return "other";
};

if (files.length === 0) {
  console.log(C.dim("commit:check — index vide, rien à vérifier."));
  process.exit(0);
}

const byBucket = new Map();
for (const f of files) {
  const b = bucketOf(f);
  if (!byBucket.has(b)) byBucket.set(b, []);
  byBucket.get(b).push(f);
}
const sensitive = files.filter((f) => SENSITIVE.some((re) => re.test(f)));
const buckets = [...byBucket.keys()];

console.log(C.bold("commit:check — domaines dans l'index :"), buckets.join(", "));
for (const [b, fs] of byBucket) console.log(C.dim(`  · ${b}: ${fs.join(", ")}`));
if (sensitive.length) {
  console.log(C.yellow("⚠ zone(s) sensible(s) dans l'index — confirmer que c'est intentionnel :"));
  for (const f of sensitive) console.log(C.yellow(`    ${f}`));
}

if (buckets.length > 1) {
  const msg =
    `index multi-domaine (${buckets.length}) — un commit = un scope. ` +
    `Probable staging large (git add -A) ayant absorbé un autre workstream.`;
  if (strict && process.env.COMMIT_MULTIDOMAIN !== "1") {
    console.log(C.red(C.bold("✖ " + msg)));
    console.log(C.dim("  → garde tes chemins précis : git restore --staged <hors-scope>. Délibéré : COMMIT_MULTIDOMAIN=1."));
    process.exit(1);
  }
  console.log(C.yellow("⚠ " + msg));
  console.log(C.dim("  → ce commit ne doit contenir QUE ton lot."));
  process.exit(0);
}

console.log(C.green(`✓ index mono-domaine (${buckets[0]}).`));
process.exit(0);
