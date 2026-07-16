// PROMPT 236 — investor surfaces are BTC-only accumulation surfaces: no return
// projection, no p5/p50/p95 bands, no Accumulation Trajectory, no take-profit
// mechanics, no yield/APY/return-range copy. This guard scans the FOUR investor
// route trees recursively (page + _components + _data), stripping comments so a
// "// no p5/p50/p95 here" note never counts as a violation.
//
// Style: mirrors the source-grep guards in prompt-227 + btc-page-content, using
// the recursive dir walk so subfolders are covered (prompt-227 only reached the
// three top-level page.tsx files). Deliberately phrase-scoped: bare `yield`
// stays allowed because the historical route key `hearst-yield-vault` legitimately
// contains it (documented in dashboard-page.render.test.tsx) — the banned thing
// is return/yield COPY, not the route id.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const SURFACE_ROOTS = ["dashboard", "btc", "mining", "profile"].map((r) =>
  join(process.cwd(), "src/app/(product)", r),
);

const BANNED = [
  /\bp5\b/,
  /\bp50\b/,
  /\bp95\b/,
  /Accumulation Trajectory/i,
  /Strategic BTC/i,
  /\bestimated return\b/i,
  /\breturn range\b/i,
  /\breturn band\b/i,
  /\bperformance band\b/i,
  /\btarget apy\b/i,
  /\bprojected yield\b/i,
  /\bexpected return\b/i,
  /\bmonthly distribution\b/i,
  /\bcash distribution\b/i,
  /\bplanned accumulation\b/i,
  /\bplanned return\b/i,
  /\bmaturity return\b/i,
  /\btake-profit band\b/i,
];

const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__") continue;
      out.push(...collectSourceFiles(full));
    } else if (/\.(tsx|ts)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("PROMPT 236 — investor surfaces carry no retired return/projection vocabulary", () => {
  const files = SURFACE_ROOTS.flatMap((root) => {
    try {
      return collectSourceFiles(root);
    } catch {
      return [];
    }
  });

  it("collected the four surface trees", () => {
    expect(files.length).toBeGreaterThan(4);
  });

  it.each(files)("%s has no banned return/projection copy", (file) => {
    const rel = file.replace(process.cwd() + "/", "");
    const src = stripComments(readFileSync(file, "utf8"));
    for (const pattern of BANNED) {
      expect(src, `${rel} matched ${pattern}`).not.toMatch(pattern);
    }
  });
});
