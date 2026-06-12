import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import {
  PanelStatus,
  PanelStatusAccent,
  PanelStatusSection,
} from "@/components/ui/panel-status";

describe("PanelStatus", () => {
  it("renders canonical inline status without nested callout classes", () => {
    const html = renderToStaticMarkup(
      <PanelStatus
        message="No vault attestation yet."
        detail="PoR publish appears here once vault TVL is attested on-chain."
      />,
    );
    expect(html).toContain("ct-panel-status");
    expect(html).toContain('role="status"');
    expect(html).not.toContain("ct-nested-callout");
    expect(html).not.toContain("ct-nested-panel");
  });

  it("renders danger tone for alerts", () => {
    const html = renderToStaticMarkup(
      <PanelStatus tone="danger" role="alert" message="Deposit failed." />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("ct-status-danger");
  });
});

describe("PanelStatusAccent", () => {
  it("renders left-accent rail without nested callout chrome", () => {
    const html = renderToStaticMarkup(
      <PanelStatusAccent className="border-l-(--ct-status-warning)">
        <p className="body-sm m-0">Hold posture</p>
      </PanelStatusAccent>,
    );
    expect(html).toContain("ct-panel-status-accent");
    expect(html).not.toContain("ct-nested-callout");
  });
});

describe("PanelStatusSection", () => {
  it("renders stat-label section without nested box", () => {
    const html = renderToStaticMarkup(
      <PanelStatusSection label="Requirements" aria-label="Onboarding requirements">
        <ul>
          <li>Item</li>
        </ul>
      </PanelStatusSection>,
    );
    expect(html).toContain("ct-panel-status-section");
    expect(html).toContain("stat-label");
    expect(html).not.toContain("ct-nested-callout");
  });
});
