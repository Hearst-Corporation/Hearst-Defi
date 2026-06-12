/**
 * Admin vaults — empty-state structural contract (DS §9).
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AwaitingMetricState } from "@/components/portfolio/awaiting-metric-state";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptySurface } from "@/components/ui/empty-surface";

describe("Admin vaults — empty state design contract", () => {
  it("vault list empty: EmptySurface only, no active module shell", () => {
    const html = renderToStaticMarkup(
      <AwaitingMetricState
        message="No deployments found."
        detail="Vault deployments will appear here once created."
        link={{ label: "Create the first one", href: "/admin/vaults/new" }}
        className="min-h-32"
      />,
    );

    expect(html).toContain("ct-empty-surface");
    expect(html).toContain("No deployments found.");
    expect(html).not.toContain("glass-panel");
    expect(html).not.toContain("ct-system-panel");
    expect(html).not.toContain("border-dashed");
    expect(html).not.toContain("Stale");
  });

  it("approvals partial empty: inline EmptySurface inside active Card", () => {
    const html = renderToStaticMarkup(
      <Card>
        <CardHeader>
          <CardTitle>Approvals</CardTitle>
          <span className="mono tabular text-sm ct-text-muted">0 / 2 required</span>
        </CardHeader>
        <EmptySurface variant="inline" message="No signatures yet." />
      </Card>,
    );

    expect(html).toContain("ct-empty-surface--inline");
    expect(html).toContain("No signatures yet.");
    expect(html).toContain("glass-panel");
    expect(html).not.toContain("border-dashed");
  });
});
