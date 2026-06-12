import { describe, expect, it } from "vitest";

import { profileDisplayName } from "@/lib/profile/display-name";
import { formatProfileDate } from "@/lib/profile/format-date";
import { kycBadgeVariant, kycLabel } from "@/lib/profile/kyc-display";

describe("profileDisplayName", () => {
  it("capitalizes the email local-part", () => {
    expect(profileDisplayName("ada@hearst.com")).toBe("Ada");
  });

  it("falls back when local-part is empty", () => {
    expect(profileDisplayName("@hearst.com")).toBe("Investor");
  });
});

describe("formatProfileDate", () => {
  it("formats dates in en-US long form", () => {
    expect(formatProfileDate(new Date(2025, 2, 15))).toBe("March 15, 2025");
  });
});

describe("kyc display helpers", () => {
  it("maps approved status to success badge", () => {
    expect(kycBadgeVariant("approved")).toBe("success");
    expect(kycLabel("approved")).toBe("KYC Approved");
  });

  it("maps pending and rejected statuses", () => {
    expect(kycBadgeVariant("pending")).toBe("warning");
    expect(kycLabel("pending")).toBe("KYC Pending");
    expect(kycBadgeVariant("rejected")).toBe("danger");
    expect(kycLabel("rejected")).toBe("KYC Rejected");
  });

  it("maps unknown status to default label", () => {
    expect(kycBadgeVariant("unknown")).toBe("default");
    expect(kycLabel("unknown")).toBe("unknown");
  });
});
