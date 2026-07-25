#!/usr/bin/env node
/**
 * ds-chart-engine-guard.mjs — Recharts-only chart-engine guard (HC-CHART-001).
 *
 * Recharts is the single runtime chart engine for Hearst Connect. The retired
 * Hearst Instrument System (pure-SVG `src/components/dataviz/his/**`) and
 * Chart.js (`chart.js` / `react-chartjs-2`) are gone. This guard fails on any
 * NEW source import of those engines so they cannot creep back in.
 *
 * Scans src/** (.ts/.tsx), skipping comment-only lines and the his directory
 * itself. Bans static imports, `export … from`, dynamic `import()` and
 * `require()` of the three retired engines — type-only imports included, because
 * the packages/dir no longer exist.
 *
 * Usage:
 *   node scripts/ds-chart-engine-guard.mjs           # strict, exit 1 on hit
 *   node scripts/ds-chart-engine-guard.mjs --warn      # report only, exit 0
 * Run via: `pnpm ds:guard:chart-engine` (also chained into `pnpm ds:guard:all`).
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const SRC = resolve(ROOT, "src");
const WARN_ONLY = process.argv.includes("--warn");

// Paths (repo-relative, posix) that are exempt from scanning. The his directory
// is slated for deletion; while it still exists its internal relative imports
// (../geometry …) are not "consumer" imports and must not trip the guard.
const EXEMPT_PREFIXES = ["src/components/dataviz/his/"];

// ── Banned engines ──────────────────────────────────────────────────────────────
const BANNED = [
  {
    // Chart.js
    pattern: /['"]chart\.js['"]/,
    reason: "Chart.js is retired — Recharts is the only chart engine.",
    fix: "Render with Recharts via @/components/catalyst/chart (ChartContainer …).",
  },
  {
    pattern: /['"]react-chartjs-2['"]/,
    reason: "react-chartjs-2 is retired — Recharts is the only chart engine.",
    fix: "Render with Recharts via @/components/catalyst/chart.",
  },
  {
    // Hearst Instrument System (both alias and relative import forms)
    pattern: /['"](?:@\/components\/dataviz\/his|(?:\.\.?\/)+(?:[^'"]*\/)?dataviz\/his)(?:\/[^'"]*)?['"]/,
    reason: "The Hearst Instrument System (dataviz/his) is retired.",
    fix: "Use the canonical Catalyst chart layer (chart-donut, chart-value, chart-fan, chart-proportion-bar, chart-card, chart-source-badge, chart-scale, chart-series, chart-types).",
  },
];

// Only lines that are actually an import/require of a module — avoids flagging a
// bare string literal that happens to read like a path.
const IMPORTISH = /\b(?:import|export|require)\b/;

function isComment(line) {
  return /^\s*(\/\/|\/?\*|\/\*[\s\S]*?\*\/)/.test(line);
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules") continue;
    const abs = resolve(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) {
      walk(abs, out);
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(abs);
    }
  }
  return out;
}

const violations = [];

for (const abs of walk(SRC)) {
  const rel = relative(ROOT, abs).split("\\").join("/");
  if (EXEMPT_PREFIXES.some((p) => rel.startsWith(p))) continue;

  const lines = readFileSync(abs, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isComment(line) || !IMPORTISH.test(line)) continue;
    for (const { pattern, reason, fix } of BANNED) {
      if (pattern.test(line)) {
        violations.push({ file: rel, lineNo: i + 1, text: line.trim(), reason, fix });
      }
    }
  }
}

// ── Output ─────────────────────────────────────────────────────────────────────
console.log("\n── DS CHART-ENGINE GUARD ─────────────────────────────────────────────────\n");
console.log(`Mode:   ${WARN_ONLY ? "warn-only (exit 0)" : "strict (exit 1 on hit)"}`);
console.log(`Scope:  src/** (bans chart.js · react-chartjs-2 · dataviz/his)`);
console.log(`Hits:   ${violations.length}\n`);

for (const v of violations) {
  console.log(`  ${v.file}:${v.lineNo}`);
  console.log(`    ${v.text}`);
  console.log(`    WHY:  ${v.reason}`);
  console.log(`    FIX:  ${v.fix}\n`);
}

if (violations.length === 0) {
  console.log("PASS: Recharts is the only chart engine — no HIS / Chart.js imports.\n");
  process.exit(0);
}

if (WARN_ONLY) {
  console.warn(`WARN: ${violations.length} retired-chart-engine import(s). Run without --warn to fail.\n`);
  process.exit(0);
}
console.error(`FAIL: ${violations.length} retired-chart-engine import(s) — migrate to Recharts.\n`);
process.exit(1);
