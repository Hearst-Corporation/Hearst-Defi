import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Left rail DESIGN-SYSTEM guard (Mission #060).
 *
 * The launcher rail (cockpit-shell/src/shell/RailLeft.tsx + the .ct-rail-*
 * styling in cockpit-shell/tokens.css) had drifted off the DS: hardcoded
 * surface/ring hex, zinc text, white borders, a `hover:text-white`, and an
 * inline per-product `--p-color` that drove a weak text-only "active" state.
 *
 * This guard locks the rail to tokens and to a real, accessible selected state:
 *   - no hardcoded colours in the rail files;
 *   - the selected item is FULL ACCENT GREEN with a bg-deep (black) foreground;
 *   - the selected item is marked with aria-current / data-active (not a bare class);
 *   - focus is tokenized.
 *
 * Mechanism: substring/regex assertions on source — the same robust approach as
 * the other DS guards (ds-authority-lock, admin-visual-frame, bento-ds-contract).
 */

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(join(ROOT, rel), "utf8");

const RAIL_TSX = "cockpit-shell/src/shell/RailLeft.tsx";
const RAIL_CSS = "cockpit-shell/tokens.css";
// The rail base styling lives in tokens.css (@layer cockpit); the AUTHORITATIVE
// selected-state override lives in cockpit.css (NON-layered), because a layered
// rule is beaten by the non-layered button reset — so the active green must be
// asserted there too, or the selected item silently loses its background.
const COCKPIT_CSS = "src/app/cockpit.css";

/** The .ct-rail-* slice of tokens.css — keep assertions scoped to the rail. */
function railCssSlice(): string {
  const css = read(RAIL_CSS);
  const start = css.indexOf(".ct-rail-top");
  const end = css.indexOf("/* ── CHAT");
  return start >= 0 && end > start ? css.slice(start, end) : css;
}

const FORBIDDEN: ReadonlyArray<[RegExp, string]> = [
  [/bg-\[#15191C\]/i, "bg-[#15191C] (use bg-[var(--ct-surface-card)])"],
  [/ring-\[#0B0E10\]/i, "ring-[#0B0E10] (use ring-[var(--ct-bg-deep)])"],
  [/text-zinc-/i, "text-zinc-* (use text-[var(--ct-text-*)])"],
  [/border-white\//i, "border-white/* (use border-[var(--ct-border-soft)])"],
  [/hover:text-white\b/i, "hover:text-white (use hover:text-[var(--ct-text-strong)])"],
  [/--p-color\s*:\s*#?A7FB90/i, "--p-color:#A7FB90 inline (active state must use var(--ct-accent))"],
];

describe("left rail — no hardcoded colours", () => {
  it("RailLeft.tsx markup is free of the forbidden hardcoded classes", () => {
    const src = read(RAIL_TSX);
    for (const [re, why] of FORBIDDEN) {
      expect(re.test(src), `RailLeft.tsx must not contain ${why}`).toBe(false);
    }
  });

  it("the rail stylesheet no longer drives colour from an inline --p-color", () => {
    expect(railCssSlice()).not.toMatch(/var\(--p-color\)/);
  });

  it("the rail markup no longer injects an inline --p-color style", () => {
    expect(read(RAIL_TSX)).not.toMatch(/--p-color/);
  });
});

describe("left rail — selected item is full accent green, black foreground", () => {
  const css = railCssSlice();

  it("the active row uses var(--ct-accent) as its background", () => {
    // The .active / [data-active] / [aria-current] rule must set the accent bg.
    expect(css).toMatch(/\.ct-rail-row(\.active|\[data-active="true"\]|\[aria-current="page"\])[\s\S]{0,200}background:\s*var\(--ct-accent\)/);
  });

  it("the AUTHORITATIVE active state lives non-layered in cockpit.css (so it actually wins)", () => {
    const cockpit = read(COCKPIT_CSS);
    expect(cockpit).toMatch(/\.ct-rail-row(\.active|\[data-active="true"\]|\[aria-current="page"\])[\s\S]{0,240}background:\s*var\(--ct-accent\)[\s\S]{0,160}color:\s*var\(--ct-bg-deep\)/);
  });

  it("the active row foreground is var(--ct-bg-deep) (black on green)", () => {
    expect(css).toMatch(/background:\s*var\(--ct-accent\)[\s\S]{0,160}color:\s*var\(--ct-bg-deep\)/);
  });

  it("the active row is weight 700", () => {
    expect(css).toMatch(/background:\s*var\(--ct-accent\)[\s\S]{0,200}font-weight:\s*700/);
  });

  it("the count/badge is tokenized inside the item (bg-deep chip on the active row)", () => {
    expect(css).toMatch(/\.ct-rail-row-tag/);
    expect(css).toMatch(/\.ct-rail-row(\.active|\[data-active="true"\]|\[aria-current="page"\])\s+\.ct-rail-row-tag[\s\S]{0,200}color:\s*var\(--ct-bg-deep\)/);
  });
});

describe("left rail — accessible selected + focus state", () => {
  it("the selected item is exposed via aria-current / data-active (not a bare class)", () => {
    const src = read(RAIL_TSX);
    expect(src).toMatch(/aria-current=/);
    expect(src).toMatch(/data-active=/);
  });

  it("focus is tokenized (accent outline on keyboard focus)", () => {
    expect(railCssSlice()).toMatch(/:focus-visible[\s\S]{0,120}outline:[^;]*var\(--ct-accent\)/);
  });
});
