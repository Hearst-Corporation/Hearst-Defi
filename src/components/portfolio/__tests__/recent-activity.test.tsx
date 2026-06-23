import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RecentActivity } from "@/components/portfolio/recent-activity";

describe("RecentActivity", () => {
  it("renders a latest movement summary when transactions exist", () => {
    const html = renderToStaticMarkup(
      <RecentActivity
        transactions={[
          {
            id: "tx-1",
            type: "distribution",
            amountUsdc: 18000,
            occurredAt: new Date("2026-05-01T12:00:00Z"),
            txHash: null,
            positionVaultName: "Hearst Yield Vault",
          },
          {
            id: "tx-2",
            type: "deposit",
            amountUsdc: 500000,
            occurredAt: new Date("2026-04-01T12:00:00Z"),
            txHash: null,
            positionVaultName: "Hearst Yield Vault",
          },
        ]}
        source="live"
        asOf={new Date("2026-05-02T12:00:00Z")}
      />,
    );

    expect(html).toContain("pf-activity-summary");
    expect(html).toContain("Latest movement");
    expect(html).toContain("recent events");
  });
});
