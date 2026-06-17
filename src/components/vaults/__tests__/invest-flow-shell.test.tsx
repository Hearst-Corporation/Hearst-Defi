import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { InvestFlowShell } from "@/components/vaults/invest-flow-shell";

describe("InvestFlowShell width", () => {
  it("uses Invest eyebrow without duplicating step index (stepper owns progress)", () => {
    const html = renderToStaticMarkup(
      <InvestFlowShell step="product" title="Test">
        <p>body</p>
      </InvestFlowShell>,
    );
    expect(html).toContain('<p class="eyebrow">Invest</p>');
    expect(html).not.toContain("Invest · Step");
    expect(html).toContain("wizard-step-progress");
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
  });
});
