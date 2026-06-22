import { describe, expect, it } from "vitest";

import {
  formatBtcPostureLabel,
  isVaultRiskMode,
  resolveVaultBtcPosture,
} from "@/lib/admin/cockpit-btc-posture";

describe("resolveVaultBtcPosture", () => {
  it("accepts explicit tactical postures only", () => {
    expect(resolveVaultBtcPosture("neutral")).toBe("neutral");
    expect(resolveVaultBtcPosture("long")).toBe("long");
    expect(resolveVaultBtcPosture("short")).toBe("short");
    expect(resolveVaultBtcPosture("hedge")).toBe("hedge");
  });

  it("does not map vault risk modes to BTC posture", () => {
    expect(resolveVaultBtcPosture("balanced")).toBeNull();
    expect(resolveVaultBtcPosture("defensive")).toBeNull();
    expect(resolveVaultBtcPosture("opportunistic")).toBeNull();
  });

  it("returns null when no explicit posture feed exists", () => {
    expect(resolveVaultBtcPosture(null)).toBeNull();
    expect(resolveVaultBtcPosture(undefined)).toBeNull();
    expect(resolveVaultBtcPosture("")).toBeNull();
  });
});

describe("isVaultRiskMode", () => {
  it("flags snapshot mode values that must not become BTC labels", () => {
    expect(isVaultRiskMode("balanced")).toBe(true);
    expect(isVaultRiskMode("opportunistic")).toBe(true);
    expect(isVaultRiskMode("neutral")).toBe(false);
  });
});

describe("formatBtcPostureLabel", () => {
  it("labels unavailable honestly", () => {
    expect(formatBtcPostureLabel(null)).toBe("Unavailable");
  });

  it("capitalizes known postures", () => {
    expect(formatBtcPostureLabel("long")).toBe("Long");
  });
});
