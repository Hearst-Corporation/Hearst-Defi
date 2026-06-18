import { describe, expect, it } from "vitest";

import {
  resolveLockMeterShell,
  resolveTimeToCashShell,
} from "@/lib/portfolio/hero-rail-state";

describe("resolveTimeToCashShell", () => {
  it("previewZeros suppresses provenance", () => {
    expect(
      resolveTimeToCashShell({
        previewZeros: true,
        source: "live",
        projectedUsdc: 10_000,
        aprLow: 9,
        aprHigh: 12,
      }).widgetProvenance,
    ).toBeUndefined();
  });

  it("stale source suppresses provenance", () => {
    const result = resolveTimeToCashShell({
      source: "stale",
      projectedUsdc: 10_000,
      aprLow: 9,
      aprHigh: 12,
    });
    expect(result.showZeroShell).toBe(true);
    expect(result.widgetProvenance).toBeUndefined();
  });

  it("live payout resolves to estimated provenance", () => {
    expect(
      resolveTimeToCashShell({
        source: "live",
        updatedAt: new Date(),
        projectedUsdc: 10_000,
        aprLow: 9,
        aprHigh: 12,
      }).widgetProvenance,
    ).toBe("estimated");
  });
});

describe("resolveLockMeterShell", () => {
  it("previewZeros suppresses provenance", () => {
    expect(
      resolveLockMeterShell({
        previewZeros: true,
        source: "live",
        softLockupDays: 60,
      }).widgetProvenance,
    ).toBeUndefined();
  });

  it("live lock resolves to live provenance", () => {
    expect(
      resolveLockMeterShell({
        source: "live",
        softLockupDays: 60,
      }).widgetProvenance,
    ).toBe("live");
  });
});
