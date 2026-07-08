/**
 * Unit tests for src/lib/demo/allowlist.ts
 *
 * No dependencies to mock — isDemoAccount() is a pure lookup against the
 * hard-coded DEMO_EMAILS list.
 */

import { describe, it, expect } from "vitest";

import { isDemoAccount } from "../allowlist";

describe("isDemoAccount", () => {
  it("returns true for the sanctioned Hearst demo account", () => {
    expect(isDemoAccount("adrien+demo@hearstcorporation.io")).toBe(true);
  });

  it("returns true for the Zand demo account", () => {
    expect(isDemoAccount("zand.demo@hearstcorporation.io")).toBe(true);
  });

  it("is case-insensitive for the Zand demo account", () => {
    expect(isDemoAccount("Zand.Demo@HearstCorporation.io")).toBe(true);
  });

  it("is case-insensitive for the original demo account", () => {
    expect(isDemoAccount("Adrien+Demo@HearstCorporation.IO")).toBe(true);
  });

  it("trims surrounding whitespace before matching", () => {
    expect(isDemoAccount("  zand.demo@hearstcorporation.io  ")).toBe(true);
  });

  it("returns false for a real investor email", () => {
    expect(isDemoAccount("lp@hedgefund.io")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isDemoAccount(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isDemoAccount(undefined)).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isDemoAccount("")).toBe(false);
  });
});
