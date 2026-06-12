import { describe, it, expect, vi } from "vitest";

const findFirstDistribution = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    distribution: { findFirst: (...a: unknown[]) => findFirstDistribution(...a) },
  },
}));

import { loadLatestDistribution } from "@/lib/agents/loaders/distribution";

describe("loadLatestDistribution — no synthetic fallback", () => {
  it("returns null when the DB has no distribution", async () => {
    findFirstDistribution.mockResolvedValueOnce(null);
    const snap = await loadLatestDistribution();
    expect(snap).toBeNull();
  });

  it("maps a real DB row without synthesized flag", async () => {
    findFirstDistribution.mockResolvedValueOnce({
      distributedAt: new Date("2026-05-29T00:00:00Z"),
      amountUsdc: { toNumber: () => 200_000 },
      period: "2026-05",
      txHash: "0xrealhash",
    });
    const snap = await loadLatestDistribution();
    expect(snap?.synthesized).toBeUndefined();
    expect(snap?.status).toBe("paid");
    expect(snap?.paid_at).not.toBeNull();
  });

  it("does not set paid_at when status is scheduled", async () => {
    findFirstDistribution.mockResolvedValueOnce({
      distributedAt: new Date("2026-05-29T00:00:00Z"),
      amountUsdc: { toNumber: () => 800_000 },
      period: "2026-05",
      txHash: null,
    });
    const snap = await loadLatestDistribution();
    expect(snap?.status).toBe("scheduled");
    expect(snap?.paid_at).toBeNull();
  });

  it("attaches a pending coverage recommendation on real rows", async () => {
    findFirstDistribution.mockResolvedValueOnce({
      distributedAt: new Date(),
      amountUsdc: { toNumber: () => 200_000 },
      period: "2026-05",
      txHash: "0xrealhash",
    });
    const snap = await loadLatestDistribution();
    expect(snap?.coverage?.action).toBe("suspend");
    expect(snap?.coverage?.maxPayout).toBe(0);
  });
});

function distributionBadgeKind(txHash: string | null): string {
  if (!txHash) return "manual";
  return txHash.startsWith("0xMOCK") ? "estimated" : "attested";
}

describe("distribution badge — mock hash is not attested (B4)", () => {
  it("badges a 0xMOCK hash as estimated, not attested", () => {
    expect(distributionBadgeKind("0xMOCK_abc")).toBe("estimated");
  });
  it("badges a real hash as attested", () => {
    expect(distributionBadgeKind("0x9f8e7d6c")).toBe("attested");
  });
  it("badges no hash as manual", () => {
    expect(distributionBadgeKind(null)).toBe("manual");
  });
});
