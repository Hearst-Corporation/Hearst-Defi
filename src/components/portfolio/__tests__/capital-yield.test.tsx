import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CapitalYield, type CapitalYieldProps } from "@/components/portfolio/capital-yield";

const EMPTY_PROPS: CapitalYieldProps = {
  sources: [],
  blendedLow: 0,
  blendedHigh: 0,
  stressedBearRange: { low: 0, high: 0 },
  buckets: [],
  totalValueUsdc: 0,
};

describe("CapitalYield empty states", () => {
  it("embedded empty state renders a compact summary without the ghost chart svg", () => {
    const html = renderToStaticMarkup(
      <CapitalYield {...EMPTY_PROPS} embedded leafHref="/portfolio/yield" />,
    );

    expect(html).toContain("pf-capital-yield--embedded-empty");
    expect(html).toContain("Target APY band");
    expect(html).toContain("9.0");
    expect(html).toContain("Allocation activates after first confirmed position");
    expect(html).not.toMatch(/\bcy-panel\b/);
    expect(html).not.toContain("<svg");
  });

  it("full empty state still renders the preview chart for the dedicated panel", () => {
    const html = renderToStaticMarkup(
      <CapitalYield {...EMPTY_PROPS} leafHref="/portfolio/yield" />,
    );

    expect(html).toContain("cy-panel--onboarding-empty");
    expect(html).toContain("Awaiting snapshot");
    expect(html).toContain("<svg");
    expect(html).toContain("Indicative yield structure");
  });
});
