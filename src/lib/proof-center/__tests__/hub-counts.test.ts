import { describe, expect, it, vi } from "vitest";

import { loadProofHubColdCounts } from "@/lib/proof-center/hub-counts";

vi.mock("@/lib/db", () => ({
  prisma: {
    proof: { count: vi.fn() },
    governanceProposal: { count: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";

describe("loadProofHubColdCounts", () => {
  it("returns DB counts for proofs and timelock proposals", async () => {
    vi.mocked(prisma.proof.count).mockResolvedValue(3);
    vi.mocked(prisma.governanceProposal.count).mockResolvedValue(1);
    const counts = await loadProofHubColdCounts();
    expect(counts).toEqual({ proofsCount: 3, timelockCount: 1 });
  });

  it("returns zero counts when DB is empty", async () => {
    vi.mocked(prisma.proof.count).mockResolvedValue(0);
    vi.mocked(prisma.governanceProposal.count).mockResolvedValue(0);
    const counts = await loadProofHubColdCounts();
    expect(counts).toEqual({ proofsCount: 0, timelockCount: 0 });
  });
});
