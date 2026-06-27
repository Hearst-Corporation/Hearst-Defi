import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const portalHost = {
  setAttribute: vi.fn(),
  appendChild: vi.fn(),
  removeChild: vi.fn(),
};

vi.stubGlobal("document", {
  createElement: () => portalHost,
  body: portalHost,
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/portfolio",
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useSyncExternalStore: (
      _subscribe: () => () => void,
      getSnapshot: () => unknown,
    ) => getSnapshot(),
  };
});

vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return {
    ...actual,
    createPortal: (node: React.ReactNode) => node,
  };
});

import { AdminRailIntra, InvestorRailIntra } from "@/components/nav/product-rail-intra";

const source = readFileSync(
  join(process.cwd(), "src/components/nav/product-rail-intra.tsx"),
  "utf8",
);

describe("Product rail intra (fixed column)", () => {
  it("source no longer ships collapse toggle or expanded rail state", () => {
    expect(source).not.toContain("RailToggle");
    expect(source).not.toContain("useRailExpanded");
    expect(source).not.toContain("railExpandedState");
    expect(source).not.toContain("ChevronLeft");
    expect(source).not.toContain("ChevronRight");
    expect(source).not.toContain("dataset.railMode");
    expect(source).not.toContain("ct-rail-toggle");
  });

  it("InvestorRailIntra renders nav items without collapse control", () => {
    const html = renderToStaticMarkup(<InvestorRailIntra />);

    expect(html).toContain('data-testid="investor-rail-intra"');
    // Positional shell hooks kept; nav items are bento Tailwind now.
    expect(html).toContain("ct-rail-intra");
    expect(html).toContain("ct-rail-intra__stack");
    expect(html).toContain('aria-label="Portfolio"');
    expect(html).toContain('aria-label="Vaults"');
    expect(html).not.toContain("ct-rail-item");
    expect(html).not.toContain("ct-rail-toggle");
    expect(html).not.toContain("Collapse navigation");
    expect(html).not.toContain("Expand navigation");
  });

  it("AdminRailIntra renders nav items without collapse control", () => {
    const html = renderToStaticMarkup(<AdminRailIntra />);

    expect(html).toContain('data-testid="admin-rail-intra"');
    expect(html).toContain("ct-rail-intra");
    expect(html).toContain("ct-rail-intra__stack");
    // Bento nav items rendered (at least one admin section link).
    expect(html).toMatch(/aria-label="[^"]+"/);
    expect(html).not.toContain("ct-rail-item");
    expect(html).not.toContain("ct-rail-toggle");
    expect(html).not.toContain("Collapse navigation");
  });

  it("cockpit.css vertically centres the menu stack in the rail column", () => {
    const css = readFileSync(join(process.cwd(), "src/app/cockpit.css"), "utf8");
    const start = css.indexOf(".ct-rail-intra__stack {", css.indexOf(".ct-rail-intra {"));
    expect(start).toBeGreaterThanOrEqual(0);
    const brace = css.indexOf("{", start);
    const end = css.indexOf("}", brace);
    const rule = css.slice(brace + 1, end);
    expect(rule).toContain("justify-content: center");
    expect(rule).toContain("flex: 1");
  });
});
