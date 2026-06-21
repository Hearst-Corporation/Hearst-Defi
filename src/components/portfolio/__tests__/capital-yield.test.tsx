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
    expect(html).toContain("Indicative target APY band");
    expect(html).toContain("9.0");
    expect(html).toContain("Allocation activates after your first confirmed on-chain position");
    expect(html).not.toMatch(/\bcy-panel\b/);
    expect(html).not.toContain("<svg");
  });

  it("full empty state shows a clean empty panel — no ghost donut/ledger conflicting with the awaiting message", () => {
    const html = renderToStaticMarkup(
      <CapitalYield {...EMPTY_PROPS} leafHref="/portfolio/yield" />,
    );

    expect(html).toContain("cy-panel--onboarding-empty");
    expect(html).toContain("Indicative target APY band");
    expect(html).toContain("Live allocation unlocks after your first confirmed on-chain position");
    // No faux allocation chart next to "no data yet" (two conflicting signals).
    expect(html).not.toContain("<svg");
    expect(html).not.toContain("Awaiting snapshot");
    expect(html).not.toContain("cy-row--pending");
  });
});
