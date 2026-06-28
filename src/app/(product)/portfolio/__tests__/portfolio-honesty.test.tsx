import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// The portfolio route page imports catalyst client components. We never RENDER
// them (no DOM needed) — we only call the page function to obtain its element
// tree and walk the string leaves. Defensive mocks for the RSC runtime guards in
// case a transitively-imported module pulls them in.
vi.mock("server-only", () => ({}));
vi.mock("client-only", () => ({}));

import PortfolioPage from "../page";

/** Collect every string / number leaf in a React element tree (no rendering). */
function collectText(node: ReactNode, acc: string[]): void {
  if (node === null || node === undefined || typeof node === "boolean") return;
  if (typeof node === "string" || typeof node === "number") {
    acc.push(String(node));
    return;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectText(child, acc);
    return;
  }
  if (typeof node === "object" && "props" in node) {
    collectText(
      (node as { props?: { children?: ReactNode } }).props?.children,
      acc,
    );
  }
}

function portfolioText(): string {
  const acc: string[] = [];
  collectText(PortfolioPage(), acc);
  return acc.join(" ");
}

/**
 * Product-honesty guard for the primary investor surface.
 *
 * /portfolio currently renders illustrative placeholder figures (e.g. $509,800).
 * It must NOT present those fixtures as a live position feed. Until the real
 * loader is wired, a visible "Demo data" disclaimer is mandatory and the headline
 * must not claim a "Live Portfolio Value".
 */
describe("portfolio page — product honesty", () => {
  it("shows a visible demo-data disclaimer (fixtures are not presented as live)", () => {
    expect(portfolioText().toLowerCase()).toContain("demo data");
  });

  it("does not headline the fixture figure as a 'Live Portfolio Value'", () => {
    expect(portfolioText()).not.toContain("Live Portfolio Value");
  });

  it("does not ship placeholder href=\"#\" CTAs (unwired leaf pages stay unreachable)", () => {
    const html = renderToStaticMarkup(PortfolioPage());
    expect(html).not.toContain('href="#"');
  });
});
