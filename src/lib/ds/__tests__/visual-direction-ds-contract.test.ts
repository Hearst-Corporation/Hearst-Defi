import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Visual Direction DS Contract — PROMPT #072 (Archive 4).
 *
 * The Nav / Vault Details / Invest redesign is built entirely on the DS canon
 * (Catalyst atoms + HIS charts + `--ct-*` tokens). This guard freezes that: the
 * redesign surfaces may never re-introduce the visual anti-patterns the direction
 * bans — raw hex colours, `text-white` / `text-zinc-*`, `border-white/N`, or
 * `dark:` modifiers (the app is dark-only; colour comes from tokens).
 *
 * Scope is the redesign surfaces only (nav, held-vaults index, the Vault Details
 * page, the invest-flow + portfolio components, and the three new primitives).
 * It does NOT scan the whole tree — legacy surfaces are cleaned by their own
 * passes. Comments are stripped so prose documenting a forbidden pattern is not
 * flagged. Data-viz series hexes are irrelevant here (the primitives consume
 * `--ct-chart-*` / `--ct-cat-*` tokens, never inline hex).
 */

const ROOT = process.cwd();

// Directories whose every source file must stay token-clean.
const SCOPE_DIRS = [
  "src/components/nav",
  "src/components/portfolio",
  "src/components/vaults",
  "src/app/(product)/my-vaults",
  "src/app/(product)/portfolio/[positionId]",
];

// Individual new primitives (their directories also hold unrelated files).
const SCOPE_FILES = [
  "src/components/catalyst/accordion.tsx",
  "src/components/catalyst/step-timeline.tsx",
  "src/components/catalyst/chart-donut.tsx",
  "src/components/catalyst/chart-proportion-bar.tsx",
];

const EXT = /\.(tsx?|jsx?)$/;
const SKIP_SEGMENTS = new Set(["__tests__", "node_modules", ".next"]);

const FORBIDDEN: { id: string; re: RegExp }[] = [
  { id: "bg-[#hex]", re: /bg-\[#[0-9a-fA-F]/ },
  { id: "text-[#hex]", re: /text-\[#[0-9a-fA-F]/ },
  { id: "border-[#hex]", re: /border-\[#[0-9a-fA-F]/ },
  { id: "text-white", re: /\btext-white\b/ },
  { id: "text-zinc-*", re: /\btext-zinc-/ },
  { id: "border-white/N", re: /border-white\/[0-9]/ },
  { id: "dark: modifier", re: /\bdark:/ },
];

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

const FILES = [
  ...SCOPE_DIRS.flatMap((d) => walk(join(ROOT, d))),
  ...SCOPE_FILES,
];

/** Strip block + line comments so documentation of a pattern is not flagged. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

describe("Visual Direction DS Contract (PROMPT #072)", () => {
  it("scans a non-trivial number of redesign files", () => {
    expect(FILES.length).toBeGreaterThan(20);
  });

  for (const { id, re } of FORBIDDEN) {
    it(`forbids "${id}" across the redesign surfaces`, () => {
      const offenders: string[] = [];
      for (const rel of FILES) {
        let text: string;
        try {
          text = stripComments(readFileSync(join(ROOT, rel), "utf8"));
        } catch {
          continue;
        }
        if (re.test(text)) offenders.push(rel);
      }
      expect(
        offenders,
        `"${id}" is a banned visual anti-pattern on the Visual Direction 2026 ` +
          `surfaces. Use --ct-* tokens instead. Offenders:\n  ${offenders.join("\n  ")}`,
      ).toEqual([]);
    });
  }

  it("the new DS primitives exist and are token-driven", () => {
    const accordion = readFileSync(
      join(ROOT, "src/components/catalyst/accordion.tsx"),
      "utf8",
    );
    expect(accordion).toMatch(/AccordionCard/);
    expect(accordion).toMatch(/aria-expanded/);

    const timeline = readFileSync(
      join(ROOT, "src/components/catalyst/step-timeline.tsx"),
      "utf8",
    );
    expect(timeline).toMatch(/StepTimeline/);

    // Canonical Recharts allocation bar (replaced the retired HIS HcBarChart /
    // HcStackedBar): its honest empty state renders a neutral track, never a
    // fabricated fill.
    const proportionBar = readFileSync(
      join(ROOT, "src/components/catalyst/chart-proportion-bar.tsx"),
      "utf8",
    );
    expect(proportionBar).toMatch(/data-chart-empty/); // honest empty state
  });

  it("the categorical palette is declared as token aliases (no new hex, one green)", () => {
    const cockpit = readFileSync(join(ROOT, "src/app/cockpit.css"), "utf8");
    expect(cockpit).toMatch(/--ct-cat-mining:\s*var\(--ct-accent\)/);
    expect(cockpit).toMatch(/--ct-cat-usdc:\s*var\(--ct-status-info\)/);
    expect(cockpit).toMatch(/--ct-cat-btc:\s*var\(--ct-status-warning\)/);
    // No raw hex assigned to a --ct-cat-* token.
    expect(cockpit).not.toMatch(/--ct-cat-[a-z]+:\s*#/);
  });

  it("the investor rail has no standalone Invest/Holdings entry", () => {
    // The investor rail now lives in Series1Nav (PRODUCT_NAV was deleted with
    // product-rail-intra): five surfaces, folded routes are redirects.
    const nav = readFileSync(
      join(ROOT, "src/components/series1-shell/Series1Nav.tsx"),
      "utf8",
    );
    expect(nav).not.toMatch(/id:\s*"invest"/);
    expect(nav).not.toMatch(/id:\s*"holdings"/);
    expect(nav).toMatch(/id:\s*"overview"/);
    expect(nav).toMatch(/id:\s*"vaults"/);
    expect(nav).toMatch(/id:\s*"portfolio"/);
    expect(nav).toMatch(/id:\s*"proof-center"/);
    expect(nav).toMatch(/id:\s*"documents-kyc"/);
    // Folded destinations must not resurface as rail entries.
    expect(nav).not.toMatch(/href:\s*"\/btc"/);
    expect(nav).not.toMatch(/href:\s*"\/mining"/);
    expect(nav).not.toMatch(/href:\s*"\/my-vaults"/);
  });
});
