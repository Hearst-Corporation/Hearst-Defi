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
    expect(lo / 5).toBeCloseTo(Math.round(lo / 5), 5);
    expect(hi / 5).toBeCloseTo(Math.round(hi / 5), 5);
  });

  it("computeFanYDomain never produces 1000% scale for normal fan data", () => {
    const [lo, hi] = computeFanYDomain(NORMAL_FAN, true);
    expect(Math.abs(lo)).toBeLessThan(100);
    expect(Math.abs(hi)).toBeLessThan(100);
    const worstTick = formatFanValue(hi, true);
    expect(worstTick).not.toContain("1000");
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
    expect(src).not.toMatch(/variant="primary"[^>]*className="[^"]*w-full/);
    expect(src).toContain("No record created · Manual admin validation required");
  });
});

describe("data-scientist-output — compact report layout", () => {
  it("uses inline percentile row instead of triple MetricTile grid under the fan", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(
      path.join(
        process.cwd(),
        "src/components/admin/product-workspace/data-scientist-output.tsx",
      ),
      "utf8",
    );
    expect(src).toContain("ProjectionAreaChart");
    expect(src).toContain("MonteCarloChart");
    expect(src).toContain("Projected Capital Trajectories");
    // Compact layout guard: the p5/p50/p95 fan is summarised inline (percentileLine
    // on ScenarioBlock), never as a triple MetricTile grid under the fan.
    expect(src).not.toMatch(/MetricTile label="p5"/);
  });

  it("is KPI-first: the KPI summary strip renders before the thesis prose", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(
      path.join(process.cwd(), "src/components/admin/product-workspace/data-scientist-output.tsx"),
      "utf8",
    );
    // Top banner + KPIs exist.
    expect(src).toContain("Target APY");
    expect(src).toContain("Floor APY");
    // The KPIs appear BEFORE the Thesis prose in source order.
    const kpiIdx = src.indexOf("Target APY");
    const thesisIdx = src.indexOf("Investment Thesis");
    expect(kpiIdx).toBeGreaterThan(-1);
    expect(thesisIdx).toBeGreaterThan(-1);
    expect(kpiIdx).toBeLessThan(thesisIdx);
  });

  it("Monte-Carlo is framed with a real capital base for wealth management", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(
      path.join(process.cwd(), "src/components/admin/product-workspace/data-scientist-output.tsx"),
      "utf8",
    );
    // Wealth management framing (base $250k), not the old "indexed to 100".
    expect(src).toContain("indexed={false}");
    expect(src).toContain("initialValue={250000}");
    expect(src).toContain("base");
    expect(src).not.toContain("initialValue={100}");
    // No positive guarantee — every "guaranteed" occurrence must be negated.
    for (const m of src.matchAll(/guaranteed/gi)) {
      const before = src.slice(Math.max(0, m.index - 5), m.index).toLowerCase();
      expect(before).toContain("not ");
    }
  });

  it("allocation section highlights recommended and groups alternatives", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(
      path.join(
        process.cwd(),
        "src/components/admin/product-workspace/data-scientist-output.tsx",
      ),
      "utf8",
    );
    // The three risk profiles map to Safe / Balanced / Opportunistic.
    expect(src).toContain('defensive: "Safe"');
    expect(src).toContain('balanced: "Balanced"');
    expect(src).toContain('opportunistic: "Opportunistic"');
    // Section header reads "Recommended Allocation" and "Alternative Profiles".
    expect(src).toContain("Recommended Allocation");
    expect(src).toContain("Alternative Profiles");
    // The fourth "Canonical / published mix" card is gone from Report Product.
    expect(src).not.toContain('title="Canonical"');
    expect(src).not.toContain("published mix");
    expect(src).not.toContain("scenarios + canonical mix");
    expect(src).not.toContain("canonicalAllocationData(draft)");
  });
});
