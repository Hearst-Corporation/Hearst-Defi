import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WidgetShell } from "@/components/portfolio/widget-shell";
import type { WidgetView } from "@/lib/portfolio/view-state";

// ── Test helpers ──────────────────────────────────────────────────────────────

const ZERO_VIEW: WidgetView = { mode: "zero", provenance: undefined };
const LIVE_VIEW: WidgetView = { mode: "live", provenance: "live" };
const LIVE_ATTESTED: WidgetView = { mode: "live", provenance: "attested" };

function renderShell(view: WidgetView, overrides?: Partial<Parameters<typeof WidgetShell>[0]>) {
  return renderToStaticMarkup(
    <WidgetShell
      ariaLabel="Test widget"
      title="Test Title"
      view={view}
      zeroSlot={<div>zero content</div>}
      footnote={<p>footnote text</p>}
      {...overrides}
    >
      <div>live content</div>
    </WidgetShell>,
  );
}

// ── Suite 1: mode "zero" renders zeroSlot, not children ──────────────────────

describe("WidgetShell — zero mode", () => {
  it("renders zeroSlot text in zero mode", () => {
    const html = renderShell(ZERO_VIEW);
    expect(html).toContain("zero content");
  });

  it("does NOT render children in zero mode", () => {
    const html = renderShell(ZERO_VIEW);
    expect(html).not.toContain("live content");
  });

  it("does NOT render footnote in zero mode", () => {
    const html = renderShell(ZERO_VIEW);
    expect(html).not.toContain("footnote text");
  });
});

// ── Suite 2: mode "live" renders children, not zeroSlot ──────────────────────

describe("WidgetShell — live mode", () => {
  it("renders children in live mode", () => {
    const html = renderShell(LIVE_VIEW);
    expect(html).toContain("live content");
  });

  it("does NOT render zeroSlot in live mode", () => {
    const html = renderShell(LIVE_VIEW);
    expect(html).not.toContain("zero content");
  });

  it("renders footnote in live mode when provided", () => {
    const html = renderShell(LIVE_VIEW);
    expect(html).toContain("footnote text");
  });
});

// ── Suite 3: provenance badge present only in live mode ───────────────────────

describe("WidgetShell — provenance badge", () => {
  it("provenance badge present in live mode with provenance set", () => {
    const html = renderShell(LIVE_ATTESTED);
    // PfCockpitPanelHeader passes compact=true → renders dashboard-provenance-badge--compact
    expect(html).toContain('aria-label="Data provenance: Attested"');
    // Badge wrapper is present in the header trail
    expect(html).toContain("pf-cockpit-panel__header-trail");
  });

  it("NO provenance badge in zero mode (view.provenance is undefined)", () => {
    const html = renderShell(ZERO_VIEW);
    expect(html).not.toContain('aria-label="Data provenance:');
    // header-trail only present when there is trailing or provenance
    expect(html).not.toContain("pf-cockpit-panel__header-trail");
  });

  it("provenance badge absent in live mode when view has no provenance", () => {
    const liveNoProvenance: WidgetView = { mode: "live", provenance: undefined };
    const html = renderShell(liveNoProvenance);
    expect(html).not.toContain('aria-label="Data provenance:');
  });
});

// ── Suite 4: footnote only in live mode ──────────────────────────────────────

describe("WidgetShell — footnote", () => {
  it("footnote is NOT rendered in zero mode", () => {
    const html = renderShell(ZERO_VIEW);
    expect(html).not.toContain("footnote text");
  });

  it("footnote IS rendered in live mode", () => {
    const html = renderShell(LIVE_VIEW);
    expect(html).toContain("footnote text");
  });

  it("omitting footnote prop renders nothing extra in live mode", () => {
    const html = renderShell(LIVE_VIEW, { footnote: undefined });
    expect(html).not.toContain("footnote text");
  });
});

// ── Suite 5: panel structure ──────────────────────────────────────────────────

describe("WidgetShell — panel structure", () => {
  it("renders pf-cockpit-panel", () => {
    const html = renderShell(LIVE_VIEW);
    expect(html).toContain("pf-cockpit-panel");
  });

  it("aria-label is set on the panel", () => {
    const html = renderShell(LIVE_VIEW, { ariaLabel: "My widget label" });
    expect(html).toContain('aria-label="My widget label"');
  });

  it("title text is rendered in header", () => {
    const html = renderShell(LIVE_VIEW, { title: "Positions" });
    expect(html).toContain("Positions");
  });

  it("subtitle is rendered when provided", () => {
    const html = renderShell(LIVE_VIEW, { subtitle: "12m · USDC" });
    expect(html).toContain("12m · USDC");
  });
});
