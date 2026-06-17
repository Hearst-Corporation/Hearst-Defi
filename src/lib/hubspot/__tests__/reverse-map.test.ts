import { describe, expect, it } from "vitest";

import { hubspotPropsToQualification } from "../reverse-map";

describe("hubspotPropsToQualification", () => {
  it("maps hearst_* properties to QualificationProfile columns", () => {
    const out = hubspotPropsToQualification({
      email: "lp@fund.io", // ignored — not a hearst_ field
      hearst_platform_type: "exchange",
      hearst_aum: "10_50m",
      hearst_vault_size: "500k_1m",
      hearst_timeline: "asap",
    });

    expect(out.platformType).toBe("exchange");
    expect(out.aum).toBe("10_50m");
    expect(out.vaultSize).toBe("500k_1m");
    expect(out.timeline).toBe("asap");
    // standard fields never leak through
    expect(out).not.toHaveProperty("email");
  });

  it("only returns keys present in the source (partial update safe)", () => {
    const out = hubspotPropsToQualification({ hearst_aum: "50_250m" });
    expect(Object.keys(out)).toEqual(["aum"]);
    expect(out.aum).toBe("50_250m");
  });

  it("converts empty-string values to null", () => {
    const out = hubspotPropsToQualification({ hearst_timeline: "" });
    expect(out.timeline).toBeNull();
  });

  it("returns an empty object when no hearst_* fields are present", () => {
    const out = hubspotPropsToQualification({ email: "x@y.com", firstname: "X" });
    expect(out).toEqual({});
  });
});
