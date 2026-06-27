import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { InvestFlowShell } from "@/components/vaults/invest-flow-shell";

describe("InvestFlowShell width", () => {
  it("uses the canon kicker without duplicating step index (stepper owns progress)", () => {
    const html = renderToStaticMarkup(
      <InvestFlowShell step="product" title="Test">
        <p>body</p>
      </InvestFlowShell>,
    );
    // Bento kicker (Portfolio canon) carries the context label; the stepper
    // owns progress so the index is never duplicated in the eyebrow.
    expect(html).toContain("Investment Flow");
    expect(html).not.toContain("Invest · Step");
    expect(html).toContain('role="progressbar"');
  });

  it("defaults to cap max-width", () => {
    const html = renderToStaticMarkup(
      <InvestFlowShell step="select" title="Test">
        <p>body</p>
      </InvestFlowShell>,
    );
    expect(html).toContain("product-doc-shell--cap");
    expect(html).not.toContain("product-doc-shell--narrow");
  });

  it("applies narrow max-width without cap when width=narrow", () => {
    const html = renderToStaticMarkup(
      <InvestFlowShell step="confirmed" title="Test" width="narrow">
        <p>body</p>
      </InvestFlowShell>,
    );
    expect(html).toContain("product-doc-shell--narrow");
    expect(html).not.toContain("product-doc-shell--cap");
  });

  it("omits width modifiers when width=full", () => {
    const html = renderToStaticMarkup(
      <InvestFlowShell step="product" title="Test" width="full">
        <p>body</p>
      </InvestFlowShell>,
    );
    expect(html).not.toContain("product-doc-shell--cap");
    expect(html).not.toContain("product-doc-shell--narrow");
    expect(html).toContain("invest-flow-shell");
    expect(html).toContain("invest-flow-shell__body");
  });

  it("applies workspace class when workspace prop is set", () => {
    const html = renderToStaticMarkup(
      <InvestFlowShell step="product" title="Test" workspace>
        <p>body</p>
      </InvestFlowShell>,
    );

    expect(html).toContain("invest-flow-shell--workspace");
  });

  it("does not apply workspace class by default", () => {
    const html = renderToStaticMarkup(
      <InvestFlowShell step="product" title="Test">
        <p>body</p>
      </InvestFlowShell>,
    );

    expect(html).not.toContain("invest-flow-shell--workspace");
  });
});
