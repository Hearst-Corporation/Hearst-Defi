import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Admin SOURCE page DS contract (Mission #067).
 *
 * The /admin/source frame was already canon (AdminPageShell), but its BODY had
 * drifted into a local cockpit/custom system: ct-glass-panel via BentoPanel,
 * hand-rolled tinted status spans, custom <a>/<button> filters, a raw 11-column
 * <table> with inline background-color on the cooling dots, and a `stat-value`
 * APY grid. Mission #067 re-wires the body onto DS primitives (Catalyst Card /
 * Badge / SegmentedControl / Table).
 *
 * This guard freezes that decision so a future edit can't silently regress the
 * page back to a custom visual system. Mechanism: substring assertions on the
 * three source files — the same robust approach the other DS guards use
 * (ds-authority-lock, admin-visual-frame). No AST coupling.
 */

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(join(ROOT, rel), "utf8");

const PAGE = "src/app/admin/source/page.tsx";
const TABLE = "src/components/admin/source/machine-table.tsx";
const DEST_FILTER = "src/components/admin/source/destination-filter.tsx";

const SOURCE_FILES = [PAGE, TABLE, DEST_FILTER] as const;

// Non-DS patterns that must NOT reappear anywhere in the source page surfaces.
// Each is a literal the old custom system used; the DS primitives replace them.
const FORBIDDEN: ReadonlyArray<{ pattern: RegExp; why: string }> = [
  { pattern: /ct-glass-panel/, why: "raw glass class — use the Card primitive" },
  { pattern: /BentoPanel/, why: "Bento panel — use the Card primitive" },
  { pattern: /\bstat-value\b/, why: "legacy stat-value — use ct-metric-value / DS Card" },
  {
    pattern: /style\s*=\s*\{?\{?\s*backgroundColor/i,
    why: "inline background-color — use Badge / token classes",
  },
  { pattern: /style\s*=\s*["']?\s*background-color/i, why: "inline background-color" },
  { pattern: /\btext-zinc-/, why: "hardcoded zinc text — use --ct-* tokens" },
  { pattern: /\btext-white\b/, why: "hardcoded white — use --ct-* tokens" },
  { pattern: /\bborder-white\//, why: "hardcoded white border — use --ct-* tokens" },
  { pattern: /\bbg-black\b/, why: "hardcoded black — use --ct-* tokens" },
  { pattern: /bg-\[#/, why: "arbitrary hex background — use --ct-* tokens" },
  { pattern: /#A7FB90/i, why: "inline accent hex — use var(--ct-accent)" },
  {
    pattern: /<table[\s>]/,
    why: "raw <table> — use the Catalyst Table primitive",
  },
];

describe("admin source — no residual custom/non-DS patterns", () => {
  for (const rel of SOURCE_FILES) {
    describe(rel, () => {
      const src = read(rel);
      for (const { pattern, why } of FORBIDDEN) {
        it(`does not contain ${pattern} (${why})`, () => {
          expect(src).not.toMatch(pattern);
        });
      }
    });
  }
});

describe("admin source — wired to DS primitives", () => {
  it("the page uses AdminSectionCard (canon section) and the DS Card", () => {
    const page = read(PAGE);
    expect(page).toContain("AdminSectionCard");
    expect(page).toContain('from "@/components/catalyst/card"');
    expect(page).toContain("<Card");
  });

  it("pipeline brick status uses the DS Badge, not a hand-rolled span", () => {
    const page = read(PAGE);
    expect(page).toContain('from "@/components/catalyst/badge"');
    expect(page).toContain("<Badge");
  });

  it("the machines table is the Catalyst Table primitive", () => {
    const table = read(TABLE);
    expect(table).toContain('from "@/components/catalyst/table"');
    for (const sym of ["Table", "TableHead", "TableBody", "TableRow", "TableHeader", "TableCell"]) {
      expect(table).toContain(sym);
    }
    // The table is wrapped in the canon local-scroll surface (no global overflow).
    expect(read(PAGE)).toContain("AdminTableSurface");
  });

  it("cooling status uses the DS Badge, not an inline-coloured dot", () => {
    const table = read(TABLE);
    expect(table).toContain('from "@/components/catalyst/badge"');
    expect(table).toContain("<Badge");
  });

  it("the cooling + destination filters use the DS SegmentedControl", () => {
    const table = read(TABLE);
    const dest = read(DEST_FILTER);
    expect(table).toContain('from "@/components/catalyst/segmented-control"');
    expect(table).toContain("<SegmentedControl");
    expect(dest).toContain('from "@/components/catalyst/segmented-control"');
    expect(dest).toContain("<SegmentedControl");
  });
});
