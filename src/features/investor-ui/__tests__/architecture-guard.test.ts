// src/features/investor-ui/__tests__/architecture-guard.test.ts
//
// Static architecture guard for the Investor UI V2 refonte. Scans every
// source file under the three new rail screens (dashboard/btc/mining) and
// fails if any of them reaches for a forbidden low-level dependency instead
// of going through `InvestorUiDataSource`. Pattern copied from
// `src/app/(product)/portfolio/__tests__/portfolio-real-data-contract.test.ts`
// (read source as text, assert with regex) since this repo has no RTL/jsdom
// (vitest.config.ts env "node").
//
// Allowed: pure types, `investor-ui/data-source`, `investor-ui/fixtures`, and
// the future GPU1 adapter (`@/lib/gpu1-client/*`) — that IS the legitimate
// future transport, not a bypass of this feature's seam.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const SCREEN_ROOTS = [
  "src/app/(product)/dashboard",
  "src/app/(product)/btc",
  "src/app/(product)/mining",
] as const;

/** Recursively collect every source file (ts/tsx) under a directory. Returns
 *  [] silently if the directory doesn't exist yet (a screen may not have
 *  landed any files besides page.tsx at some point in the build-out). */
function collectSourceFiles(root: string): string[] {
  const absRoot = join(process.cwd(), root);
  let entries: string[];
  try {
    entries = readdirSync(absRoot);
  } catch {
    return [];
  }

  const files: string[] = [];
  for (const entry of entries) {
    const abs = join(absRoot, entry);
    const rel = join(root, entry);
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      files.push(...collectSourceFiles(rel));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      files.push(rel);
    }
  }
  return files;
}

const stripComments = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

/** Forbidden import path patterns — a screen file must never match these. */
const FORBIDDEN_IMPORT_PATTERNS: readonly RegExp[] = [
  /from\s+["']@\/lib\/db["']/,
  /from\s+["']@prisma\/client["']/,
  /from\s+["'][^"']*supabase[^"']*["']/i,
  /from\s+["']viem["']/,
  /from\s+["']viem\/[^"']*["']/,
  /from\s+["']ethers["']/,
  /from\s+["']ethers\/[^"']*["']/,
  /from\s+["'][^"']*@\/lib\/mining\/[^"']*provider[^"']*["']/i,
  /from\s+["']@\/lib\/data\/[^"']*["']/,
];

/** A bare `fetch(` call to a hardcoded external URL — internal relative
 *  fetches (none expected here) or `gpu1Fetch` wrapper calls are fine. */
const HARDCODED_EXTERNAL_FETCH = /fetch\(\s*["']https?:\/\//;

/** Paths that ARE allowed even though they might superficially look close to
 *  a forbidden pattern (documents the exception, keeps the regexes tight). */
function isAllowedException(importLine: string): boolean {
  if (importLine.includes("@/features/investor-ui")) return true;
  if (importLine.includes("@/lib/gpu1-client")) return true;
  return false;
}

describe("Investor UI V2 architecture guard (dashboard/btc/mining)", () => {
  const allFiles = SCREEN_ROOTS.flatMap((root) => collectSourceFiles(root));

  it("finds at least the known screen entry files (sanity check the scan works)", () => {
    // If this ever fails, the glob/collector broke — not that the screens are
    // clean. Each screen root should have landed at least a page.tsx.
    expect(allFiles.length).toBeGreaterThan(0);
  });

  it.each(allFiles)("does not import a forbidden low-level dependency: %s", (relPath) => {
    const raw = readFileSync(join(process.cwd(), relPath), "utf8");
    const source = stripComments(raw);

    const lines = source.split("\n");
    for (const line of lines) {
      if (!/^\s*import[\s{]/.test(line) && !line.includes("from ")) continue;
      if (isAllowedException(line)) continue;
      for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
        expect(
          pattern.test(line),
          `${relPath} imports a forbidden dependency: "${line.trim()}"`,
        ).toBe(false);
      }
    }

    expect(
      HARDCODED_EXTERNAL_FETCH.test(source),
      `${relPath} calls fetch() against a hardcoded external URL`,
    ).toBe(false);
  });
});
