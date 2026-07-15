import { describe, expect, it } from "vitest";
import { decideMode } from "../rebalancing";

// Threshold values mirror rebalancing.ts constants:
// DEFENSIVE: riskScore >= 65 OR marginScore < 50
// OPPORTUNISTIC: riskScore <= 40 AND marginScore >= 75
// BALANCED: everything else

describe("decideMode", () => {
  it("returns defensive when risk score is at or above 65", () => {
    expect(decideMode(65, 60)).toBe("defensive");
    expect(decideMode(90, 80)).toBe("defensive");
  });

  it("returns defensive when margin score is below 50", () => {
    expect(decideMode(50, 49)).toBe("defensive");
    expect(decideMode(30, 10)).toBe("defensive");
  });

  it("returns opportunistic when risk <= 40 and margin >= 75", () => {
    expect(decideMode(40, 75)).toBe("opportunistic");
    expect(decideMode(20, 90)).toBe("opportunistic");
  });

  it("returns balanced under normal conditions", () => {
    expect(decideMode(55, 60)).toBe("balanced");
    expect(decideMode(50, 70)).toBe("balanced");
  });

  it("edge: risk exactly at opportunistic ceiling (40) with margin exactly at floor (75) returns opportunistic", () => {
    expect(decideMode(40, 75)).toBe("opportunistic");
  });

  it("edge: risk = 41 with margin = 80 falls to balanced (just above opportunistic risk ceiling)", () => {
    expect(decideMode(41, 80)).toBe("balanced");
  });

  it("edge: margin exactly at defensive threshold (50) with low risk returns balanced (50 is NOT below 50)", () => {
    expect(decideMode(30, 50)).toBe("balanced");
  });

  it("edge: margin = 49 with low risk returns defensive", () => {
    expect(decideMode(30, 49)).toBe("defensive");
  });

  it("edge: risk = 64 does not trigger defensive on risk alone", () => {
    expect(decideMode(64, 60)).toBe("balanced");
  });
});
