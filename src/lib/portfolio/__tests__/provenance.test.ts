import { describe, expect, it } from "vitest";

import {
  coercePortfolioDate,
  resolveProvenance,
} from "@/lib/portfolio/provenance";

describe("coercePortfolioDate", () => {
  it("parses ISO strings from unstable_cache JSON round-trip", () => {
    const iso = "2026-06-12T02:01:27.565Z";
    const parsed = coercePortfolioDate(iso);
    expect(parsed).toBeInstanceOf(Date);
    expect(parsed?.toISOString()).toBe(iso);
  });

  it("returns null for invalid values", () => {
    expect(coercePortfolioDate(null)).toBeNull();
    expect(coercePortfolioDate(undefined)).toBeNull();
    expect(coercePortfolioDate("not-a-date")).toBeNull();
  });
});

describe("resolveProvenance — cached date strings", () => {
  it("does not throw when updatedAt is an ISO string", () => {
    const fresh = new Date().toISOString();
    expect(() =>
      resolveProvenance("live", fresh, "estimated"),
    ).not.toThrow();
    expect(resolveProvenance("live", fresh, "estimated")).toBe("estimated");
  });
});
