import { describe, expect, it } from "vitest";

import { BTC_MINING_PERFORMANCE_VAULT } from "@/lib/products/btc-mining-performance-vault";
import {
  buildOperatorEconomics,
  clientDistributionBand,
  type OperatorEconomics,
} from "@/lib/products/operator-economics";

const P = BTC_MINING_PERFORMANCE_VAULT;

describe("buildOperatorEconomics", () => {
  it("derives the operator model from the product levers", () => {
    const op = buildOperatorEconomics(P);
    expect(op.machineMarkup.value).toBe(P.levers.markupPct.value);
    expect(op.revenueShare.value).toBe(P.levers.revenueSharePct.value);
    expect(op.financingSpread.value).toBe(P.levers.borrowAprPct.value);
  });

  it("every operator value carries the not-validated status AND validated:false", () => {
    const op = buildOperatorEconomics(P);
    const fields: (keyof OperatorEconomics)[] = [
      "performanceSpreadAboveClientTarget",
      "managementFee",
      "performanceFee",
      "machineMarkup",
      "revenueShare",
      "machineResaleValue",
      "machineRedeployValue",
      "residualMiningProduction",
      "financingSpread",
    ];
    for (const f of fields) {
      expect(op[f].status).toBe("CONFIGURED_NOT_VALIDATED");
      expect(op[f].validated).toBe(false);
    }
  });

  it("operator spread is a SEPARATE structure from the client distribution band", () => {
    const op = buildOperatorEconomics(P);
    const client = clientDistributionBand(P);
    // The operator object exposes a spread; the client object exposes a band.
    // There is no field on the operator model that equals the client band, and
    // the spread is keyed/typed separately (it is not the client number).
    expect(client.min).toBe(P.monthlyDistributionTargetAnnualized.min);
    expect(client.max).toBe(P.monthlyDistributionTargetAnnualized.max);
    // The operator spread is not the same number as the client distribution.
    expect(op.performanceSpreadAboveClientTarget.value).not.toBe(client.max);
    // No operator field is wired into the client band object.
    expect(Object.keys(client)).toEqual(["min", "max", "status"]);
  });

  it("building the operator model does NOT change the client distribution number", () => {
    const before = clientDistributionBand(P);
    const op = buildOperatorEconomics(P);
    void op; // building it must have zero effect on the client band
    const after = clientDistributionBand(P);
    expect(after).toEqual(before);
    expect(after.min).toBe(0.08);
    expect(after.max).toBe(0.12);
  });

  it("the operator performance spread is above the client target band (hurdle, not ceiling)", () => {
    const op = buildOperatorEconomics(P);
    // Spread is captured ABOVE the client's 24% total target.
    expect(op.performanceSpreadAboveClientTarget.value).toBeGreaterThanOrEqual(0);
    expect(op.performanceSpreadAboveClientTarget.value).toBeCloseTo(
      1 - P.totalPerformanceTarget.max,
      10,
    );
  });
});
