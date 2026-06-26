#!/usr/bin/env node
/**
 * protected-docs-check.mjs — docs that MUST exist and MUST NOT be deleted.
 *
 * Runs in pre-commit: blocks staged deletion of any path listed below.
 * Also fails if a protected file is missing from the working tree.
 *
 * To add a new protected doc: append to PROTECTED_DOCS + update DO_NOT_TOUCH.md
 * and AGENTS.md — do not bypass with --no-verify except explicit human approval.
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Immutable / mandatory-reference docs — never delete, never rename away. */
const PROTECTED_DOCS = ["docs/PORTFOLIO_LAYOUT_REFERENCE.md"];

let ok = true;

for (const rel of PROTECTED_DOCS) {
  if (!existsSync(join(ROOT, rel))) {
    console.error(`FAIL: protected doc missing on disk: ${rel}`);
    ok = false;
  }
}

try {
  const deleted = execSync("git diff --cached --name-only --diff-filter=D", {
    cwd: ROOT,
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(Boolean);

  for (const rel of PROTECTED_DOCS) {
    if (deleted.includes(rel)) {
      console.error(`FAIL: refusing to delete protected doc: ${rel}`);
      console.error("  → Update in place only. See docs/DO_NOT_TOUCH.md § Docs protégées.");
      ok = false;
    }
  }
} catch {
  // Outside git or no index — existence check above is sufficient.
}

if (!ok) process.exit(1);
