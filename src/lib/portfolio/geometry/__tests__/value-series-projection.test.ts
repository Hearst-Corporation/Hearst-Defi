import { describe, it, expect } from "vitest";
import { projectValueSeries } from "../value-series-projection";
import type { ValueSeriesTx } from "../../value-series";

describe("projectValueSeries", () => {
  const now = new Date("2026-06-25T12:00:00Z");
  
  it("projects a simple deposit series", () => {
    const txs: ValueSeriesTx[] = [
      { type: "deposit", amountUsdc: 1000, occurredAt: new Date("2026-01-01") }
    ];
    const points = projectValueSeries(txs, 1100, now);
    
    // Should have:
    // 1. Start point (12 months ago)
    // 2. Point before deposit
    // 3. Point after deposit
    // 4. End point (now)
    expect(points.length).toBeGreaterThanOrEqual(4);
    
    const lastPoint = points[points.length - 1]!;
    expect(lastPoint.value).toBe(1100);
    
    const firstPoint = points[0]!;
    expect(firstPoint.value).toBe(100); // 1100 - 1000
  });

  it("handles distributions correctly", () => {
    const txs: ValueSeriesTx[] = [
      { type: "deposit", amountUsdc: 1000, occurredAt: new Date("2026-01-01") },
      { type: "distribution", amountUsdc: 50, occurredAt: new Date("2026-02-01") }
    ];
    // Current value 1050 (1000 principal + 100 accrued - 50 distributed)
    // Wait, working backwards:
    // Now: 1050
    // Before distribution: 1050 + 50 = 1100
    // Before deposit: 1100 - 1000 = 100
    const points = projectValueSeries(txs, 1050, now);
    
    const distPoint = points.find(p => p.isDistribution);
    expect(distPoint).toBeDefined();
    expect(distPoint?.value).toBe(1100);
  });
});
