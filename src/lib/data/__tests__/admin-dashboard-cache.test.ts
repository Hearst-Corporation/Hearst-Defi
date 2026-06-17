import { describe, expect, it } from "vitest";

import { readPrismaDecimal } from "@/lib/data/admin-dashboard-cache";

describe("readPrismaDecimal", () => {
  it("reads plain numbers and numeric strings after unstable_cache JSON", () => {
    expect(readPrismaDecimal(42)).toBe(42);
    expect(readPrismaDecimal("12.5")).toBe(12.5);
  });

  it("delegates to Prisma Decimal when present", () => {
    expect(readPrismaDecimal({ toNumber: () => 7.25 })).toBe(7.25);
  });

  it("returns fallback for nullish values", () => {
    expect(readPrismaDecimal(null)).toBe(0);
    expect(readPrismaDecimal(undefined, 3)).toBe(3);
  });
});
