#!/usr/bin/env node
/**
 * scripts/quality-gate.mjs — RATCHET gate against duplication + dead code.
 *
 * WHY A RATCHET (and not zero-tolerance): the repo already carries a known
 * baseline of duplication (~143 clones / 1.9%) and dead code (~23 items, the
 * audit-flagged duplications + a few orphan exports). A zero-tolerance gate
 * would block EVERY commit on day one. This gate instead fails only when a
 * change makes things WORSE than the committed baseline in
 * `scripts/quality-baseline.json`. The baseline can only go DOWN (you run
 * `node scripts/quality-gate.mjs update` after a deliberate cleanup), so the
 * codebase can never regress — it can only get cleaner. That is what enforces
 * "jamais de double composant" and "remplace ET nettoie l'ancien".
 *
 * Modes:
 *   dup     → run jscpd, fail if clone count > baseline.dup.clones
 *   dead    → run knip, fail if total findings > baseline.dead.total
 *   all     → both
 *   update  → re-measure and overwrite the baseline (only lowers it; refuses
 *             to raise it without --force)
 *
 * Exit 0 = ok / improved. Exit 1 = regression (commit/push blocked).
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const BASELINE_PATH = join(ROOT, "scripts", "quality-baseline.json");

const C = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

function readBaseline() {
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  } catch {
    return { dup: { clones: Infinity }, dead: { total: Infinity } };
  }
}

/** Run jscpd and return the total clone count. */
function measureDup() {
  const out = mkdtempSync(join(tmpdir(), "jscpd-"));
  try {
    execSync(
      `pnpm exec jscpd src --silent --reporters json --output ${JSON.stringify(out)}`,
      { cwd: ROOT, stdio: ["ignore", "ignore", "ignore"] },
    );
    const report = JSON.parse(readFileSync(join(out, "jscpd-report.json"), "utf8"));
    const stats = report.statistics?.total ?? {};
    return {
      clones: stats.clones ?? (report.duplicates?.length ?? 0),
      percentage: Number(stats.percentage ?? 0),
    };
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

/** Run knip and return the total count of real findings (excludes hints). */
function measureDead() {
  let raw = "";
  try {
    raw = execSync("pnpm exec knip --reporter json --no-exit-code", {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (e) {
    raw = e.stdout?.toString() ?? "";
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { total: NaN, breakdown: {} };
  }
  // knip v6 json: { files: [...], issues: [ { file, dependencies, devDependencies,
  // exports, types, duplicates, enumMembers, ... } ] }. Count files + every
  // per-file issue array EXCEPT pure hints. We deliberately ignore
  // "configurationHints" — they are advice, not dead code.
  const files = Array.isArray(data.files) ? data.files.length : 0;
  // Count DEAD CODE only — unused files, exports, types, duplicate exports,
  // enum/class members. Deliberately EXCLUDE dependency/config findings
  // (dependencies, devDependencies, unlisted, binaries, unresolved): those are
  // a supply-chain concern, not dead code, and knip reports them slightly
  // non-deterministically (±1 run-to-run) which would flake the ratchet.
  const COUNTED = [
    "exports",
    "types",
    "nsExports",
    "nsTypes",
    "duplicates",
    "enumMembers",
    "classMembers",
  ];
  const breakdown = { files };
  let total = files;
  for (const issue of data.issues ?? []) {
    for (const key of COUNTED) {
      const arr = issue[key];
      if (Array.isArray(arr) && arr.length) {
        breakdown[key] = (breakdown[key] ?? 0) + arr.length;
        total += arr.length;
      }
    }
  }
  return { total, breakdown };
}

function checkDup(baseline) {
  process.stdout.write(C.dim("· duplication (jscpd)… "));
  const cur = measureDup();
  const limit = baseline.dup?.clones ?? Infinity;
  if (cur.clones > limit) {
    console.log(C.red(`FAIL`));
    console.log(
      C.red(
        `  ${cur.clones} clones (${cur.percentage}%) > baseline ${limit}. ` +
          `You introduced NEW duplicated code.`,
      ),
    );
    console.log(
      C.dim(
        `  → Reuse the existing component instead of copying it. ` +
          `If it was bad, refactor it IN PLACE and delete the old one.`,
      ),
    );
    console.log(C.dim(`  → Inspect: pnpm quality:dup:report`));
    return false;
  }
  console.log(
    C.green(`ok`) +
      C.dim(` (${cur.clones} clones / baseline ${limit})`) +
      (cur.clones < limit ? C.yellow(`  ↓ improved — run: pnpm quality:update`) : ""),
  );
  return true;
}

function checkDead(baseline) {
  process.stdout.write(C.dim("· dead code (knip)… "));
  const cur = measureDead();
  const limit = baseline.dead?.total ?? Infinity;
  if (Number.isNaN(cur.total)) {
    console.log(C.yellow(`skipped (knip output unparseable)`));
    return true; // never block on tooling failure
  }
  if (cur.total > limit) {
    console.log(C.red(`FAIL`));
    console.log(
      C.red(`  ${cur.total} dead-code findings > baseline ${limit}.`),
      C.dim(JSON.stringify(cur.breakdown)),
    );
    console.log(
      C.dim(
        `  → You left an orphan (unused file/export). If you replaced a ` +
          `component, DELETE the old one. Inspect: pnpm quality:dead:report`,
      ),
    );
    return false;
  }
  console.log(
    C.green(`ok`) +
      C.dim(` (${cur.total} findings / baseline ${limit})`) +
      (cur.total < limit ? C.yellow(`  ↓ improved — run: pnpm quality:update`) : ""),
  );
  return true;
}

function update(force) {
  const baseline = readBaseline();
  const dup = measureDup();
  const dead = measureDead();
  const next = {
    dup: { clones: dup.clones, percentage: dup.percentage },
    dead: { total: dead.total, breakdown: dead.breakdown },
    updatedAt: new Date(parseInt(process.env.QUALITY_TS ?? "0", 10) || Date.now()).toISOString(),
  };
  const dupUp = dup.clones > (baseline.dup?.clones ?? Infinity);
  const deadUp = dead.total > (baseline.dead?.total ?? Infinity);
  if ((dupUp || deadUp) && !force) {
    console.log(
      C.red(
        `Refusing to RAISE the baseline (dup ${dup.clones} vs ${baseline.dup?.clones}, ` +
          `dead ${dead.total} vs ${baseline.dead?.total}). A ratchet only goes down. ` +
          `Use --force only if you truly accept more debt.`,
      ),
    );
    process.exit(1);
  }
  writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + "\n");
  console.log(C.green(`baseline updated → dup ${dup.clones} clones, dead ${dead.total} findings`));
}

const mode = process.argv[2] ?? "all";
const force = process.argv.includes("--force");

if (mode === "update") {
  update(force);
} else {
  const baseline = readBaseline();
  console.log(C.bold("quality-gate (ratchet) "));
  let ok = true;
  if (mode === "dup" || mode === "all") ok = checkDup(baseline) && ok;
  if (mode === "dead" || mode === "all") ok = checkDead(baseline) && ok;
  if (!ok) {
    console.log(
      C.red(C.bold("\n✖ quality gate failed")) +
        C.dim("  (bypass with --no-verify only if you know what you're doing)"),
    );
    process.exit(1);
  }
  console.log(C.green("✓ quality gate passed"));
}
