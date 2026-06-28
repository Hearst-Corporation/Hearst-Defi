import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * MISSION #029 — Customers responsive + Catalyst DS contract.
 *
 * Regression cover for three measured bugs on /admin/customers with the
 * assistant rail OPEN at a narrow center slot:
 *
 *  1. The Investor Directory table bled UNDER the chat rail: the page forced
 *     `overflow-x-visible!` on the Catalyst <Table>, which has `!important`
 *     priority and DEFEATED Catalyst's own `overflow-x-auto` local-scroll
 *     wrapper → the table's intrinsic width escaped the center slot (measured
 *     +48px past the panel at 1280px). Fix: drop the `overflow-x-visible!`
 *     override and the `bleed` prop so the wrapper clips/scrolls locally.
 *
 *  2. The chat right rail "collapse" leaked: the collapsed 48px handle still
 *     rendered the chat body (`ct-rail-right-body`, scrollWidth 75 > 47) →
 *     squished content bled into the handle. Fix: gate the body render with
 *     `{open && (...)}` in RailRight + hide it in CSS when collapsed.
 *
 *  3. The admin top-right dock (search ⌘K + notifications) was `position:fixed;
 *     right:16px` (VIEWPORT edge) → it overlapped the chat rail header buttons
 *     by ~244px when the rail was open. Fix: inset the dock by the rail's
 *     effective width (`--ct-rail-right-eff`) so it stays in the center slot.
 *
 * Text assertions on the source files (same approach as
 * shell-responsive-contract.test.ts) — they pin the contract so a future edit
 * can't silently reopen any of the three regressions.
 */

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
// Strip block, JSX-block AND line comments so prose mentioning a banned class
// (e.g. "no overflow-x-visible! anymore") can't satisfy/break a match.
const stripComments = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("customers responsive contract — Investor Directory table", () => {
  const page = stripComments(read("src/app/admin/customers/page.tsx"));

  it("never forces overflow-x-visible! on the Catalyst table (it defeats local scroll)", () => {
    expect(page).not.toMatch(/overflow-x-visible!/);
  });

  it("does not use the `bleed` prop (its -mx-(--gutter) pulls the table past the card)", () => {
    // The two list tables must not bleed — they live inside a contained card.
    expect(page).not.toMatch(/<Table\b[^>]*\bbleed\b/);
  });

  it("does not force the inner table to width:full (it fights the min-content scroll)", () => {
    expect(page).not.toMatch(/\[&_table\]:w-full/);
  });
});

describe("chat rail collapse contract — collapse fully closes (no leftover handle)", () => {
  it("CSS hides the whole rail when collapsed (display:none, width:0)", () => {
    const css = stripComments(read("src/app/cockpit.css"));
    expect(css).toMatch(
      /\.ct-rail-right\.collapsed\s*\{[^}]*display:\s*none[^}]*\}/,
    );
  });

  it("CSS zeroes the rail effective width when collapsed (slot + footer reclaim it)", () => {
    const css = stripComments(read("src/app/cockpit.css"));
    expect(css).toMatch(
      /:has\(\.ct-rail-right\.collapsed\)\s*\{[^}]*--ct-rail-right-eff:\s*0px/,
    );
  });

  it("RailRight only renders the body when the rail is open", () => {
    const rail = read("cockpit-shell/src/shell/RailRight.tsx");
    expect(rail).toMatch(
      /\{open\s*&&\s*\([\s\S]*?ct-rail-right-body[\s\S]*?\)\}/,
    );
  });

  it("ships an external open/close control (ChatRailToggle) so there is no in-rail handle", () => {
    const toggle = read("cockpit-shell/src/shell/ChatRailToggle.tsx");
    expect(toggle).toMatch(/Open assistant/);
    expect(toggle).toMatch(/Close assistant/);
    // It must be mounted in the admin dock, next to search + notifications.
    const layout = read("src/app/admin/layout.tsx");
    expect(layout).toMatch(/<ChatRailToggle\s*\/>/);
  });
});

describe("compact footer brand contract — never wraps when chat closed", () => {
  it("brand stays on one line (nowrap) and its column keeps max-content width", () => {
    const css = stripComments(read("src/app/globals.css"));
    expect(css).toMatch(/\.app-footer__brand\s*\{[^}]*white-space:\s*nowrap/);
    expect(css).toMatch(/minmax\(\s*max-content\s*,\s*var\(--ct-rail-right-eff/);
  });
});

describe("admin top dock contract — never overlaps the chat rail", () => {
  it("insets the search/notifications dock by the chat rail effective width", () => {
    const css = stripComments(read("src/app/admin/admin-crm.css"));
    expect(css).toMatch(
      /\.admin-search-dock\s*\{[^}]*right:\s*calc\(\s*var\(--ct-rail-right-eff[^)]*\)\s*\+\s*var\(--ct-space-4\)\s*\)/,
    );
    // The old viewport-anchored value must be gone.
    expect(css).not.toMatch(
      /\.admin-search-dock\s*\{[^}]*right:\s*var\(--ct-space-4\);/,
    );
  });
});
