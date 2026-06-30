import { describe, expect, it } from "vitest";

import {
  computeFanYDomain,
  fanBandsArePercentPoints,
  formatFanMonthLabel,
  formatFanPercentPoint,
  formatFanValue,
  formatHashpriceUsd,
} from "@/components/admin/product-workspace/report-format";

const NORMAL_FAN = [
  { m: 0, p5: 4.2, p50: 8.1, p95: 14.6 },
  { m: 6, p5: -2.1, p50: 6.4, p95: 18.2 },
  { m: 12, p5: -4.7, p50: 5.2, p95: 22.1 },
];

describe("report-format — fan percent points", () => {
  it("does not render 1000% axis ticks for normal APY fan data", () => {
    expect(fanBandsArePercentPoints(NORMAL_FAN)).toBe(true);
    const tick = formatFanValue(NORMAL_FAN[2]!.p50, true);
    expect(tick).toBe("5.2%");
    expect(tick).not.toContain("1000");
    expect(tick).not.toContain("520");
  });

  it("formats fraction series once when percentPoints is false", () => {
    expect(formatFanValue(0.052, false)).toBe("5.2%");
  });

  it("computeFanYDomain stays in a sane APY band", () => {
    const [lo, hi] = computeFanYDomain(NORMAL_FAN, true);
    expect(lo).toBeGreaterThan(-50);
    expect(hi).toBeLessThan(50);
  });

  it("formatFanPercentPoint keeps sign", () => {
    expect(formatFanPercentPoint(-4.7)).toBe("−4.7%");
  });

  it("never renders Month undefined in the tooltip label helper", () => {
    expect(formatFanMonthLabel(6)).toBe("Month 6");
    expect(formatFanMonthLabel(undefined)).toBe("Month —");
  });
});

describe("report-format — hashprice canonical display", () => {
  it("matches step precision for sub-dollar hashprice", () => {
    expect(formatHashpriceUsd(0.055)).toBe("$0.055/TH·d");
    expect(formatHashpriceUsd(0)).toBe("Unavailable");
    expect(formatHashpriceUsd(0.055)).not.toBe("$0/TH·d");
  });
});

describe("construction-stepper footer copy", () => {
  it("uses compact guardrail text without the old PDF CTA label", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(
      path.join(
        process.cwd(),
        "src/components/admin/product-workspace/construction-stepper.tsx",
      ),
      "utf8",
    );
    expect(src).toContain("Print view");
    expect(src).not.toContain("Open print view (PDF)");
    expect(src).toContain('variant="ghost"');
    expect(src).toContain("No record created · Manual admin validation required");
  });
});
