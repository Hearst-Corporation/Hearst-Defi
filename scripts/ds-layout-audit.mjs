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

for (const abs of walk(SRC)) {
  const rel = relative(ROOT, abs).replaceAll("\\", "/");
  const content = readFileSync(abs, "utf8");
  scanBannedClasses(rel, content);
  scanDirectCtCard(rel, content);
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
