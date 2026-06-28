import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Typography canon contract — the 7 roles extracted from /admin/customers +
 * portfolio, centralized in doc-flow-typography.css. Guards that:
 *  - every canon role class exists (token-based);
 *  - the canon page uses the role classes, not detoured micro-labels or inline
 *    `text-[Npx]` / `tracking-[0.15em]` for section titles / captions / metrics.
 *
 * Text assertions on source (same approach as the shell/responsive contracts).
 */
const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
const typo = read("src/app/doc-flow-typography.css");
const page = read("src/app/admin/customers/page.tsx");
const kpiPanel = read(
  "src/components/admin/dashboard/admin-kpi-strip-panel.tsx",
);

describe("typography canon — role classes exist (token-based)", () => {
  const roles = [
    ".ct-section-title",
    ".ct-panel-title",
    ".ct-metric-value",
    ".ct-metric-caption",
  ];
  for (const role of roles) {
    it(`defines ${role} with --ct-* tokens only`, () => {
      // The selector exists…
      const re = new RegExp(`\\${role}\\s*\\{[^}]*\\}`);
      const block = typo.match(re)?.[0] ?? "";
      expect(block, `${role} not found`).not.toBe("");
      // …and its font-size is a token, not a raw px.
      expect(block).toMatch(/font-size:\s*var\(--ct-text-/);
      expect(block).not.toMatch(/font-size:\s*\d+px/);
    });
  }

  it("keeps the existing canon roles (.h1 / .h1-accent / .page-canon-kicker)", () => {
    expect(typo).toMatch(/\.h1\s*\{[^}]*var\(--ct-text-3xl-fixed\)/);
    expect(typo).toMatch(/\.h1\s+\.h1-accent\s*\{[^}]*var\(--ct-accent\)/);
    expect(typo).toMatch(/\.page-canon-kicker\s*\{[^}]*var\(--ct-text-nano\)/);
  });
});

describe("typography canon — canon page uses role classes, not inline type", () => {
  it("section titles use .ct-section-title (not a detoured ct-bento-label)", () => {
    expect(page).toMatch(/className="ct-section-title"/);
    expect(kpiPanel).toMatch(/className="ct-section-title"/);
    // No <h2> styled as the nano micro-label anymore.
    expect(page).not.toMatch(/<h2 className="ct-bento-label/);
    expect(kpiPanel).not.toMatch(/<h2 className="ct-bento-label/);
  });

  it("captions use .ct-metric-caption (no inline text-[12px] for sub-lines)", () => {
    expect(page).toMatch(/className="ct-metric-caption/);
    expect(page).not.toMatch(/text-\[12px\]/);
    expect(kpiPanel).not.toMatch(/text-\[12px\]/);
  });

  it("the principal figure uses .ct-metric-value", () => {
    expect(page).toMatch(/className="ct-metric-value/);
  });

  it("no tracking-[0.15em] inline anywhere in the canon page/panel", () => {
    expect(page).not.toMatch(/tracking-\[0\.15em\]/);
    expect(kpiPanel).not.toMatch(/tracking-\[0\.15em\]/);
  });
});
