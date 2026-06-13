#!/usr/bin/env node
/**
 * DS layout guardrails — blocking audit for document-flow anti-patterns.
 * Usage: node scripts/ds-layout-audit.mjs
 * Exit 0 when clean; exit 1 on violations.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SRC = join(ROOT, "src");

/** @type {{ file: string; line: number; rule: string; detail: string }[]} */
const violations = [];

const SKIP_DIR = new Set(["node_modules", ".next", "coverage"]);
const SKIP_FILE = /\.(test|spec)\.(tsx?|jsx?)$/;

const warnings = [];

const CT_PILL_ALLOWLIST = new Set([
  "src/app/admin/signals/page.tsx",
  "src/app/admin/vaults/page.tsx",
  "src/app/admin/vaults/_vault-form.tsx",
  "src/app/admin/governance/page.tsx",
  "src/app/admin/projection/studio.tsx",
  "src/components/proof/proof-filter.tsx",
  "src/components/admin/governance/allowlist-board.tsx",
  "src/components/scenario/central-task-runner.tsx"
]);

const BANNED_CLASS_TOKENS = ["ct-table-surface", "ct-hover-surface"];

// ── Brand/colour + shadow invariants (locked after the green restore) ──────────
/** Maroon is rejected as the active brand accent — must never re-enter runtime. */
const MAROON_RE = /#9e1b2e\b|\b158,\s*27,\s*46\b|#8a1538\b/i;
/** One runtime green: success resolves to var(--ct-accent); no hardcoded #16A34A
 *  in web code. Print (PDF) keeps its own green — allowlisted below. */
const SECOND_GREEN_RE = /#16a34a\b/i;
const GREEN_ALLOWLIST = new Set([
  "src/lib/pdf/pdf-palette.ts", // print on white — not web runtime
  "src/lib/brand-constants.ts", // CONNECT_SUCCESS_HEX print/SDK constant
]);
/** Use tokenized DS shadows (shadow-[var(--ct-shadow-*)]) — never raw Tailwind. */
const RAW_SHADOW_RE = /\bshadow-(?:sm|md|lg|xl|2xl|inner)\b/g;
/** Selection controls go through <SegmentedControl> / <Tab>, not raw ct-seg-* classes. */
const RAW_SEG_RE = /\bct-seg-(?:btn|track)\b/g;
const SEG_ALLOWLIST = new Set([
  "src/components/ui/segmented-control.tsx", // the primitive
  // consumers not yet migrated (Phase-3 control consolidation):
  "src/components/scenario/scenario-tab-bar.tsx",
  "src/components/ui/chart-time-selector.tsx",
]);

/** Only Card primitive may bind `.ct-card` directly. */
const CT_CARD_ALLOWLIST = new Set([
  "src/components/ui/card.tsx",
]);

const HUB_MODE_STYLES = "src/components/hub-mode-styles.tsx";

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR.has(name)) continue;
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) {
      walk(abs, out);
    } else if (/\.(tsx|ts|jsx|js|css)$/.test(name) && !SKIP_FILE.test(name)) {
      out.push(abs);
    }
  }
  return out;
}

function lineNumberAt(content, index) {
  return content.slice(0, index).split("\n").length;
}

function scanBannedClasses(rel, content) {
  for (const token of BANNED_CLASS_TOKENS) {
    let from = 0;
    while (true) {
      const idx = content.indexOf(token, from);
      if (idx === -1) break;
      violations.push({
        file: rel,
        line: lineNumberAt(content, idx),
        rule: "banned-class",
        detail: `Forbidden class token "${token}" — use Card + ct-table-cell rows or doc-flow stacks`,
      });
      from = idx + token.length;
    }
  }
}

function scanDirectCtCard(rel, content) {
  if (CT_CARD_ALLOWLIST.has(rel) || rel === HUB_MODE_STYLES) return;

  const re = /\bct-card\b(?!-)/g;
  let match;
  while ((match = re.exec(content)) !== null) {
    violations.push({
      file: rel,
      line: lineNumberAt(content, match.index),
      rule: "direct-ct-card",
      detail:
        'Use <Card> from @/components/ui/card instead of className "ct-card"',
    });
  }
}

function scanStaticCtPill(rel, content) {
  if (CT_PILL_ALLOWLIST.has(rel)) return;
  const re = /\bct-pill\b/g;
  let match;
  while ((match = re.exec(content)) !== null) {
    warnings.push({
      file: rel,
      line: lineNumberAt(content, match.index),
      rule: "static-ct-pill",
      detail: "Use <Badge> for static pills. ct-pill is only for interactive filters.",
    });
  }
}

function scanButtonNoSize(rel, content) {
  const re = /<Button\b([\s\S]*?)>/g;
  let match;
  while ((match = re.exec(content)) !== null) {
    if (!match[1].includes("size=")) {
      warnings.push({
        file: rel,
        line: lineNumberAt(content, match.index),
        rule: "button-no-size",
        detail: "Button without explicit size= prop. Default is md, but should be explicit.",
      });
    }
  }
}

function scanMaroon(rel, content) {
  const re = new RegExp(MAROON_RE.source, "gi");
  let m;
  while ((m = re.exec(content)) !== null) {
    violations.push({
      file: rel,
      line: lineNumberAt(content, m.index),
      rule: "maroon-runtime",
      detail: `Maroon "${m[0]}" is rejected as brand accent — use var(--ct-accent) (#A7FB90).`,
    });
  }
}

function scanSecondGreen(rel, content) {
  if (GREEN_ALLOWLIST.has(rel)) return;
  const re = new RegExp(SECOND_GREEN_RE.source, "gi");
  let m;
  while ((m = re.exec(content)) !== null) {
    violations.push({
      file: rel,
      line: lineNumberAt(content, m.index),
      rule: "second-green",
      detail:
        "Hardcoded #16A34A — there is one runtime green. Use var(--ct-status-success) (resolves to --ct-accent).",
    });
  }
}

function scanRawShadow(rel, content) {
  RAW_SHADOW_RE.lastIndex = 0;
  let m;
  while ((m = RAW_SHADOW_RE.exec(content)) !== null) {
    violations.push({
      file: rel,
      line: lineNumberAt(content, m.index),
      rule: "raw-shadow",
      detail: `Raw Tailwind "${m[0]}" — use shadow-[var(--ct-shadow-soft|elevated|inset)].`,
    });
  }
}

function scanRawSeg(rel, content) {
  if (SEG_ALLOWLIST.has(rel)) return;
  RAW_SEG_RE.lastIndex = 0;
  let m;
  while ((m = RAW_SEG_RE.exec(content)) !== null) {
    warnings.push({
      file: rel,
      line: lineNumberAt(content, m.index),
      rule: "raw-seg",
      detail:
        "Use <SegmentedControl>/<Tab> from @/components/ui/segmented-control instead of raw ct-seg-* classes.",
    });
  }
}

for (const abs of walk(SRC)) {
  const rel = relative(ROOT, abs).replaceAll("\\", "/");
  const content = readFileSync(abs, "utf8");
  // colour/shadow invariants run on every file (incl. CSS for maroon).
  scanMaroon(rel, content);
  if (rel.endsWith(".css")) continue; // class/component scans are code-only
  scanBannedClasses(rel, content);
  scanDirectCtCard(rel, content);
  scanStaticCtPill(rel, content);
  scanButtonNoSize(rel, content);
  scanSecondGreen(rel, content);
  scanRawShadow(rel, content);
  scanRawSeg(rel, content);
}

// Package source lives outside src/ but is the brand-token origin — guard maroon there too.
try {
  scanMaroon("package/tokens.css", readFileSync(join(ROOT, "package/tokens.css"), "utf8"));
} catch {
  /* package/tokens.css absent in some checkouts — skip */
}

if (warnings.length > 0) {
  console.warn("⚠️  ds-layout-audit — warnings found:\n");
  for (const w of warnings) {
    console.warn(`  ${w.file}:${w.line} [${w.rule}] ${w.detail}`);
  }
  console.warn(`\nTotal warnings: ${warnings.length}\n`);
}

if (violations.length === 0) {
  console.log("✅ ds-layout-audit — no violations");
  process.exit(0);
}

console.error("❌ ds-layout-audit — violations found:\n");
for (const v of violations) {
  console.error(`  ${v.file}:${v.line} [${v.rule}] ${v.detail}`);
}
console.error(`\nTotal: ${violations.length}`);
process.exit(1);
