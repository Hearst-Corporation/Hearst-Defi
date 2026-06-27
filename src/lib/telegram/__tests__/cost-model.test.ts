import { describe, it, expect } from "vitest";

import {
  parseMachinePriceMessage,
  parsePriceLine,
  parseListDate,
} from "../parse-machine-price";
import { resolveCooling } from "../model-catalog";
import {
  computeMachineEconomics,
  feesForDestination,
  CUSTOMS_DUTY_PCT,
  FREIGHT_USD_PER_UNIT,
  ENERGY_COST_USD_PER_KWH,
  AMORT_MONTHS,
  DAYS_PER_MONTH,
  DEFAULT_UPTIME,
  type LandedFee,
} from "../cost-model";

describe("parseListDate", () => {
  it("parses Letine date header", () => {
    expect(parseListDate("Letine Mining Update Miner Price (26th June. 2026):")).toBe(
      "2026-06-26",
    );
    expect(parseListDate("25th June. 2026")).toBe("2026-06-25");
  });
});

describe("parsePriceLine", () => {
  it("parses a unit price line with hashrate and efficiency", () => {
    const s = parsePriceLine("S21++ 235T: $1551 (6.6U/T)", "air");
    expect(s).not.toBeNull();
    expect(s!.model).toBe("S21++ 235T");
    expect(s!.thPerUnit).toBe(235);
    expect(s!.priceUsd).toBe(1551);
    expect(s!.cooling).toBe("air");
  });

  it("parses a per-TH price line (Whatsminer)", () => {
    const s = parsePriceLine("M63S 18.5W 372/374/390/406T: $6.6/T", "unknown");
    expect(s).not.toBeNull();
    expect(s!.thPerUnit).toBe(406); // last/first? parser takes first match
    expect(s!.perThUsd).toBe(6.6);
    expect(s!.efficiencyJTh).toBe(18.5);
  });

  it("derives perTh from unit price", () => {
    const s = parsePriceLine("Avalon Q 90T: $1365", "unknown");
    expect(s!.priceUsd).toBe(1365);
    expect(s!.perThUsd).toBeCloseTo(1365 / 90, 3);
  });

  it("returns null when no price", () => {
    expect(parsePriceLine("*Air Cooling*", "air")).toBeNull();
  });
});

describe("resolveCooling catalog", () => {
  it("keeps label cooling when present", () => {
    expect(resolveCooling("S21+ Hyd 358T", "hydro").cooling).toBe("hydro");
    expect(resolveCooling("S21+ Hyd 358T", "hydro").source).toBe("label");
  });
  it("classifies Whatsminer families from catalog", () => {
    expect(resolveCooling("M63S 18.5W 406T", "unknown").cooling).toBe("hydro");
    expect(resolveCooling("M70 14.5W 240T", "unknown").cooling).toBe("air");
    expect(resolveCooling("M7DS 13.5W 696T", "unknown").cooling).toBe("hydro");
    expect(resolveCooling("M60s+ 17W 208T", "unknown").cooling).toBe("air");
  });
  it("classifies Avalon as air", () => {
    expect(resolveCooling("Avalon Q 90T", "unknown").cooling).toBe("air");
  });
  it("never returns unknown", () => {
    for (const m of ["RandomMiner X 100T", "Foo 5T"]) {
      expect(resolveCooling(m, "unknown").cooling).not.toBe("unknown");
    }
  });
});

describe("computeMachineEconomics — energy at 6¢, ex-works base", () => {
  it("uses 6 cents per kWh by default", () => {
    expect(ENERGY_COST_USD_PER_KWH).toBe(0.06);
  });

  it("computes air S21++ capex on 36-month amortization (pure ex-works)", () => {
    const sample = parsePriceLine("S21++ 235T: $1551 (6.6U/T)", "air")!;
    const e = computeMachineEconomics(sample, []); // no fees
    expect(e.cooling).toBe("air");
    expect(e.amortMonths).toBe(36);
    expect(e.landedUsd).toBe(1551);
    expect(e.feesUsd).toBe(0);
    const expectedCapex = 1551 / 235 / (36 * DAYS_PER_MONTH);
    expect(e.capexUsdPerThDay).toBeCloseTo(expectedCapex, 6);
  });

  it("computes hydro on 60-month amortization", () => {
    const sample = parsePriceLine("S21+ Hyd 358T: $2273 (6.35U/T)", "hydro")!;
    const e = computeMachineEconomics(sample, []);
    expect(e.amortMonths).toBe(60);
    expect(AMORT_MONTHS.hydro).toBe(60);
  });

  it("computes energy from efficiency at 6¢/kWh (independent of fees)", () => {
    // 18.5 J/TH = 18.5 W/TH → 18.5*24/1000 = 0.444 kWh/TH/day
    const sample = parsePriceLine("M63S 18.5W 406T: $6.6/T", "unknown")!;
    const e = computeMachineEconomics(sample, []);
    const expectedEnergy = (18.5 * 24) / 1000 * 0.06 * DEFAULT_UPTIME;
    expect(e.energyUsdPerThDay).toBeCloseTo(expectedEnergy, 6);
    expect(e.totalCostUsdPerThDay).toBeCloseTo(
      e.capexUsdPerThDay + expectedEnergy,
      6,
    );
  });

  it("returns null energy when efficiency unknown", () => {
    const sample = parsePriceLine("Avalon Q 90T: $1365", "unknown")!;
    const e = computeMachineEconomics(sample, []);
    expect(e.efficiencyJTh).toBeNull();
    expect(e.energyUsdPerThDay).toBeNull();
    expect(e.totalCostUsdPerThDay).toBeNull();
  });
});

describe("destination fees — freight $100 + country customs", () => {
  const sample = parsePriceLine("S21++ 235T: $1551 (6.6U/T)", "air")!;

  it("USA: freight $100 + 27.6% customs", () => {
    const e = computeMachineEconomics(sample, feesForDestination("usa"));
    expect(CUSTOMS_DUTY_PCT.usa).toBe(27.6);
    const expected = FREIGHT_USD_PER_UNIT + 1551 * 0.276;
    expect(e.feesUsd).toBeCloseTo(expected, 2);
    expect(e.landedUsd).toBeCloseTo(1551 + expected, 2);
  });

  it("France/EU: freight only (0% customs)", () => {
    const e = computeMachineEconomics(sample, feesForDestination("france"));
    expect(CUSTOMS_DUTY_PCT.france).toBe(0);
    expect(e.feesUsd).toBeCloseTo(FREIGHT_USD_PER_UNIT, 2);
  });

  it("UAE default: freight + 5% customs", () => {
    const e = computeMachineEconomics(sample, feesForDestination("uae"));
    const expected = FREIGHT_USD_PER_UNIT + 1551 * 0.05;
    expect(e.feesUsd).toBeCloseTo(expected, 2);
  });
});

describe("landed fees library", () => {
  const sample = parsePriceLine("S21++ 235T: $1551 (6.6U/T)", "air")!;

  it("adds customs as percent of ex-works", () => {
    const fees: LandedFee[] = [
      { id: "customs", label: "Douane", kind: "customs", mode: "pct", amount: 5, enabled: true },
    ];
    const e = computeMachineEconomics(sample, fees);
    expect(e.feesUsd).toBeCloseTo(1551 * 0.05, 2);
    expect(e.landedUsd).toBeCloseTo(1551 * 1.05, 2);
  });

  it("adds freight per TH and install flat, raising capex", () => {
    const fees: LandedFee[] = [
      { id: "freight", label: "Port", kind: "freight", mode: "usdPerTh", amount: 1, enabled: true },
      { id: "install", label: "Install", kind: "install", mode: "usdFlat", amount: 80, enabled: true },
    ];
    const e = computeMachineEconomics(sample, fees);
    expect(e.feesUsd).toBeCloseTo(1 * 235 + 80, 2);
    expect(e.landedUsd).toBeGreaterThan(e.exWorksUsd);
  });

  it("empty fee array = pure ex-works", () => {
    const e = computeMachineEconomics(sample, []);
    expect(e.landedUsd).toBe(e.exWorksUsd);
  });

  it("ignores a disabled fee", () => {
    const fees: LandedFee[] = [
      { id: "x", label: "x", kind: "other", mode: "usdFlat", amount: 500, enabled: false },
    ];
    const e = computeMachineEconomics(sample, fees);
    expect(e.feesUsd).toBe(0);
  });
});

describe("full message parse", () => {
  const msg = `Letine Mining Update Miner Price (26th June. 2026):
*Antminer BTC Miners*
*Air Cooling*
S21++ 235T: $1551 (6.6U/T)
*Hydro Cooling*
S21+ Hyd 358T: $2273 (6.35U/T)
*Whatsminer BTC Miners*
M63S 18.5W 372/374/390T: $6.6/T`;

  it("parses date and all samples", () => {
    const parsed = parseMachinePriceMessage(msg);
    expect(parsed.listDate).toBe("2026-06-26");
    expect(parsed.samples.length).toBe(3);
    const byModel = Object.fromEntries(parsed.samples.map((s) => [s.model, s]));
    expect(byModel["S21++ 235T"]!.cooling).toBe("air");
    expect(byModel["S21+ Hyd 358T"]!.cooling).toBe("hydro");
  });

  it("tags region: main list = china, USA Stock section = usa", () => {
    const withUsa = `Letine Price (26th June. 2026):
*Air Cooling*
S21++ 235T: $1551 (6.6U/T)
*USA Stock*
S21++ 235T: $7.9/T
Avalon Q 90T: $1299`;
    const parsed = parseMachinePriceMessage(withUsa);
    expect(parsed.samples.filter((s) => s.region === "china").length).toBe(1);
    expect(parsed.samples.filter((s) => s.region === "usa").length).toBe(2);
    const s21 = parsed.samples.filter((s) => s.model === "S21++ 235T");
    expect(s21.length).toBe(2);
    expect(s21.map((s) => s.region).sort()).toEqual(["china", "usa"]);
  });
});
