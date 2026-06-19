import { describe, expect, it } from "vitest";

import {
  resolveLockMeterShell,
  resolveLiquidityWidgetView,
  resolvePayoutWidgetView,
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

describe("resolvePayoutWidgetView", () => {
  it("previewZeros forces zero mode", () => {
    expect(
      resolvePayoutWidgetView({
        previewZeros: true,
        source: "live",
        projectedUsdc: 10_000,
        aprLow: 9,
        aprHigh: 12,
      }),
    ).toEqual({ mode: "zero", provenance: undefined });
  });

  it("stale payout forces zero mode", () => {
    expect(
      resolvePayoutWidgetView({
        previewZeros: false,
        source: "stale",
        projectedUsdc: 0,
        aprLow: 0,
        aprHigh: 0,
      }).mode,
    ).toBe("zero");
  });
});

describe("resolveLiquidityWidgetView", () => {
  it("previewZeros forces zero mode", () => {
    expect(
      resolveLiquidityWidgetView({
        previewZeros: true,
        source: "live",
        softLockupDays: 60,
      }),
    ).toEqual({ mode: "zero", provenance: undefined });
  });

  it("live lock with terms resolves to live", () => {
    expect(
      resolveLiquidityWidgetView({
        previewZeros: false,
        source: "live",
        softLockupDays: 60,
      }),
    ).toEqual({ mode: "live", provenance: "live" });
  });
});
