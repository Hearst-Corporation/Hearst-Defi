import { describe, expect, it } from "vitest";

import { buildCustomersKpiStrip } from "@/lib/admin/customers-kpi-strip";
import type { CustomerRow } from "@/lib/data/customers";

function makeCustomer(overrides: Partial<CustomerRow> = {}): CustomerRow {
  return {
    id: "cust_1",
    email: "investor@example.com",
    walletAddress: null,
    kycStatus: "pending",
    activePositions: 0,
    totalPrincipalUsdc: 0,
    joinedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

describe("buildCustomersKpiStrip", () => {
  it("returns empty array when total is 0", () => {
    expect(buildCustomersKpiStrip([], 0)).toEqual([]);
  });

  it("always includes Total investors and KYC approved cells", () => {
    const customers = [makeCustomer({ kycStatus: "approved" })];
    const kpis = buildCustomersKpiStrip(customers, 1);
    const labels = kpis.map((k) => k.label);
    expect(labels).toContain("Total investors");
    expect(labels).toContain("KYC approved");
  });

  it("Total investors value reflects the full `total` (not page count)", () => {
    const customers = [makeCustomer()];
    const kpis = buildCustomersKpiStrip(customers, 42);
    const total = kpis.find((k) => k.label === "Total investors");
    expect(total?.value).toBe("42");
  });

  it("shows Pending review cell with alert when pending investors exist", () => {
    const customers = [makeCustomer({ kycStatus: "pending" })];
    const kpis = buildCustomersKpiStrip(customers, 1);
    const pending = kpis.find((k) => k.label === "Pending review");
    expect(pending).toBeDefined();
    expect(pending?.alert).toBe(true);
  });

  it("omits Pending review cell when no pending KYC", () => {
    const customers = [makeCustomer({ kycStatus: "approved" })];
    const kpis = buildCustomersKpiStrip(customers, 1);
    expect(kpis.find((k) => k.label === "Pending review")).toBeUndefined();
  });

  it("shows Deployed principal when totalPrincipalUsdc > 0", () => {
    const customers = [
      makeCustomer({ kycStatus: "approved", activePositions: 1, totalPrincipalUsdc: 500_000 }),
    ];
    const kpis = buildCustomersKpiStrip(customers, 1);
    const principal = kpis.find((k) => k.label === "Deployed principal");
    expect(principal).toBeDefined();
    expect(principal?.provenance).toBe("manual");
  });

  it("shows With positions zero cell when no capital deployed", () => {
    const customers = [makeCustomer({ kycStatus: "approved", activePositions: 0, totalPrincipalUsdc: 0 })];
    const kpis = buildCustomersKpiStrip(customers, 1);
    const wp = kpis.find((k) => k.label === "With positions");
    expect(wp?.value).toBe("0");
  });

  it("KYC approved cell has accent=true when approved count > 0", () => {
    const customers = [makeCustomer({ kycStatus: "approved" })];
    const kpis = buildCustomersKpiStrip(customers, 1);
    const approved = kpis.find((k) => k.label === "KYC approved");
    expect(approved?.accent).toBe(true);
  });

  it("all provenance values are manual (operator-managed records)", () => {
    const customers = [
      makeCustomer({ kycStatus: "approved", activePositions: 1, totalPrincipalUsdc: 250_000 }),
      makeCustomer({ id: "cust_2", kycStatus: "pending" }),
    ];
    const kpis = buildCustomersKpiStrip(customers, 2);
    for (const kpi of kpis) {
      expect(kpi.provenance).toBe("manual");
    }
  });

  it("page-scope note appears in sublabel when page < total", () => {
    const customers = [makeCustomer({ kycStatus: "approved" })];
    const kpis = buildCustomersKpiStrip(customers, 100);
    const approved = kpis.find((k) => k.label === "KYC approved");
    expect(approved?.sublabel).toContain("this page");
  });
});
