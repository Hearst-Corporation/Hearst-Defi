import { describe, expect, it } from "vitest";

import {
  buildMethodologyPanel,
  PROJECTION_METHODOLOGY_VERSION,
} from "../methodology-panel";
import { getProjectionCompanyAssumptions } from "../company-assumptions";

describe("buildMethodologyPanel — read-only assumptions view-model", () => {
  it("pins the methodology version", () => {
    const panel = buildMethodologyPanel();
    expect(panel.methodologyVersion).toBe(PROJECTION_METHODOLOGY_VERSION);
    expect(panel.methodologyVersion).toBe("v1.0");
  });

  it("tags the assumption set CONFIGURED (never live/validated)", () => {
    const panel = buildMethodologyPanel();
    expect(panel.status).toBe("CONFIGURED");
  });

  it("mirrors the in-code assumptions verbatim (no invented numbers)", () => {
    const a = getProjectionCompanyAssumptions();
    const panel = buildMethodologyPanel();

    const byLabel = (needle: string) =>
      panel.rows.find((r) => r.label.includes(needle))?.value;

    expect(byLabel("markup")).toBe(`${a.markupPct}%`);
    expect(byLabel("Revenue share")).toBe(`${a.revenueSharePct}%`);
    expect(byLabel("Borrow APR")).toBe(`${a.borrowAprPct}%`);
    expect(byLabel("fees")).toBe(`${a.feePct}%`);
    expect(byLabel("BTC scenario band")).toBe(
      `${a.btcScenarios.bearPct}% / ${a.btcScenarios.basePct}% / ${a.btcScenarios.bullPct}%`,
    );
  });

  it("carries the honest source + notes from the assumptions metadata", () => {
    const a = getProjectionCompanyAssumptions();
    const panel = buildMethodologyPanel();
    expect(panel.source).toBe(a.metadata.source);
    expect(panel.notes).toEqual(a.metadata.notes);
    expect(panel.notes.length).toBeGreaterThan(0);
  });

  it("every row carries the assumption status", () => {
    const panel = buildMethodologyPanel();
    expect(panel.rows.length).toBeGreaterThan(0);
    for (const row of panel.rows) {
      expect(row.status).toBe("CONFIGURED");
    }
  });

  it("is deterministic (same output across calls)", () => {
    expect(buildMethodologyPanel()).toEqual(buildMethodologyPanel());
  });
});
