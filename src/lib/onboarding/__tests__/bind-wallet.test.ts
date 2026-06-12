import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/require-investor", () => ({
  requireInvestor: vi.fn().mockResolvedValue({ userId: "user_1" }),
}));

vi.mock("@/lib/auth/session", () => ({
  getInvestor: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    investor: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { getInvestor } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { bindWallet } from "@/lib/onboarding/actions";

const INVESTOR = {
  id: "inv_1",
  userId: "user_1",
  walletAddress: null,
  email: "lp@test.io",
  kycStatus: "approved",
  accreditationAttestedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("bindWallet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getInvestor).mockResolvedValue(INVESTOR);
    vi.mocked(prisma.investor.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.investor.update).mockResolvedValue(INVESTOR);
  });

  it("persists a valid EVM address", async () => {
    const result = await bindWallet("0xAbCdEf0123456789AbCdEf0123456789AbCdEf01");

    expect(result).toEqual({ ok: true });
    expect(prisma.investor.update).toHaveBeenCalledWith({
      where: { id: "inv_1" },
      data: { walletAddress: "0xabcdef0123456789abcdef0123456789abcdef01" },
    });
  });

  it("rejects invalid addresses", async () => {
    const result = await bindWallet("not-an-address");
    expect(result).toEqual({ ok: false, error: "Invalid wallet address." });
    expect(prisma.investor.update).not.toHaveBeenCalled();
  });

  it("rejects wallets already linked to another investor", async () => {
    vi.mocked(prisma.investor.findFirst).mockResolvedValue({ id: "other" } as never);

    const result = await bindWallet("0xAbCdEf0123456789AbCdEf0123456789AbCdEf01");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("already linked");
    }
  });
});
