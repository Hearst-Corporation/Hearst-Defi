/**
 * Admin vaults — empty-state structural contract (DS §9).
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Link from "next/link";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptySurface } from "@/components/ui/empty-surface";
import { PanelStatus } from "@/components/ui/panel-status";

describe("Admin vaults — empty state design contract", () => {
  it("vault list empty: EmptySurface only, no active module shell", () => {
    const html = renderToStaticMarkup(
      <EmptySurface
        variant="widget"
        message="No deployments found."
        detail="Vault deployments will appear here once created."
        className="min-h-32"
      >
        <Link href="/admin/vaults/new">Create the first one</Link>
      </EmptySurface>,
    );

    expect(html).toContain("ct-empty-surface");
    expect(html).toContain("No deployments found.");
    expect(html).not.toContain("ct-glass-panel");
    expect(html).not.toContain("ct-system-panel");
    expect(html).not.toContain("border-dashed");
    expect(html).not.toContain("Stale");
  });

  it("approvals partial empty: PanelStatus inside active Card", () => {
    const html = renderToStaticMarkup(
      <Card>
        <CardHeader>
          <CardTitle>Approvals</CardTitle>
          <span className="mono tabular body-sm ct-text-muted">0 / 2 required</span>
        </CardHeader>
        <PanelStatus message="No signatures yet." />
      </Card>,
    );

    expect(html).toContain("ct-panel-status");
    expect(html).not.toContain("ct-nested-callout");
    expect(html).toContain("No signatures yet.");
    expect(html).toContain("ct-glass-panel");
    expect(html).not.toContain("border-dashed");
  });
});
