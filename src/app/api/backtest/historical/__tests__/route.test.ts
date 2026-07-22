/**
 * Integration tests for GET /api/backtest/historical.
 *
 * VAULT_SPEC_V2.1.md §5 lists this endpoint; the v2.1 contract has no backtest
 * function, so it never touches src/lib/chain/dynavault.ts -- it queries the
 * caller's own BacktestRun rows and reports honestly when there are none,
 * rather than fabricating a historical series.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: vi.fn() }));

vi.mock("@/lib/rate-limit", () => ({
  assertRateLimit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    backtestRun: {
      findMany: vi.fn(),
    },
  },
}));

import { GET } from "@/app/api/backtest/historical/route";
import { requireAuth } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import { assertRateLimit } from "@/lib/rate-limit";

const mockAuth = vi.mocked(requireAuth);
const mockRateLimit = vi.mocked(assertRateLimit);
const mockFindMany = vi.mocked(prisma.backtestRun.findMany);

function setUp(): void {
  mockAuth.mockResolvedValue({ userId: "u1" });
  mockRateLimit.mockResolvedValue(undefined);
  mockFindMany.mockResolvedValue([]);
}

beforeEach(() => {
  vi.clearAllMocks();
  setUp();
});

describe("GET /api/backtest/historical -- auth gate", () => {
  it("401s before any DB read when there is no session", async () => {
    mockAuth.mockRejectedValue(new Error("Authentication required."));

    const res = await GET();

    expect(res.status).toBe(401);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("429s when rate limited, without reading the DB", async () => {
    mockRateLimit.mockRejectedValue(
      new Error("Rate limit exceeded. Try again in 30s."),
    );

    const res = await GET();

    expect(res.status).toBe(429);
    expect(mockFindMany).not.toHaveBeenCalled();
  });
});

describe("GET /api/backtest/historical -- honesty", () => {
  it("reports unavailable / not_available when the caller has no runs, never a fabricated series", async () => {
    mockFindMany.mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ status: "unavailable", reason: "not_available" });
  });

  it("scopes the query to the authenticated caller only", async () => {
    await GET();

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1" } }),
    );
  });

  it("serializes Decimal fields as strings, never a fabricated number", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "run1",
        backtestKey: "bear_2022",
        ranAt: new Date("2026-07-01T00:00:00.000Z"),
        rulesMode: "hearst_rules",
        initialCapital: { toString: () => "10000" },
        endingValue: { toString: () => "10500" },
        totalReturnPct: { toString: () => "5.0" },
        maxDrawdownPct: { toString: () => "-3.2" },
        worstMonthPct: { toString: () => "-1.1" },
        numRebalances: 4,
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
        updatedAt: new Date("2026-07-01T00:00:00.000Z"),
        userId: "u1",
        monthlySeries: "[]",
        narrative: null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Decimal stand-in for the mock
      } as any,
    ]);

    const body = await (await GET()).json();

    expect(body.status).toBe("available");
    expect(body.runs).toHaveLength(1);
    expect(body.runs[0]).toEqual({
      id: "run1",
      backtestKey: "bear_2022",
      ranAt: "2026-07-01T00:00:00.000Z",
      rulesMode: "hearst_rules",
      initialCapital: "10000",
      endingValue: "10500",
      totalReturnPct: "5.0",
      maxDrawdownPct: "-3.2",
      worstMonthPct: "-1.1",
      numRebalances: 4,
    });
  });
});

describe("GET /api/backtest/historical -- errors", () => {
  it("500s generically and never leaks the error message", async () => {
    mockFindMany.mockRejectedValue(new Error("secret internals at 10.0.0.1"));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Internal error" });
    expect(JSON.stringify(body)).not.toContain("10.0.0.1");
  });
});
