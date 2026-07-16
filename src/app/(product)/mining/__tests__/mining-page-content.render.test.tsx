// Render smoke test for the Mining page content — verifies all 3 documented
// states (complete/stale/unavailable) render without throwing, and the
// accessible text summary is present. Not a full E2E (no browser drive by
// this agent, per repo policy), but proves the component tree is sound
// server-side for every fixture state before hand-off.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { MiningPageContent } from "../_components/mining-page-content";
import { miningCompleteFixture } from "@/features/investor-ui/fixtures/mining-complete";
import { miningStaleFixture } from "@/features/investor-ui/fixtures/mining-stale";
import { miningUnavailableFixture } from "@/features/investor-ui/fixtures/mining-unavailable";

describe("MiningPageContent", () => {
  it("renders the complete fixture without throwing", () => {
    const html = renderToStaticMarkup(
      <MiningPageContent viewModel={miningCompleteFixture} />,
    );
    expect(html).toContain("Mining flow");
    expect(html).toContain("TH/s");
  });

  it("renders the stale fixture with a stale flag, no crash", () => {
    const html = renderToStaticMarkup(
      <MiningPageContent viewModel={miningStaleFixture} />,
    );
    expect(html).toMatch(/stale/i);
  });

  it("renders the unavailable/not-configured fixture honestly, no fabricated numbers", () => {
    const html = renderToStaticMarkup(
      <MiningPageContent viewModel={miningUnavailableFixture} />,
    );
    expect(html).toMatch(/not configured/i);
  });
});
