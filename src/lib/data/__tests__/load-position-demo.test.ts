/**
 * D6 — loadPosition() must serve the demo position for the recognized demo
 * identity instead of 404-ing (/portfolio/[positionId] would otherwise call
 * notFound()). Guard-gated: only when the demo provider is enabled and the
 * positionId is DEMO_POSITION_ID.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEMO_INVESTOR_EMAIL, DEMO_POSITION_ID } from "@/lib/dev/investor-demo";

const getInvestor = vi.fn();
const positionFindFirst = vi.fn();
const txFindMany = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getInvestor: () => getInvestor(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    position: { findFirst: (...a: unknown[]) => positionFindFirst(...a) },
    investorTransaction: { findMany: (...a: unknown[]) => txFindMany(...a) },
  },
}));

import { loadPosition } from "@/lib/data/portfolio";

beforeEach(() => {
  vi.clearAllMocks();
  // Enable the demo provider for this test only (non-prod + explicit opt-in).
  // vi.stubEnv handles the read-only NODE_ENV and is reverted in afterEach.
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("DEMO_PROVIDER_ENABLED", "1");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("loadPosition — demo provider", () => {
  it("returns the synthetic demo detail for DEMO_POSITION_ID (no 404, no DB hit)", async () => {
    getInvestor.mockResolvedValue({ id: "demo-inv", email: DEMO_INVESTOR_EMAIL });

    const detail = await loadPosition(DEMO_POSITION_ID);

    expect(detail).not.toBeNull();
    expect(detail?.id).toBe(DEMO_POSITION_ID);
    expect(detail?.source).toBe("fallback");
    expect(detail?.txHashOpen).toBeNull();
    expect(detail?.principalUsdc).toBe(500_000);
    // Demo branch short-circuits BEFORE any Prisma query.
    expect(positionFindFirst).not.toHaveBeenCalled();
    expect(txFindMany).not.toHaveBeenCalled();
  });

  it("falls through to the DB loader for a non-demo positionId", async () => {
    getInvestor.mockResolvedValue({ id: "demo-inv", email: DEMO_INVESTOR_EMAIL });
    positionFindFirst.mockResolvedValue(null);
    txFindMany.mockResolvedValue([]);

    const detail = await loadPosition("some-other-position");

    expect(detail).toBeNull();
    expect(positionFindFirst).toHaveBeenCalledOnce();
  });

  it("does not serve the demo detail to a non-demo investor", async () => {
    getInvestor.mockResolvedValue({ id: "real-inv", email: "real@investor.com" });
    positionFindFirst.mockResolvedValue(null);
    txFindMany.mockResolvedValue([]);

    const detail = await loadPosition(DEMO_POSITION_ID);

    expect(detail).toBeNull();
    expect(positionFindFirst).toHaveBeenCalledOnce();
  });
});
