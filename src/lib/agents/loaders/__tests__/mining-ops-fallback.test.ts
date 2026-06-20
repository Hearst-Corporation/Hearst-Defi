import { describe, it, expect, vi, beforeEach } from "vitest";

// B3 — when the DB has no MiningMetric rows, the ops snapshot is a fallback and
// MUST be flagged so the investor-memo PDF badges it `estimated`, not `attested`.

const mockFindMany = vi.fn().mockResolvedValue([]);
const mockProofCount = vi.fn().mockResolvedValue(0);

vi.mock("@/lib/db", () => ({
  prisma: {
    miningMetric: { findMany: (...args: unknown[]) => mockFindMany(...args) },
    proof: { count: (...args: unknown[]) => mockProofCount(...args) },
  },
}));

vi.mock("@/lib/data/hashprice", () => ({
  fetchHashprice: vi.fn().mockResolvedValue({
    usd_per_th_day: 0,
    stale: true,
  }),
}));

import { loadMiningOpsSnapshot } from "@/lib/agents/loaders/mining";

describe("loadMiningOpsSnapshot — fallback flagging (B3)", () => {
  beforeEach(() => {
    mockFindMany.mockResolvedValue([]);
    mockProofCount.mockResolvedValue(0);
  });

  it("sets is_fallback=true when there are no operator rows", async () => {
    const snap = await loadMiningOpsSnapshot();
    expect(snap.is_fallback).toBe(true);
  });

  it("sets is_fallback=true when Prisma transport fails", async () => {
    mockFindMany.mockRejectedValue(new Error("timeout exceeded when trying to connect"));
    const snap = await loadMiningOpsSnapshot();
    expect(snap.is_fallback).toBe(true);
    expect(snap.hashrate_ph_s).toBe(0);
  });
});
