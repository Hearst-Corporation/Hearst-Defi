import { describe, expect, it } from "vitest";

import type {
  DistributionSnapshot,
  MiningOpsSnapshot,
  VaultMonthlyRow,
} from "@/lib/pdf/memo-data";
import { getMockMemoInput } from "./memo-input.fixture";
import { periodFromIso } from "@/lib/pdf/memo-data";

const miningOps: MiningOpsSnapshot = {
  hashrate_ph_s: 182,
  uptime_pct: 98.4,
  margin_score: 64,
  attestations_count: 1,
};

const distribution: DistributionSnapshot = {
  period: "2026-01",
  amount_usdc: 196_800,
  paid_at: new Date("2026-01-10T12:00:00Z"),
  status: "paid",
};

const monthlyHistory: VaultMonthlyRow[] = [
  {
    period: "2025-10",
    apy_low: 9.0,
    apy_high: 12.5,
    apy_achieved: 10.6,
    nav_usdc: 24_200_000,
    distribution_usdc: 193_600,
  },
  {
    period: "2025-11",
    apy_low: 9.2,
    apy_high: 12.6,
    apy_achieved: 10.9,
    nav_usdc: 24_400_000,
    distribution_usdc: 195_200,
  },
  {
    period: "2025-12",
    apy_low: 9.3,
    apy_high: 12.7,
    apy_achieved: 11.1,
    nav_usdc: 24_550_000,
    distribution_usdc: 196_400,
  },
  {
    period: "2026-01",
    apy_low: 9.4,
    apy_high: 12.8,
    apy_achieved: 11.2,
    nav_usdc: 24_700_000,
    distribution_usdc: 197_600,
  },
];

describe("MemoDocument PDF rendering", () => {
  it("renders the 8-page investor memo to a non-trivial PDF buffer", async () => {
    // Dynamic imports keep react-pdf out of the module graph for the other
    // tests in this repo and make sure the smoke test only runs when this
    // file is collected.
    const { renderToBuffer } = await import("@react-pdf/renderer");
    const { MemoDocument } = await import("@/lib/pdf/memo-template");

    const input = getMockMemoInput();
    const generatedAt = "2026-01-15T00:00:00.000Z";
    const period = periodFromIso(generatedAt);

    const buf = await renderToBuffer(
      MemoDocument({
        data: {
          input,
          memo: null,
          generatedAt,
          period,
          miningOps,
          distribution,
          monthlyHistory,
        },
      }),
    );

    // Sanity: it's a real PDF (starts with %PDF-) and is at least 10kB.
    expect(buf.length).toBeGreaterThan(10_000);
    expect(buf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  }, 30_000);
});
