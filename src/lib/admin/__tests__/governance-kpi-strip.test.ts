import { describe, expect, it } from "vitest";

import { buildGovernanceKpiStrip } from "@/lib/admin/governance-kpi-strip";

describe("buildGovernanceKpiStrip", () => {
  it("returns empty when queue is empty", () => {
    expect(buildGovernanceKpiStrip([])).toEqual([]);
  });

  it("counts states from loaded queue", () => {
    const kpis = buildGovernanceKpiStrip([
      { state: "SIGNING" },
      { state: "TIMELOCK" },
      { state: "EXECUTABLE" },
    ]);
    expect(kpis).toHaveLength(4);
    expect(kpis[0]?.value).toBe("3");
    expect(kpis[1]?.value).toBe("1");
    expect(kpis[2]?.value).toBe("1");
    expect(kpis[3]?.value).toBe("1");
  });
});
