import { describe, expect, it } from "vitest";

import { buildCustomersKpiStrip } from "@/lib/admin/customers-kpi-strip";
import type { CustomersAggregates } from "@/lib/data/customers";

/**
 * Contract (vague 2 — E2): the strip is built from WHOLE-POPULATION aggregates
 * (loadCustomersAggregates), never from the 50-row page window. Principal is
 * the ACTIVE principal, labelled as such.
 */
function makeAggregates(
  overrides: Partial<CustomersAggregates> = {},
): CustomersAggregates {
  return {
    total: 1,
    kycCounts: { pending: 1, approved: 0, rejected: 0, unknown: 0 },
    activePrincipalUsdc: 0,
    investorsWithActivePositions: 0,
    ...overrides,
  };
}

describe("buildCustomersKpiStrip", () => {
  it("returns empty array when total is 0", () => {
    expect(buildCustomersKpiStrip(makeAggregates({ total: 0 }))).toEqual([]);
  });

  it("always includes Total investors and KYC approved cells", () => {
    const kpis = buildCustomersKpiStrip(
      makeAggregates({
        total: 1,
        kycCounts: { pending: 0, approved: 1, rejected: 0, unknown: 0 },
      }),
    );
    const labels = kpis.map((k) => k.label);
    expect(labels).toContain("Total investors");
    expect(labels).toContain("KYC approved");
  });

  it("Total investors value reflects the full population total", () => {
    const kpis = buildCustomersKpiStrip(makeAggregates({ total: 42 }));
    expect(kpis.find((k) => k.label === "Total investors")?.value).toBe("42");
  });

  it("KYC approved counts the FULL population, not a page window", () => {
    const kpis = buildCustomersKpiStrip(
      makeAggregates({
        total: 120,
        kycCounts: { pending: 20, approved: 100, rejected: 0, unknown: 0 },
      }),
    );
    const approved = kpis.find((k) => k.label === "KYC approved");
    expect(approved?.value).toBe("100");
    expect(approved?.sublabel).toBe("of 120 investors");
  });

  it("shows Pending review cell with alert when pending investors exist", () => {
    const kpis = buildCustomersKpiStrip(makeAggregates());
    const pending = kpis.find((k) => k.label === "Pending review");
    expect(pending).toBeDefined();
    expect(pending?.alert).toBe(true);
  });

  it("omits Pending review cell when no pending KYC", () => {
    const kpis = buildCustomersKpiStrip(
      makeAggregates({
        kycCounts: { pending: 0, approved: 1, rejected: 0, unknown: 0 },
      }),
    );
    expect(kpis.find((k) => k.label === "Pending review")).toBeUndefined();
  });

  it("surfaces an Unknown KYC cell when unrecognised statuses exist", () => {
    const kpis = buildCustomersKpiStrip(
      makeAggregates({
        total: 3,
        kycCounts: { pending: 1, approved: 1, rejected: 0, unknown: 1 },
      }),
    );
    const unknown = kpis.find((k) => k.label === "Unknown KYC");
    expect(unknown?.value).toBe("1");
    expect(unknown?.alert).toBe(true);
  });

  it("omits Unknown KYC cell when every status is recognised", () => {
    const kpis = buildCustomersKpiStrip(makeAggregates());
    expect(kpis.find((k) => k.label === "Unknown KYC")).toBeUndefined();
  });

  it("shows Active principal from the active-position aggregate", () => {
    const kpis = buildCustomersKpiStrip(
      makeAggregates({
        activePrincipalUsdc: 500_000,
        investorsWithActivePositions: 2,
      }),
    );
    const principal = kpis.find((k) => k.label === "Active principal");
    expect(principal).toBeDefined();
    expect(principal?.provenance).toBe("manual");
    expect(principal?.sublabel).toBe("2 investors with active positions");
  });

  it("shows an honest zero Active principal cell when nothing is at work", () => {
    const kpis = buildCustomersKpiStrip(makeAggregates());
    const principal = kpis.find((k) => k.label === "Active principal");
    expect(principal).toBeDefined();
    expect(principal?.sublabel).toBe("no active positions");
  });

  it("KYC approved cell has accent=true when approved count > 0", () => {
    const kpis = buildCustomersKpiStrip(
      makeAggregates({
        kycCounts: { pending: 0, approved: 1, rejected: 0, unknown: 0 },
      }),
    );
    expect(kpis.find((k) => k.label === "KYC approved")?.accent).toBe(true);
  });

  it("all provenance values are manual (operator-managed records)", () => {
    const kpis = buildCustomersKpiStrip(
      makeAggregates({
        total: 4,
        kycCounts: { pending: 1, approved: 1, rejected: 1, unknown: 1 },
        activePrincipalUsdc: 250_000,
        investorsWithActivePositions: 1,
      }),
    );
    for (const kpi of kpis) {
      expect(kpi.provenance).toBe("manual");
    }
  });
});
