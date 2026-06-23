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

const VAULT_REFERENCE_PROPS: CapitalYieldProps = {
  sources: [
    { bucket: "mining", label: "Mining cashflow", contributionPct: 8.5 },
    { bucket: "usdc_base", label: "USDC base yield", contributionPct: 3.2 },
  ],
  blendedLow: 9.4,
  blendedHigh: 12.8,
  stressedBearRange: { low: 5.1, high: 7.3 },
  buckets: [
    { bucket: "mining", pct: 62, valueUsdc: 1_550_000 },
    { bucket: "usdc_base", pct: 38, valueUsdc: 950_000 },
  ],
  totalValueUsdc: 0, // no investor position yet
  source: "stale",
};

describe("CapitalYield zero-state (no data) — always renders the donut graphic, unlabelled", () => {
  it("renders the donut SVG even with empty props (illustrative fallback)", () => {
    const html = renderToStaticMarkup(
      <CapitalYield {...EMPTY_PROPS} embedded leafHref="/portfolio/yield" />,
    );

    // The graphic form is always present
    expect(html).toContain("<svg");
    expect(html).toContain("dash-chart-svg");
  });

  it("shows NO indicative/estimated label in zero-state", () => {
    const html = renderToStaticMarkup(
      <CapitalYield {...EMPTY_PROPS} embedded leafHref="/portfolio/yield" />,
    );

    expect(html).not.toContain("Estimated");
    expect(html).not.toContain("Vault mix");
    expect(html).not.toContain("Vault target allocation");
    expect(html).not.toContain("Indicative target APY band");
    expect(html).not.toContain("not guaranteed");
  });

  it("never shows $0 Capital in the donut centre when there is no position", () => {
    const html = renderToStaticMarkup(<CapitalYield {...EMPTY_PROPS} />);
    expect(html).not.toContain("$0");
  });
});

describe("CapitalYield live state (real data + investor position)", () => {
  it("renders the donut, the live subtitle, the provenance badge and the disclaimer", () => {
    const html = renderToStaticMarkup(
      <CapitalYield {...VAULT_REFERENCE_PROPS} totalValueUsdc={500_000} source="live" />,
    );

    expect(html).toContain("<svg");
    expect(html).toContain("Allocation · 12m forward yield");
    expect(html).toContain("Capital");
    expect(html).toContain("not guaranteed");
  });
});

describe("CapitalYield funded position but no allocation snapshot (the live-state bug)", () => {
  // Position funded ($11) but the vault snapshot is cold → sources/buckets empty,
  // blendedLow/High grafted from the position range (8–15%). The donut centre must
  // show the deployed capital (NOT "Pending") and the hero a reference range (NOT "—").
  const FUNDED_NO_SNAPSHOT: CapitalYieldProps = {
    sources: [],
    blendedLow: 8,
    blendedHigh: 15,
    stressedBearRange: { low: 0, high: 0 },
    buckets: [],
    totalValueUsdc: 11,
    source: "estimated",
  };

  it("shows deployed capital in the donut centre, never 'Pending'", () => {
    const html = renderToStaticMarkup(<CapitalYield {...FUNDED_NO_SNAPSHOT} embedded />);
    expect(html).toContain("Capital");
    expect(html).not.toContain("Pending");
  });

  it("shows a reference range (8–15%), never a lone em-dash headline", () => {
    const html = renderToStaticMarkup(<CapitalYield {...FUNDED_NO_SNAPSHOT} embedded />);
    expect(html).toContain("Reference range");
    expect(html).toContain("8");
    expect(html).toContain("15");
    expect(html).not.toContain("Forward range pending");
    expect(html).toContain("not guaranteed");
  });
});
