import { describe, expect, it } from "vitest";

import { mapQualificationToHubSpot } from "../map-qualification";
import type { QualificationProfile } from "@prisma/client";

function profile(
  overrides: Partial<QualificationProfile> = {},
): QualificationProfile {
  return {
    id: "qp_1",
    userId: "u_1",
    email: "lp@fund.io",
    source: "typeform",
    platformType: null,
    aum: null,
    fundsUsage: null,
    yieldStatus: null,
    yieldType: null,
    vaultSize: null,
    timeline: null,
    firstName: null,
    lastName: null,
    phone: null,
    website: null,
    rawPayload: null,
    submittedAt: new Date("2026-06-17T14:30:00Z"),
    updatedAt: new Date("2026-06-17T14:30:00Z"),
    ...overrides,
  };
}

describe("mapQualificationToHubSpot", () => {
  it("maps standard + hearst_* properties", () => {
    const props = mapQualificationToHubSpot(
      profile({
        firstName: "Alice",
        lastName: "Dupont",
        phone: "+33600000000",
        website: "https://fund.io",
        platformType: "exchange",
        aum: "10_50m",
        fundsUsage: "mix",
        yieldStatus: "live",
        yieldType: "balanced",
        vaultSize: "500k_1m",
        timeline: "asap",
      }),
    );

    expect(props.firstname).toBe("Alice");
    expect(props.lastname).toBe("Dupont");
    expect(props.phone).toBe("+33600000000");
    expect(props.website).toBe("https://fund.io");
    expect(props.hearst_platform_type).toBe("exchange");
    expect(props.hearst_aum).toBe("10_50m");
    expect(props.hearst_funds_usage).toBe("mix");
    expect(props.hearst_yield_status).toBe("live");
    expect(props.hearst_yield_type).toBe("balanced");
    expect(props.hearst_vault_size).toBe("500k_1m");
    expect(props.hearst_timeline).toBe("asap");
  });

  it("emits hearst_qualified_at as a date (YYYY-MM-DD), not a datetime", () => {
    const props = mapQualificationToHubSpot(profile());
    // HubSpot `date` properties reject a full ISO datetime — must be date-only.
    expect(props.hearst_qualified_at).toBe("2026-06-17");
  });

  it("omits null/undefined fields so existing values are never wiped", () => {
    const props = mapQualificationToHubSpot(profile({ aum: null, firstName: null }));
    expect(props).not.toHaveProperty("hearst_aum");
    expect(props).not.toHaveProperty("firstname");
  });

  it("never includes email (passed separately to the upsert)", () => {
    const props = mapQualificationToHubSpot(profile({ email: "x@y.com" }));
    expect(props).not.toHaveProperty("email");
  });
});
