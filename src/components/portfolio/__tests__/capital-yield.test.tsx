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
  totalValueUsdc: 500_000,
  source: "live",
};

/* ─── Panel identity ───────────────────────────────────────────────────────── */
describe("CapitalYield — panel identity", () => {
  it("always renders the 'Capital & Yield' title", () => {
    const html = renderToStaticMarkup(
      <CapitalYield {...EMPTY_PROPS} />,
    );
    expect(html).toContain("Capital &amp; Yield");
  });
});

/* ─── Empty: no position ─────────────────────────────────────────────────── */
describe("CapitalYield — no-position empty state", () => {
  it("shows the 'confirmed on-chain' copy when no position exists", () => {
    const html = renderToStaticMarkup(<CapitalYield {...EMPTY_PROPS} />);
    expect(html).toContain("confirmed on-chain");
  });

  it("shows the 'Position not yet confirmed' lead copy", () => {
    const html = renderToStaticMarkup(<CapitalYield {...EMPTY_PROPS} />);
    expect(html).toContain("Position not yet confirmed");
  });

  it("never shows $0 in the no-position state", () => {
    const html = renderToStaticMarkup(<CapitalYield {...EMPTY_PROPS} />);
    expect(html).not.toContain("$0");
  });

  it("does NOT show the 'Your position is active' copy", () => {
    const html = renderToStaticMarkup(<CapitalYield {...EMPTY_PROPS} />);
    expect(html).not.toContain("Your position is active");
  });

  it("does NOT show the not-guaranteed disclaimer in empty state", () => {
    const html = renderToStaticMarkup(<CapitalYield {...EMPTY_PROPS} />);
    expect(html).not.toContain("not guaranteed");
  });
});

/* ─── Empty: awaiting-data (position active, vault snapshot not ready) ────── */
describe("CapitalYield — awaiting-data state (position active, no vault snapshot)", () => {
  it("shows 'Your position is active' copy", () => {
    const html = renderToStaticMarkup(
      <CapitalYield {...EMPTY_PROPS} totalValueUsdc={11} hasActivePosition />,
    );
    expect(html).toContain("Your position is active");
  });

  it("does NOT show 'confirmed on-chain' (wrong empty state copy)", () => {
    const html = renderToStaticMarkup(
      <CapitalYield {...EMPTY_PROPS} totalValueUsdc={11} hasActivePosition />,
    );
    expect(html).not.toContain("confirmed on-chain");
  });

  it("does NOT show $0", () => {
    const html = renderToStaticMarkup(
      <CapitalYield {...EMPTY_PROPS} totalValueUsdc={11} hasActivePosition />,
    );
    expect(html).not.toContain("$0");
  });

  it("does NOT show the not-guaranteed disclaimer", () => {
    const html = renderToStaticMarkup(
      <CapitalYield {...EMPTY_PROPS} totalValueUsdc={11} hasActivePosition />,
    );
    expect(html).not.toContain("not guaranteed");
  });
});

/* ─── Live state ─────────────────────────────────────────────────────────── */
describe("CapitalYield — live state (real data + investor position)", () => {
  it("renders the panel title", () => {
    const html = renderToStaticMarkup(
      <CapitalYield {...VAULT_REFERENCE_PROPS} />,
    );
    expect(html).toContain("Capital &amp; Yield");
  });

  it("renders the APY range (9.4–12.8%) — non-negotiable #1", () => {
    const html = renderToStaticMarkup(
      <CapitalYield {...VAULT_REFERENCE_PROPS} />,
    );
    // ApyRange outputs the numbers with en-dash separator
    expect(html).toContain("9.4");
    expect(html).toContain("12.8");
  });

  it("shows the 'not guaranteed' disclaimer — non-negotiable #10", () => {
    const html = renderToStaticMarkup(
      <CapitalYield {...VAULT_REFERENCE_PROPS} />,
    );
    expect(html).toContain("not guaranteed");
  });

  it("shows the formatted capital amount", () => {
    const html = renderToStaticMarkup(
      <CapitalYield {...VAULT_REFERENCE_PROPS} />,
    );
    // totalValueUsdc=500_000 → "$500K"
    expect(html).toContain("$500K");
  });

  it("shows allocation bucket labels", () => {
    const html = renderToStaticMarkup(
      <CapitalYield {...VAULT_REFERENCE_PROPS} />,
    );
    expect(html).toContain("Mining cashflow");
    expect(html).toContain("USDC base yield");
  });

  it("shows bucket percentages", () => {
    const html = renderToStaticMarkup(
      <CapitalYield {...VAULT_REFERENCE_PROPS} />,
    );
    expect(html).toContain("62%");
    expect(html).toContain("38%");
  });

  it("shows a provenance badge when data is real — non-negotiable #2", () => {
    const html = renderToStaticMarkup(
      <CapitalYield {...VAULT_REFERENCE_PROPS} source="live" updatedAt={new Date()} />,
    );
    // ProvenanceBadge is rendered (resolves to "estimated" by default preferred)
    // The badge element has role="status" and an aria-label containing "provenance"
    expect(html).toContain('role="status"');
    expect(html).toContain("Data provenance");
  });

  it("does NOT show donut SVG elements (legacy removed)", () => {
    const html = renderToStaticMarkup(
      <CapitalYield {...VAULT_REFERENCE_PROPS} />,
    );
    expect(html).not.toContain("dash-chart-svg");
    expect(html).not.toContain("dash-chart-circle");
    expect(html).not.toContain("cy-donut");
  });

  it("does NOT show 'Blended forward' (legacy removed)", () => {
    const html = renderToStaticMarkup(
      <CapitalYield {...VAULT_REFERENCE_PROPS} />,
    );
    expect(html).not.toContain("Blended forward");
  });

  it("does NOT show 'Stressed bear' (legacy removed)", () => {
    const html = renderToStaticMarkup(
      <CapitalYield {...VAULT_REFERENCE_PROPS} />,
    );
    expect(html).not.toContain("Stressed bear");
  });

  it("does NOT show 'Yield source · 12m fwd' (legacy ledger header removed)", () => {
    const html = renderToStaticMarkup(
      <CapitalYield {...VAULT_REFERENCE_PROPS} />,
    );
    expect(html).not.toContain("Yield source");
  });

  it("does NOT show 'Computing' or 'Pending' (legacy donut centre removed)", () => {
    const html = renderToStaticMarkup(
      <CapitalYield {...VAULT_REFERENCE_PROPS} />,
    );
    expect(html).not.toContain("Computing");
    expect(html).not.toContain("Pending");
  });

  it("shows the methodology version in the disclaimer", () => {
    const html = renderToStaticMarkup(
      <CapitalYield {...VAULT_REFERENCE_PROPS} methodologyVersion="v1.0" />,
    );
    expect(html).toContain("v1.0");
  });
});

/* ─── Guard: no forbidden words ─────────────────────────────────────────── */
describe("CapitalYield — forbidden words (#5)", () => {
  it("does not contain the word 'guarantee' in any state", () => {
    const htmlEmpty = renderToStaticMarkup(<CapitalYield {...EMPTY_PROPS} />);
    const htmlLive = renderToStaticMarkup(<CapitalYield {...VAULT_REFERENCE_PROPS} />);
    expect(htmlEmpty).not.toMatch(/\bguarantee\b/i);
    expect(htmlLive).not.toMatch(/\bguarantee\b/i);
  });

  it("does not contain 'promise' or 'risk-free' in any state", () => {
    const htmlLive = renderToStaticMarkup(<CapitalYield {...VAULT_REFERENCE_PROPS} />);
    expect(htmlLive).not.toContain("promise");
    expect(htmlLive).not.toContain("risk-free");
  });
});
