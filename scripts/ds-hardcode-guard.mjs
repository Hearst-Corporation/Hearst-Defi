#!/usr/bin/env node
/**
 * ds-hardcode-guard.mjs — Anti-regression scan for DS hardcodes in TSX/CSS files.
 *
 * Guards the design system witness page (/admin/customers) and its shared
 * primitives (badge, provenance-badge, kpi-strip, kpi-strip-panel) against
 * the specific patterns that were purged in commit c2207229.
 *
 * Usage:
 *   node scripts/ds-hardcode-guard.mjs           # full scan, exit 1 on hit
 *   node scripts/ds-hardcode-guard.mjs --warn     # report only, exit 0 always
 *
 * Add to CI: `node scripts/ds-hardcode-guard.mjs` (no flag → hard fail).
 * Run manually: `pnpm ds:guard`
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const WARN_ONLY = process.argv.includes("--warn");

// ── Banned patterns ────────────────────────────────────────────────────────────
// Each entry: { pattern: RegExp, reason: string, fix: string }
// Ordered from most specific to most general.
const BANNED = [
  {
    pattern: /#A7FB90/i,
    reason: "Hardcoded brand hex — use var(--ct-accent) or color-mix(in_srgb,var(--ct-accent)…)",
    fix: "Replace with var(--ct-accent) or color-mix(in_srgb,var(--ct-accent)_<alpha>%,transparent)",
  },
  {
    pattern: /border-white\/\d+/,
    reason: "Raw border-white/<opacity> — use var(--ct-border) or var(--ct-border-soft)",
    fix: "border-[var(--ct-border)] or border-[var(--ct-border-soft)]",
  },
  {
    pattern: /dark:border-white\/\d+/,
    reason: "Raw dark:border-white/<opacity> — use var(--ct-border) or var(--ct-border-soft)",
    fix: "border-[var(--ct-border)] or border-[var(--ct-border-soft)]",
  },
  {
    pattern: /text-\[10px\]/,
    reason: "Pixel hardcode text-[10px] — use text-[length:var(--ct-text-nano)] or ct-bento-label",
    fix: "text-[length:var(--ct-text-nano)] or class ct-bento-label",
  },
  {
    pattern: /text-\[11px\]/,
    reason: "Pixel hardcode text-[11px] — use ct-bento-label for micro-labels",
    fix: "class ct-bento-label",
  },
  {
    pattern: /tracking-\[0\.15em\]/,
    reason: "Hardcoded letter-spacing 0.15em — use ct-bento-label (carries --ct-tracking-widest)",
    fix: "class ct-bento-label",
  },
  {
    pattern: /text-zinc-[45]\d\d\b/,
    reason: "Zinc color hardcode — use var(--ct-text-muted) or var(--ct-text-body)",
    fix: "text-[var(--ct-text-muted)] or text-[var(--ct-text-body)]",
  },
  {
    pattern: /dark:text-zinc-[45]\d\d\b/,
    reason: "Dark zinc color hardcode — use var(--ct-text-muted) or var(--ct-text-body)",
    fix: "dark:text-[var(--ct-text-muted)] or dark:text-[var(--ct-text-body)]",
  },
];

// ── Guarded files ──────────────────────────────────────────────────────────────
// The witness page + shared DS primitives it exercises. Add any file you want
// protected. Paths are relative to the repo root.
const GUARDED_FILES = [
  "src/app/admin/customers/page.tsx",
  "src/components/admin/dashboard/admin-kpi-strip-panel.tsx",
  "src/components/admin/dashboard/kpi-strip.tsx",
  "src/components/catalyst/badge.tsx",
  "src/components/ui/provenance-badge.tsx",
  "src/components/admin/kyc-action.tsx",
  "src/components/admin/customer/kyc-status-badge.tsx",
];

// ── Scanner ────────────────────────────────────────────────────────────────────

let totalHits = 0;
const report = [];

for (const rel of GUARDED_FILES) {
  const abs = resolve(ROOT, rel);
  if (!existsSync(abs)) {
    report.push({ file: rel, missing: true });
    continue;
  }

  const lines = readFileSync(abs, "utf8").split("\n");
  const hits = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip comment-only lines: //, *, /**, /** ... */, /* ... */
    if (/^\s*(\/\/|\/?\*|\/\*[\s\S]*?\*\/)/.test(line)) continue;

    for (const { pattern, reason, fix } of BANNED) {
      if (pattern.test(line)) {
        hits.push({ lineNo: i + 1, text: line.trimEnd(), pattern: pattern.source, reason, fix });
      }
    }
  }

  if (hits.length > 0) {
    totalHits += hits.length;
    report.push({ file: rel, hits });
  }
}

// ── Output ─────────────────────────────────────────────────────────────────────

console.log("\n── DS HARDCODE GUARD ─────────────────────────────────────────────────────\n");
console.log(`Mode:   ${WARN_ONLY ? "warn-only (exit 0)" : "strict (exit 1 on hit)"}`);
console.log(`Files:  ${GUARDED_FILES.length} guarded`);
console.log(`Hits:   ${totalHits}\n`);

for (const entry of report) {
  if (entry.missing) {
    console.warn(`  MISSING: ${entry.file} — add it or remove from GUARDED_FILES`);
    continue;
  }
  if (!entry.hits?.length) continue;

  console.log(`  FILE: ${entry.file}`);
  for (const { lineNo, text, reason, fix } of entry.hits) {
    console.log(`    line ${lineNo}: ${text.trim()}`);
    console.log(`    WHY:  ${reason}`);
    console.log(`    FIX:  ${fix}`);
    console.log();
  }
}

if (totalHits === 0) {
  console.log("PASS: no DS hardcodes detected in guarded files.\n");
  process.exit(0);
}

console.log(`─────────────────────────────────────────────────────────────────────────\n`);

if (WARN_ONLY) {
  console.warn(`WARN: ${totalHits} DS hardcode(s) found. Run without --warn to fail CI.\n`);
  process.exit(0);
} else {
  console.error(`FAIL: ${totalHits} DS hardcode(s) detected — fix before merging.\n`);
  process.exit(1);
}
