import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guards the standalone debug canvas HTML: it must be fully self-contained
 * (no external network), carry no guaranteed-yield language, and surface the
 * honesty banners. The HTML mirrors src/lib/products/mining-canvas-model.ts.
 */
const HTML = readFileSync(
  resolve(process.cwd(), "docs/strategy/btc-mining-vault-calculation-canvas.html"),
  "utf8",
);
const lower = HTML.toLowerCase();

describe("btc mining calculation canvas HTML", () => {
  it("has no external network dependency (no URLs, CDN, script src, fetch)", () => {
    expect(lower).not.toContain("http://");
    expect(lower).not.toContain("https://");
    expect(lower).not.toContain("//cdn");
    expect(lower).not.toMatch(/<script\s+src=/);
    expect(lower).not.toMatch(/<link\b[^>]*rel=["']stylesheet/);
    expect(lower).not.toMatch(/\bfetch\s*\(/);
    expect(lower).not.toContain("xmlhttprequest");
    expect(lower).not.toContain("import(");
  });

  it("contains no guaranteed-yield language (only honest 'not guaranteed' disclaimers)", () => {
    expect(lower).not.toMatch(/guaranteed\s+(yield|return|apy|principal)/);
    expect(lower).not.toContain("risk-free");
    expect(lower).not.toContain("will deliver");
    // Every "guarante…" must be a NEGATED disclaimer:
    // "no guarantee" / "not guaranteed" / "not a guarantee".
    const matches = lower.match(/.{0,8}guarante/g) ?? [];
    for (const ctx of matches) {
      expect(ctx, `non-negated guarantee context: "${ctx}"`).toMatch(
        /no(t)?\s(a\s)?guarante/,
      );
    }
    // …and the honest disclaimer is actually present.
    expect(lower).toContain("not guaranteed");
  });

  it("does not present the two target layers as additive (no 8–12% + 20–24%)", () => {
    expect(HTML).not.toMatch(/\d+\s*[–-]\s*\d+%\s*\+\s*\d+\s*[–-]\s*\d+%/);
    expect(lower).toContain("never summed");
  });

  it("surfaces the debug / honesty banners", () => {
    expect(HTML).toContain("Debug canvas — not investor-facing");
    expect(HTML).toContain("CONFIGURED is not VALIDATED");
    expect(lower).toContain("no db writes");
  });

  it("exposes the editable inputs + scenario columns + formula inspector", () => {
    expect(HTML).toContain("Inputs / Assumptions");
    expect(HTML).toContain("Defensive");
    expect(HTML).toContain("Balanced");
    expect(HTML).toContain("Opportunistic");
    expect(HTML).toContain("Formula Inspector");
    expect(HTML).toContain("Construction Steps");
    expect(HTML).toContain("Negative driver");
  });
});
