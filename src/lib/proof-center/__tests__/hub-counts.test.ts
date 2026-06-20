import { describe, expect, it, vi } from "vitest";

import { DEMO_PROOF_ITEM_COUNT } from "@/lib/demo/builders";
import { loadProofHubColdCounts } from "@/lib/proof-center/hub-counts";

vi.mock("@/lib/db", () => ({
  prisma: {
    proof: { count: vi.fn() },
    governanceProposal: { count: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";

describe("loadProofHubColdCounts", () => {
  it("admin demo=true: returns demo constants without DB", async () => {
    const counts = await loadProofHubColdCounts(true);
    expect(counts).toEqual({
      proofsCount: DEMO_PROOF_ITEM_COUNT,
      timelockCount: 0,
    });
    expect(prisma.proof.count).not.toHaveBeenCalled();
  });

  it("no args (investor path): uses count queries", async () => {
    vi.mocked(prisma.proof.count).mockResolvedValue(3);
    vi.mocked(prisma.governanceProposal.count).mockResolvedValue(1);
    const counts = await loadProofHubColdCounts();
    expect(counts).toEqual({ proofsCount: 3, timelockCount: 1 });
  });

  it("admin demo=false: uses count queries", async () => {
    vi.mocked(prisma.proof.count).mockResolvedValue(3);
    vi.mocked(prisma.governanceProposal.count).mockResolvedValue(1);
    const counts = await loadProofHubColdCounts(false);
    expect(counts).toEqual({ proofsCount: 3, timelockCount: 1 });
  });
});
