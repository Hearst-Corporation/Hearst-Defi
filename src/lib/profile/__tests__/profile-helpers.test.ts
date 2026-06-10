import { describe, expect, it } from "vitest";

import { profileDisplayName } from "@/lib/profile/display-name";
import { kycBadgeVariant, kycLabel } from "@/lib/profile/kyc-display";

describe("profileDisplayName", () => {
  it("capitalizes the email local-part", () => {
    expect(profileDisplayName("ada@hearst.com")).toBe("Ada");
  });

  it("falls back when local-part is empty", () => {
    expect(profileDisplayName("@hearst.com")).toBe("Investor");
  });
});

describe("kyc display helpers", () => {
  it("maps approved status to success badge", () => {
    expect(kycBadgeVariant("approved")).toBe("success");
    expect(kycLabel("approved")).toBe("KYC Approved");
  });

  it("maps unknown status to default label", () => {
    expect(kycBadgeVariant("unknown")).toBe("default");
    expect(kycLabel("unknown")).toBe("unknown");
  });
});
