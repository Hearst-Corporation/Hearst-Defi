import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FixtureVaultPills } from "@/components/admin/fixture-vault-pills";

const cockpitCss = readFileSync(join(process.cwd(), "src/app/cockpit.css"), "utf8");

function cssRule(css: string, selector: string): string {
  const start = css.indexOf(selector);
  expect(start).toBeGreaterThanOrEqual(0);
  const brace = css.indexOf("{", start);
  const end = css.indexOf("}", brace);
  return css.slice(brace + 1, end);
}

describe("FixtureVaultPills", () => {
  it("cockpit.css styles active vault pill with quiet accent selection", () => {
    const rule = cssRule(cockpitCss, ".fixture-vault-pills__pill--active");
    expect(rule).toContain("color: var(--ct-accent)");
    expect(rule).toContain(
      "background: color-mix(in srgb, var(--ct-accent) 8%, transparent)",
    );
    expect(rule).toContain("border-color: var(--ct-border-accent)");
  });

  it("marks the active vault with aria-current and active modifier class", () => {
    const html = renderToStaticMarkup(
      <FixtureVaultPills
        activeVaultId="yield"
        resolveHref={(id) => `/admin/dashboard?vault=${id}`}
      />,
    );
    expect(html).toContain('aria-label="Vault scope"');
    expect(html).toContain('aria-current="page"');
    expect(html).toMatch(/fixture-vault-pills__pill fixture-vault-pills__pill--active/);
    expect(html).toContain(">HYV<");
  });
});
