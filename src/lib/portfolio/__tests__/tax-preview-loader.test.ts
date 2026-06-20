import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", () => ({
  prisma: {
    position: {
      findMany: vi.fn().mockResolvedValue([
        {
          principalUsdc: 250_000,
          accruedYieldUsdc: 5_000,
          subscribedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]),
    },
    investorTransaction: {
      findMany: vi.fn().mockResolvedValue([
        { amountUsdc: 3_500 },
        { amountUsdc: 1_500 },
      ]),
    },
  },
}));

vi.mock("@/lib/auth/session", () => ({
  getInvestor: vi.fn().mockResolvedValue({ id: "inv_test_01" }),
}));

import { loadTaxPreview } from "@/lib/portfolio/tax-preview-loader";

describe("loadTaxPreview", () => {
  it("passes real ledger overrides instead of stub seed", async () => {
    const preview = await loadTaxPreview(2026);
    expect(preview).not.toBeNull();
    expect(preview!.form1099Int.interestIncomeUsd).toBe(5_000);
    expect(preview!.docStatus).toBe("preview");
  });
});
