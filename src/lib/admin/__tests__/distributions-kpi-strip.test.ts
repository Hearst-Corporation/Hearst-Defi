import { describe, expect, it } from "vitest";

import { buildDistributionsKpiStrip } from "@/lib/admin/distributions-kpi-strip";

describe("buildDistributionsKpiStrip", () => {
  it("returns empty when there are no records", () => {
    expect(
      buildDistributionsKpiStrip(
        { totalUsdc: 0, recordCount: 0, maxRecipients: null },
        null,
      ),
    ).toEqual([]);
  });

  it("derives totals from the aggregate, not the display window (TOP4)", () => {
    // Aggregate says 20 records / 200k — the window head only feeds "Latest".
    const kpis = buildDistributionsKpiStrip(
      { totalUsdc: 200_000, recordCount: 20, maxRecipients: 14 },
      { amountUsdc: 1_000, period: "2026-06", recipientsCount: 3 },
    );

    const total = kpis.find((k) => k.label === "Total paid out (legacy)");
    expect(total).toBeDefined();
    expect(total!.sublabel).toBe("across 20 legacy payout records");

    const count = kpis.find((k) => k.label === "Legacy payout records");
    expect(count?.value).toBe("20");

    const latest = kpis.find((k) => k.label === "Latest period");
    expect(latest?.value).toBe("2026-06");

    const max = kpis.find((k) => k.label === "Max recipients");
    expect(max?.value).toBe("14");
    expect(max?.sublabel).toBe("in a single payout record");
  });

  it("carries provenance on every KPI (no render-time literals needed)", () => {
    const kpis = buildDistributionsKpiStrip(
      { totalUsdc: 5_000, recordCount: 2, maxRecipients: 5 },
      { amountUsdc: { toNumber: () => 2_500 }, period: "2026-05", recipientsCount: 5 },
    );
    expect(kpis.length).toBeGreaterThan(0);
    for (const kpi of kpis) {
      expect(kpi.provenance).toBe("manual");
    }
  });

  it("omits Latest period without a window head and Max recipients at 0", () => {
    const kpis = buildDistributionsKpiStrip(
      { totalUsdc: 100, recordCount: 1, maxRecipients: 0 },
      null,
    );
    expect(kpis.map((k) => k.label)).toEqual([
      "Total paid out (legacy)",
      "Legacy payout records",
    ]);
    const total = kpis[0]!;
    expect(total.sublabel).toBe("across 1 legacy payout record");
  });
});
