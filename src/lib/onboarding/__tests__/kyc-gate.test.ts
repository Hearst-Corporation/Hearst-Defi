import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const findFirstMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    kycInquiry: { findFirst: findFirstMock },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { logger } from "@/lib/logger";
import { resolveKycWalletGate } from "@/lib/onboarding/kyc-gate";

const P2021 = Object.assign(new Error("table does not exist"), { code: "P2021" });

describe("resolveKycWalletGate", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    vi.mocked(logger.warn).mockReset();
    vi.mocked(logger.error).mockReset();
    vi.stubEnv("NODE_ENV", "development");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns passed when a KycInquiry row exists", async () => {
    findFirstMock.mockResolvedValue({ inquiryId: "inq_1" });
    await expect(resolveKycWalletGate("user-1")).resolves.toBe("passed");
  });

  it("returns requires_identity when table works but no inquiry exists", async () => {
    findFirstMock.mockResolvedValue(null);
    await expect(resolveKycWalletGate("user-1")).resolves.toBe("requires_identity");
  });

  it("skips the gate in non-production when KycInquiry table is missing", async () => {
    findFirstMock.mockRejectedValue(P2021);
    await expect(resolveKycWalletGate("user-1")).resolves.toBe("gate_skipped");
    expect(logger.warn).toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("returns db_unavailable in production runtime when table is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    findFirstMock.mockRejectedValue(P2021);
    await expect(resolveKycWalletGate("user-1")).resolves.toBe("db_unavailable");
    expect(logger.error).toHaveBeenCalled();
  });

  it("does not treat build phase as production runtime for missing table", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    findFirstMock.mockRejectedValue(P2021);
    await expect(resolveKycWalletGate("user-1")).resolves.toBe("gate_skipped");
    expect(logger.warn).toHaveBeenCalled();
  });

  it("rethrows non-P2021 errors", async () => {
    findFirstMock.mockRejectedValue(new Error("connection refused"));
    await expect(resolveKycWalletGate("user-1")).rejects.toThrow("connection refused");
  });
});
