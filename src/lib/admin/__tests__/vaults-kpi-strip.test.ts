import { describe, expect, it } from "vitest";

import {
  buildVaultsKpiStrip,
  POSITION_SUM_PROVENANCE,
  TARGET_RANGE_PROVENANCE,
} from "@/lib/admin/vaults-kpi-strip";

const vault = (
  status: string,
  aumUsdc = 0,
  capacityUsdc = 1_000_000,
) => ({ status, aumUsdc, capacityUsdc });

describe("buildVaultsKpiStrip", () => {
  it("returns [] on an empty population", () => {
    expect(buildVaultsKpiStrip([])).toEqual([]);
  });

  it("counts the COMPLETE population handed in — archived/closed rows included (TOP1)", () => {
    const kpis = buildVaultsKpiStrip([
      vault("live", 400_000),
      vault("draft"),
      // Archived single-run draft: a real VaultDeployment row. It is hidden
      // from the lifecycle table but MUST stay in the totals.
      vault("closed", 100_000),
    ]);

    const total = kpis.find((k) => k.label === "Total vaults");
    expect(total?.value).toBe("3");
    expect(total?.sublabel).toBe("1 live");

    const aum = kpis.find((k) => k.label === "Deployed AUM");
    expect(aum?.value).toBe("$500K");
  });

  it("labels the sum 'Active principal' when no vault is live", () => {
    const kpis = buildVaultsKpiStrip([vault("draft", 250_000)]);
    expect(kpis.find((k) => k.label === "Deployed AUM")).toBeUndefined();
    expect(kpis.find((k) => k.label === "Active principal")?.value).toBe("$250K");
  });

  it("provenance travels from the calculation, never fabricated at render (c2)", () => {
    const kpis = buildVaultsKpiStrip([
      vault("live", 100_000),
      vault("review"),
    ]);

    // Sum/count of operator-recorded Prisma rows → manual.
    expect(kpis.find((k) => k.label === "Total vaults")?.provenance).toBe(
      POSITION_SUM_PROVENANCE,
    );
    expect(kpis.find((k) => k.label === "Deployed AUM")?.provenance).toBe(
      POSITION_SUM_PROVENANCE,
    );
    // Ratio of two manual figures → estimated, never "live".
    expect(kpis.find((k) => k.label === "Capacity used")?.provenance).toBe(
      TARGET_RANGE_PROVENANCE,
    );
    for (const kpi of kpis) {
      expect(kpi.provenance).not.toBe("live");
    }
  });

  it("shows 'In pipeline' only when draft/review rows exist", () => {
    const withPipeline = buildVaultsKpiStrip([vault("live"), vault("review")]);
    expect(withPipeline.find((k) => k.label === "In pipeline")?.value).toBe("1");

    const withoutPipeline = buildVaultsKpiStrip([vault("live"), vault("closed")]);
    expect(withoutPipeline.find((k) => k.label === "In pipeline")).toBeUndefined();
  });

  it("says 'no capacity set' instead of a fabricated 0% when capacity is absent", () => {
    const kpis = buildVaultsKpiStrip([vault("live", 100_000, 0)]);
    const capacity = kpis.find((k) => k.label === "Capacity used");
    expect(capacity?.value).toBe("—");
    expect(capacity?.sublabel).toBe("no capacity set");
  });
});
