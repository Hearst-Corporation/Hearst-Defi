import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Shell responsive contract — guards the chat-rail breakpoints that keep the
 * product slot usable on laptop/tablet. Regression cover for the measured bug
 * where the chat stayed visible at exactly 1024px (slot crushed to ~583px) and
 * the user "expanded" mode stayed 480px wide at 1280/1440 (slot ~697px).
 *
 * These are text assertions on cockpit.css (the live shell values). They do not
 * render — they pin the breakpoint contract so a future edit can't silently
 * reopen the slot-crush regressions. Owner rule: at 1024 the cockpit is
 * full-width (chat closed); no chat state crushes the slot on laptop.
 */
const css = readFileSync(join(process.cwd(), "src/app/cockpit.css"), "utf8");

// Strip comments so prose mentioning old thresholds can't satisfy a match.
const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, "");

describe("shell responsive contract — chat rail breakpoints", () => {
  it("hides the chat rail at ≤64rem (1024px included)", () => {
    // The hide threshold must INCLUDE 1024px (64rem). The old ≤63.999rem let
    // 1024 through, leaving the chat visible and the slot at ~583px.
    expect(cssNoComments).toMatch(
      /@media\s*\(max-width:\s*64rem\)\s*\{\s*\.ct-rail-right\s*\{\s*display:\s*none\s*!important/,
    );
    // The old off-by-one threshold must be gone.
    expect(cssNoComments).not.toMatch(
      /@media\s*\(max-width:\s*63\.999rem\)\s*\{\s*\.ct-rail-right\s*\{\s*display:\s*none/,
    );
  });

  it("caps user-expanded chat to the open width on laptop tiers (no slot crush)", () => {
    // On the two laptop tiers, --ct-rail-right-expanded must equal --ct-rail-right
    // so toggling expanded cannot crush the product slot below the cockpit floor.
    // Tier 1201–1440px: both 24rem.
    expect(cssNoComments).toMatch(
      /@media\s*\(max-width:\s*90rem\)\s*and\s*\(min-width:\s*75\.0625rem\)\s*\{[^}]*--ct-rail-right:\s*24rem;[^}]*--ct-rail-right-expanded:\s*24rem;/,
    );
    // Tier 1024.01–1199px: both 20rem.
    expect(cssNoComments).toMatch(
      /@media\s*\(max-width:\s*74\.999rem\)\s*and\s*\(min-width:\s*64\.001rem\)\s*\{[^}]*--ct-rail-right:\s*20rem;[^}]*--ct-rail-right-expanded:\s*20rem;/,
    );
  });

  it("keeps the centre panel free to shrink (min-width:0, no fixed floor)", () => {
    // The slot must be allowed to shrink; a reintroduced min-width floor would
    // force horizontal overflow when the chat is open on a narrow viewport.
    expect(cssNoComments).toMatch(
      /\.ct-center-panel\s*\{[^}]*min-width:\s*0\s*!important/,
    );
  });
});
