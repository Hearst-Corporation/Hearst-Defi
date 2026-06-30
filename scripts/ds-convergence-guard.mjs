#!/usr/bin/env node
/**
 * ds-convergence-guard.mjs — Repo-wide anti-regression for the Catalyst
 * convergence (Mission #049). Where ds-hardcode-guard.mjs polices a fixed list
 * of 8 witness files, THIS guard polices the whole `src` tree against the three
 * drift vectors the cartography flagged as "no guard yet":
 *
 *   1. ui/* direction — src/components/ui/ may only hold the 3 sanctioned
 *      non-visual helpers. Any new autonomous visual component there reverses
 *      the convergence (Catalyst is the single UI source).
 *   2. raw #A7FB90 in tsx outside the legitimate fallback allowlist (canvas/SVG
 *      paints that can't resolve a CSS var, brand-constants source of truth).
 *   3. text-[Npx] with an EXACT --ct-text token (8/9/10/11/12/13/14/15/18px),
 *      on product/vaults/proof-center/admin surfaces — the debt purged in lots
 *      8–9. Non-exact sizes (20/24/28/32px) stay arbitrary: no clean token.
 *
 * Usage:
 *   node scripts/ds-convergence-guard.mjs           # strict, exit 1 on hit
 *   node scripts/ds-convergence-guard.mjs --warn     # report only, exit 0
 *
 * Run manually: `pnpm ds:guard:convergence`
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const SRC = resolve(ROOT, "src");
const WARN_ONLY = process.argv.includes("--warn");

// ── Guard 1 — ui/* may only hold these non-visual helpers ──────────────────────
const UI_DIR = resolve(SRC, "components/ui");
const UI_ALLOWED = new Set([
  "provenance-badge.tsx",
  "toaster.tsx",
  "client-toaster.tsx",
  "README.md",
]);

// ── Guard 2 — files allowed to carry a raw #A7FB90 (legitimate fallbacks) ──────
// Canvas/SVG paints (CSS vars don't resolve in 2d-context / some SVG attrs) and
// the brand-constants source of truth. Matched by path suffix.
const ACCENT_FALLBACK_ALLOW = [
  "src/lib/brand-constants.ts",
  "src/components/portfolio/chart/value-area-plot.tsx",
  // Chart.js renders to <canvas>, which can't resolve CSS vars live, so the DS
  // palette is mirrored as raw constants (same pattern as value-area-plot.tsx).
  "src/components/admin/product-workspace/monte-carlo-chart.tsx",
  "src/lib/ui/catalyst-accent.ts",
];

// ── Guard 3 — px sizes that HAVE an exact ct-text token (so must be tokenized) ─
// 16px(base) intentionally omitted: `text-base` is idiomatic and rarely drifts.
const EXACT_PX = ["8", "9", "10", "11", "12", "13", "14", "15", "18"];
const EXACT_PX_RE = new RegExp(`text-\\[(?:${EXACT_PX.join("|")})px\\]`);
// Scope: surfaces that were cleaned. Catalyst primitives are NOT scoped (their
// Headless-UI defaults are managed separately).
const PX_SCOPE_PREFIXES = [
  "src/components/vaults/",
  "src/components/proof-center/",
  "src/components/admin/",
  "src/components/nav/",
  "src/components/profile/",
  "src/app/admin/",
  "src/app/(product)/",
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const abs = resolve(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "__tests__") continue;
      walk(abs, out);
    } else if (/\.(tsx|ts)$/.test(name)) {
      out.push(abs);
    }
  }
  return out;
}

function isComment(line) {
  return /^\s*(\/\/|\/?\*|\/\*[\s\S]*?\*\/)/.test(line);
}

const violations = [];

// ── Guard 1 ────────────────────────────────────────────────────────────────────
for (const name of readdirSync(UI_DIR)) {
  if (name === "__tests__") continue;
  if (!/\.(tsx|ts)$/.test(name) && name !== "README.md") continue;
  if (!UI_ALLOWED.has(name)) {
    violations.push({
      guard: "ui-direction",
      file: relative(ROOT, resolve(UI_DIR, name)),
      lineNo: 0,
      text: name,
      reason:
        "New file in src/components/ui/ — Catalyst is the single UI source. Only the 3 non-visual helpers (provenance-badge, toaster, client-toaster) may live here.",
      fix: "Move the component to src/components/catalyst/ and import from there.",
    });
  }
}

// ── Guards 2 & 3 (line scan) ────────────────────────────────────────────────────
for (const abs of walk(SRC)) {
  const rel = relative(ROOT, abs).split("\\").join("/");
  const accentAllowed = ACCENT_FALLBACK_ALLOW.some((p) => rel.endsWith(p) || rel === p);
  const pxScoped = PX_SCOPE_PREFIXES.some((p) => rel.startsWith(p));
  if (accentAllowed && !pxScoped) continue;

  const lines = readFileSync(abs, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isComment(line)) continue;

    if (!accentAllowed && /#A7FB90/i.test(line)) {
      violations.push({
        guard: "accent-hex",
        file: rel,
        lineNo: i + 1,
        text: line.trim(),
        reason: "Raw #A7FB90 in tsx — Catalyst single-accent canon is var(--ct-accent).",
        fix: "var(--ct-accent) / color-mix(in_srgb,var(--ct-accent)_<a>%,transparent); SVG/canvas paints use readCssColor('--ct-accent', …).",
      });
    }

    if (pxScoped && EXACT_PX_RE.test(line)) {
      const m = line.match(EXACT_PX_RE);
      violations.push({
        guard: "typo-px",
        file: rel,
        lineNo: i + 1,
        text: line.trim(),
        reason: `Pixel hardcode ${m[0]} has an exact ct-text token — tokenize it.`,
        fix: "text-[length:var(--ct-text-{octa|nano|deci|micro|2xs|xs|deca|sm|xl-fixed})] (8/9/10/11/12/13/14/15/18px).",
      });
    }

    // Guard 4 — raw surface hex / opaque zinc surfaces on scoped product/admin
    // surfaces. The 3 canonical surfaces are page/card/inset; nothing should
    // re-hardcode #15191C or bg-zinc-9xx. (Tinted-chip neutrals like
    // bg-zinc-500/10 keep an opacity suffix and are NOT matched here.)
    if (pxScoped && (/#15191[Cc]\b/.test(line) || /\bbg-zinc-9\d0\b/.test(line))) {
      const m = line.match(/#15191[Cc]|bg-zinc-9\d0/);
      violations.push({
        guard: "surface-hex",
        file: rel,
        lineNo: i + 1,
        text: line.trim(),
        reason: `Raw surface ${m[0]} — use a canonical --ct-surface-* token.`,
        fix: "bg-[var(--ct-surface-inset)] (#15191C) / bg-[var(--ct-surface-card)] / bg-[var(--ct-surface-page)]; SVG paints use var(--ct-surface-inset).",
      });
    }

    // Guard 5 — raw Tailwind named colours, REPO-WIDE (every .tsx, catalyst
    // included). Neutrals (white/zinc) + status hues + any palette colour must
    // go through a --ct-* token. Email/route .ts templates (no site CSS, inline
    // hex required) are skipped — only .tsx UI is scanned here.
    if (rel.endsWith(".tsx") &&
        /\b(?:text|bg|border|ring|fill|stroke|divide)-(?:white|zinc|red|amber|sky|rose|emerald|blue|green|orange|yellow|slate|gray|neutral|stone|indigo|violet|purple|pink|teal|cyan|lime)-[0-9]/.test(line)) {
      const m = line.match(/\b(?:text|bg|border|ring|fill|stroke|divide)-(?:white|zinc|red|amber|sky|rose|emerald|blue|green|orange|yellow|slate|gray|neutral|stone|indigo|violet|purple|pink|teal|cyan|lime)-[0-9]+(?:\/[0-9]+)?/);
      violations.push({
        guard: "named-color",
        file: rel,
        lineNo: i + 1,
        text: line.trim(),
        reason: `Raw Tailwind colour ${m[0]} — use a --ct-* token.`,
        fix: "neutrals→--ct-text-*/--ct-surface-*/--ct-border*; status→--ct-status-{danger,warning,info,unaudited,success,neutral}{,-soft,-border}.",
      });
    }
  }
}

// ── Output ─────────────────────────────────────────────────────────────────────
console.log("\n── DS CONVERGENCE GUARD ──────────────────────────────────────────────────\n");
console.log(`Mode:   ${WARN_ONLY ? "warn-only (exit 0)" : "strict (exit 1 on hit)"}`);
console.log(`Scope:  src/** (ui-direction · accent-hex · typo-px)`);
console.log(`Hits:   ${violations.length}\n`);

const byGuard = {};
for (const v of violations) (byGuard[v.guard] ||= []).push(v);
for (const [guard, items] of Object.entries(byGuard)) {
  console.log(`  ── ${guard} (${items.length}) ──`);
  for (const { file, lineNo, text, reason, fix } of items) {
    console.log(`    ${file}${lineNo ? `:${lineNo}` : ""}`);
    console.log(`      ${text}`);
    console.log(`      WHY: ${reason}`);
    console.log(`      FIX: ${fix}\n`);
  }
}

if (violations.length === 0) {
  console.log("PASS: convergence holds (ui/ sealed, no raw accent hex, no exact-token px debt).\n");
  process.exit(0);
}

if (WARN_ONLY) {
  console.warn(`WARN: ${violations.length} convergence regression(s). Run without --warn to fail CI.\n`);
  process.exit(0);
} else {
  console.error(`FAIL: ${violations.length} convergence regression(s) — fix before merging.\n`);
  process.exit(1);
}
