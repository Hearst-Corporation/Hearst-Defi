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
    } else if (/\.(tsx|ts|jsx|js)$/.test(name) && !SKIP_FILE.test(name)) {
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

for (const abs of walk(SRC)) {
  const rel = relative(ROOT, abs).replaceAll("\\", "/");
  const content = readFileSync(abs, "utf8");
  scanBannedClasses(rel, content);
  scanDirectCtCard(rel, content);
  scanStaticCtPill(rel, content);
  scanButtonNoSize(rel, content);
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
