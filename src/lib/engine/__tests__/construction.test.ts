import { describe, it, expect } from "vitest";
import { computeConstructionROI } from "../construction";
import type { ConstructionInputs } from "../types";

describe("Construction Engine", () => {
  const baseInputs: ConstructionInputs = {
    capacity_mw: 100,
    infra_cost_usd_mw: 650000,
    asic_efficiency_j_th: 15,
    asic_cost_usd_th: 12,
    energy_cost_kwh: 0.045,
    hashprice_usd_th_day: 0.042,
  };

  it("calculates CAPEX correctly", () => {
    const result = computeConstructionROI(baseInputs);
    
    // hashrate = 100MW * 1,000,000 / 15 J/TH = 6,666,666.67 TH
    // infra_capex = 100 * 650,000 = 65,000,000
    // asic_capex = 6,666,666.67 * 12 = 80,000,000
    // total = 145,000,000
    expect(result.infra_capex_usd).toBe(65000000);
    expect(result.asic_capex_usd).toBe(80000000);
    expect(result.total_capex_usd).toBe(145000000);
  });

  it("calculates OPEX and Revenue correctly", () => {
    const result = computeConstructionROI(baseInputs);
    
    // energy_kwh = 100 * 1000 * 24 * 365 * 0.98 = 858,480,000 kWh
    // energy_cost = 858,480,000 * 0.045 = 38,631,600
    // maintenance = 65,000,000 * 0.05 = 3,250,000
    // total_opex = 41,881,600
    expect(result.yearly_opex_usd).toBe(41881600);
    
    // revenue = 6,666,666.67 * 0.042 * 365 * 0.98 = 100,156,000
    expect(result.yearly_revenue_usd).toBe(100156000);
  });

  it("calculates ROI and Payback correctly", () => {
    const result = computeConstructionROI(baseInputs);
    
    // net_profit = 100,156,000 - 41,881,600 = 58,274,400
    // payback_months = (145,000,000 / 58,274,400) * 12 = 29.85...
    expect(result.yearly_net_profit_usd).toBe(58274400);
    expect(result.payback_months).toBe(29.9);
  });

  it("handles zero profit (infinite payback)", () => {
    const lossInputs = { ...baseInputs, hashprice_usd_th_day: 0.01 };
    const result = computeConstructionROI(lossInputs);
    expect(result.yearly_net_profit_usd).toBeLessThan(0);
    expect(result.payback_months).toBe(999);
  });

  describe("Defensive edge cases — degenerate inputs must never produce NaN/Infinity", () => {
    function assertAllFieldsFinite(result: ReturnType<typeof computeConstructionROI>) {
      const fields = Object.entries(result) as [string, number][];
      for (const [key, value] of fields) {
        expect(
          Number.isFinite(value),
          `Field "${key}" must be finite, got ${value}`,
        ).toBe(true);
      }
    }

    it("zero capacity — all outputs finite, CAPEX and derived fields are 0", () => {
      const result = computeConstructionROI({ ...baseInputs, capacity_mw: 0 });
      assertAllFieldsFinite(result);
      expect(result.total_capex_usd).toBe(0);
      expect(result.roi_5y_pct).toBe(0);
      expect(result.break_even_hashprice).toBe(0);
    });

    it("zero ASIC efficiency — hashrate-derived fields are 0/finite, no NaN/Infinity", () => {
      const result = computeConstructionROI({ ...baseInputs, asic_efficiency_j_th: 0 });
      assertAllFieldsFinite(result);
      // With zero hashrate: revenue = 0, asic_capex = 0 but infra_capex still > 0
      // roi_5y_pct is finite (negative — pure loss), break_even_hashprice is 0 (zero denominator guard)
      expect(result.yearly_revenue_usd).toBe(0);
      expect(result.break_even_hashprice).toBe(0);
      expect(Number.isFinite(result.roi_5y_pct)).toBe(true);
    });
  });
});
