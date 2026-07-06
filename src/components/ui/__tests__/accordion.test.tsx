import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AccordionCard } from "@/components/catalyst/accordion";

describe("AccordionCard", () => {
  it("collapsible + closed: header is a button with aria-expanded=false and a controlled region", () => {
    const html = renderToStaticMarkup(
      <AccordionCard title="Yield History" index={2}>
        <p>body</p>
      </AccordionCard>,
    );
    expect(html).toContain("<button");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls=');
    expect(html).toContain('role="region"');
    // numeric prefix rendered as "2. Yield History"
    expect(html).toContain("2. Yield History");
    // closed body is inert (kept in DOM for the open animation, out of the a11y tree)
    expect(html).toContain("inert");
  });

  it("collapsible + defaultOpen: aria-expanded=true and body not inert", () => {
    const html = renderToStaticMarkup(
      <AccordionCard title="Open Section" defaultOpen>
        <p>visible</p>
      </AccordionCard>,
    );
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("visible");
  });

  it("static hero (collapsible=false): no toggle button, no chevron, body always present", () => {
    const html = renderToStaticMarkup(
      <AccordionCard title="Position Overview" index={1} collapsible={false}>
        <p>hero-body</p>
      </AccordionCard>,
    );
    expect(html).not.toContain("<button");
    expect(html).not.toContain("aria-expanded");
    expect(html).toContain("1. Position Overview");
    expect(html).toContain("hero-body");
    expect(html).toContain('role="region"');
  });

  it("renders a subtitle and a trailing header slot", () => {
    const html = renderToStaticMarkup(
      <AccordionCard
        title="Transactions"
        subtitle="Track all distributions"
        headerTrailing={<span>LIVE</span>}
      >
        <p>tx</p>
      </AccordionCard>,
    );
    expect(html).toContain("Track all distributions");
    expect(html).toContain("LIVE");
  });
});
