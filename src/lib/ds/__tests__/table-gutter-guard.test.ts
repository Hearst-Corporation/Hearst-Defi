import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Global Table Gutter Guard — Mission #059.
 *
 * The Catalyst table primitive owns the table gutter contract. Its first/last
 * cells get a symmetric 20px edge gutter (`first:pl-5 last:pr-5`) and every cell
 * is `px-4`. The old destructive override (`first:pl-(--gutter,…)`,
 * `last:pr-(--gutter,…)`, then `sm:first:pl-1 sm:last:pr-1`, plus the
 * `-mx-(--gutter)` table bleed) glued the edge columns to the card frame and
 * broke left/right symmetry — it has been removed.
 *
 * This guard freezes that decision: the destructive gutter patterns may only
 * appear inside the single table-primitive file. Anywhere else they are a
 * regression (a page re-introducing the page-by-page patching the owner killed).
 *
 * It also REPORTS (does not fail on) `table-fixed` usage as an awareness signal —
 * `table-fixed` is allowed but should be a deliberate, narrow choice.
 */

const ROOT = process.cwd();

// The ONLY file allowed to define the table gutter mechanics.
const PRIMITIVE_ALLOWLIST = ["src/components/catalyst/table.tsx"];

// Destructive gutter patterns — forbidden outside the primitive allowlist.
// Matched against raw file text (these are Tailwind class fragments).
const FORBIDDEN_PATTERNS: { id: string; re: RegExp }[] = [
  { id: "first:pl-(--gutter", re: /first:pl-\(--gutter/ },
  { id: "last:pr-(--gutter", re: /last:pr-\(--gutter/ },
  { id: "sm:first:pl-1", re: /sm:first:pl-1\b/ },
  { id: "sm:last:pr-1", re: /sm:last:pr-1\b/ },
  { id: "-mx-(--gutter)", re: /-mx-\(--gutter\)/ },
];

const SCAN_ROOTS = ["src/app", "src/components"];
const EXT = /\.(tsx?|jsx?)$/;
// Tests describe these patterns as forbidden anti-patterns; they legitimately
// contain the strings. Exclude the test directory from the scan.
const SKIP_SEGMENTS = new Set(["__tests__", "node_modules", ".next"]);

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    const rel = relative(ROOT, full);
    if (rel.split(sep).some((seg) => SKIP_SEGMENTS.has(seg))) continue;
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, out);
    else if (EXT.test(name)) out.push(rel);
  }
  return out;
}

const FILES = SCAN_ROOTS.flatMap((r) => walk(join(ROOT, r)));

function isAllowlisted(rel: string): boolean {
  const norm = rel.split(sep).join("/");
  return PRIMITIVE_ALLOWLIST.includes(norm);
}

/**
 * Strip comments before scanning so prose that *documents* a forbidden pattern
 * (e.g. "// Neutralize the old -mx-(--gutter) bleed") is not flagged as a live
 * use. Removes block comments (/* … *\/, incl. JSX {/* … *\/}) and line
 * comments (// …). Conservative: it can over-strip inside string literals that
 * contain "//", but Tailwind class strings don't, so live class usage is intact.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

describe("Global Table Gutter Guard (Mission #059)", () => {
  it("scans a non-trivial number of source files", () => {
    // Sanity: if the walker silently found nothing, the guard would pass
    // vacuously. Lock in that it actually traversed the tree.
    expect(FILES.length).toBeGreaterThan(100);
  });

  it("the table primitive exists and is the gutter owner", () => {
    const prim = PRIMITIVE_ALLOWLIST[0]!;
    const text = readFileSync(join(ROOT, prim), "utf8");
    // The primitive must define the canon symmetric gutter…
    expect(text).toMatch(/first:pl-5/);
    expect(text).toMatch(/last:pr-5/);
    // …and must NOT carry the destructive override anymore.
    expect(text).not.toMatch(/sm:first:pl-1/);
    expect(text).not.toMatch(/sm:last:pr-1/);
    expect(text).not.toMatch(/-mx-\(--gutter\)/);
  });

  for (const { id, re } of FORBIDDEN_PATTERNS) {
    it(`forbids "${id}" outside the table primitive`, () => {
      const offenders: string[] = [];
      for (const rel of FILES) {
        if (isAllowlisted(rel)) continue;
        const text = stripComments(readFileSync(join(ROOT, rel), "utf8"));
        if (re.test(text)) offenders.push(rel);
      }
      expect(
        offenders,
        `"${id}" is a destructive table-gutter pattern. It belongs ONLY to ` +
          `${PRIMITIVE_ALLOWLIST[0]}. Remove it from:\n  ${offenders.join("\n  ")}`,
      ).toEqual([]);
    });
  }

  it("reports table-fixed usage (awareness only, not a failure)", () => {
    const users: string[] = [];
    for (const rel of FILES) {
      const text = readFileSync(join(ROOT, rel), "utf8");
      if (/\btable-fixed\b/.test(text)) users.push(rel);
    }
    // Not asserted as empty — table-fixed is allowed. Surface it so the count
    // is visible in CI output and reviewers can keep it deliberate.
    console.log(`[table-gutter-guard] table-fixed users (${users.length}):`, users);
    expect(Array.isArray(users)).toBe(true);
  });
});
