import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LiveOps } from "@/components/admin/cockpit/live-ops";

describe("LiveOps", () => {
  it("renders on-chain event links inside list items", () => {
    const html = renderToStaticMarkup(
      <LiveOps
        inngestJobs={[]}
        sentryStats={{ errors24h: 0, warnings24h: 0 }}
        onChainEvents={[
          {
            id: "ev-1",
            type: "deposit",
            label: "Deposit confirmed",
            occurredAt: "2026-06-17T10:00:00.000Z",
            txHash:
              "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
          },
        ]}
      />,
    );

    expect(html).toContain("<ul");
    expect(html).toContain("<li aria-label=\"deposit: Deposit confirmed\"><a");
    expect(html).not.toContain("<a target=\"_blank\" rel=\"noopener noreferrer\"><li");
  });
});
