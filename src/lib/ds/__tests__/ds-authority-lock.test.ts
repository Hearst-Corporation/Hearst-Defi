import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * DS Authority Lock — Mission #037.
 *
 * Locks the Design System component-authority decision into the repo so future
 * agents cannot drift:
 *
 *   - Catalyst (`src/components/catalyst/`) is the canonical UI component layer.
 *   - Cockpit (`cockpit-shell/`) is shell + layout + `--ct-*` tokens.
 *   - `src/components/ui/` is the legacy / deprecated layer being migrated away.
 *
 * This is a documentation/authority guard, NOT a hardcode scanner — that job
 * belongs to `scripts/ds-hardcode-guard.mjs` (`pnpm ds:guard`).
 */

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(join(ROOT, rel), "utf8");

// Forbidden reversals of the owner decision. Future agents must never assert
// these as the direction. Allowed ONLY inside a section explicitly framed as a
// forbidden anti-pattern (we strip such fenced/quoted negations before scanning).
const FORBIDDEN_REVERSALS = [
  /Catalyst is the intruder/i,
  /migrate away from Catalyst/i,
  /remove Catalyst/i,
  /delete Catalyst/i,
  /src\/components\/ui is the (?:DS|design system) (?:canon|authority)/i,
];

// Docs / rules that future agents read for DS direction. Each must NOT contain a
// forbidden reversal (outside an explicit "do not say this" anti-pattern frame).
const AUTHORITY_SURFACES = [
  "README_DESIGN_SYSTEM.md",
  "src/components/catalyst/README.md",
  "src/components/ui/README.md",
  "docs/CATALYST_CANON_REFERENCE.md",
  "docs/DS_SINGLE_SOURCE_OF_TRUTH.md",
  ".cursor/rules/design-system.mdc",
];

/**
 * Strip lines that explicitly forbid a phrase (anti-pattern framing) so we only
 * catch a reversal that is asserted AS the direction. A line is treated as an
 * anti-pattern frame when it carries a negation cue near the phrase.
 */
function stripAntiPatternFrames(text: string): string {
  return text
    .split("\n")
    .filter((line) => {
      const negated =
        /\bdo not\b|\bdon't\b|\bnever\b|\bforbidden\b|\bmust not\b|\bnot\b.*\bintruder\b|not because/i.test(
          line,
        );
      return !negated;
    })
    .join("\n");
}

describe("DS authority lock — layer READMEs exist", () => {
  it("ships a root DS authority README", () => {
    expect(existsSync(join(ROOT, "README_DESIGN_SYSTEM.md"))).toBe(true);
  });

  it("ships a Catalyst canonical-layer README", () => {
    expect(existsSync(join(ROOT, "src/components/catalyst/README.md"))).toBe(
      true,
    );
  });

  it("ships a legacy UI deprecation README", () => {
    expect(existsSync(join(ROOT, "src/components/ui/README.md"))).toBe(true);
  });
});

describe("DS authority lock — root README states the canonical decision", () => {
  const md = read("README_DESIGN_SYSTEM.md");

  it("declares migration toward Catalyst", () => {
    expect(md).toMatch(/migrates? toward Catalyst/i);
  });

  it("names the canonical Catalyst layer", () => {
    expect(md).toContain("src/components/catalyst");
  });

  it("names the legacy UI layer as deprecated", () => {
    expect(md).toContain("src/components/ui");
    expect(md.toLowerCase()).toContain("deprecated");
  });

  it("keeps cockpit-shell as shell + tokens", () => {
    expect(md).toContain("cockpit-shell");
    expect(md).toMatch(/--ct-\*/);
  });
});

describe("DS authority lock — Catalyst README marks the canonical layer", () => {
  const md = read("src/components/catalyst/README.md");

  it("declares itself the canonical UI component layer", () => {
    expect(md.toLowerCase()).toContain("canonical ui component layer");
  });

  it("requires cockpit token branding", () => {
    expect(md).toContain("--ct-accent");
  });
});

describe("DS authority lock — legacy UI README marks deprecation", () => {
  const md = read("src/components/ui/README.md");

  it("declares the folder deprecated and not the authority", () => {
    expect(md.toLowerCase()).toContain("deprecated");
    expect(md.toLowerCase()).toContain("not the design system authority");
  });

  it("forbids new visual primitives", () => {
    expect(md.toLowerCase()).toMatch(
      /do not add new visual primitives/,
    );
  });
});

describe("DS authority lock — no doc/rule reverses the decision", () => {
  for (const rel of AUTHORITY_SURFACES) {
    it(`${rel} contains no forbidden reversal of the Catalyst decision`, () => {
      const scanned = stripAntiPatternFrames(read(rel));
      for (const pattern of FORBIDDEN_REVERSALS) {
        expect(
          pattern.test(scanned),
          `Forbidden reversal "${pattern.source}" found in ${rel}`,
        ).toBe(false);
      }
    });
  }
});
