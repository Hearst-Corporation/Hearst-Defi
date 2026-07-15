import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    miningMetric: { findFirst: vi.fn() },
    vaultSnapshot: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/product-routes", () => ({
  getProductRoutes: vi.fn(),
}));

vi.mock("@/lib/spec", () => ({
  getSpecIndex: vi.fn(),
}));

vi.mock("@/lib/feature-flags", () => ({
  FEATURE_FLAGS: { CHAT_MASTER_AGENT: true },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

import { prisma } from "@/lib/db";
import { getProductRoutes } from "@/lib/product-routes";
import { getSpecIndex } from "@/lib/spec";
import { logger } from "@/lib/logger";
import { buildAdminContextBlock } from "@/lib/llm/admin-context";

const mockMining = vi.mocked(prisma.miningMetric.findFirst);
const mockSnapshot = vi.mocked(prisma.vaultSnapshot.findFirst);
const mockRoutes = vi.mocked(getProductRoutes);
const mockSpecs = vi.mocked(getSpecIndex);
const mockWarn = vi.mocked(logger.warn);

describe("buildAdminContextBlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMining.mockResolvedValue({
      takenAt: new Date("2026-06-12T10:00:00.000Z"),
      btcPrice: 69250,
      hashprice: 0.082,
      difficulty: 90231234,
      energyCost: 0.05,
      uptimePct: 98.7,
      miningMarginScore: 64,
    } as never);
    mockSnapshot.mockResolvedValue({
      takenAt: new Date("2026-06-12T09:00:00.000Z"),
      aumUsdc: 24600000,
      currentApyLow: 8,
      currentApyHigh: 15,
      stressedApy: 4.5,
      riskScore: 44,
      miningMarginScore: 61,
      mode: "balanced",
      source: "computed",
    } as never);
    mockRoutes.mockResolvedValue(["/portfolio", "/vaults", "/proof-center"]);
    mockSpecs.mockResolvedValue([
      { slug: "01-dashboard", title: "Dashboard", order: 1 },
      { slug: "09-agents", title: "Agents", order: 9 },
    ]);
  });

  it("includes allocations, market snapshot, indexes, and capability lines", async () => {
    const block = await buildAdminContextBlock();
    expect(block).toContain("ADMIN LIVE CONTEXT");
    expect(block).toContain("CANONICAL ALLOCATIONS");
    expect(block).toContain("HYV: mining 40%");
    expect(block).toContain("MARKET SNAPSHOT");
    expect(block).toContain("btc_price_usd: 69250");
    expect(block).toContain("apy_target_range: 8.00% to 15.00%");
    expect(block).toContain("- /portfolio");
    expect(block).toContain("09-agents");
    expect(block).toContain("live_internet_tooled: yes");
  });

  it("degrades gracefully when no db rows are available", async () => {
    mockMining.mockResolvedValue(null);
    mockSnapshot.mockResolvedValue(null);
    const block = await buildAdminContextBlock();
    expect(block).toContain("unavailable: no MiningMetric row");
    expect(block).toContain("unavailable: no VaultSnapshot row");
  });

  it("continues on partial tool failure and logs a warning", async () => {
    mockMining.mockRejectedValue(new Error("db unavailable"));
    const block = await buildAdminContextBlock();
    expect(block).toContain("TOOL UNAVAILABLE (read_market_snapshot)");
    expect(block).toContain("CANONICAL ALLOCATIONS");
    expect(block).toContain("ROUTES INDEX (sample)");
    expect(mockWarn).toHaveBeenCalledWith(
      "admin-context tool execution failed — continuing with partial context",
      { toolId: "read_market_snapshot" },
      expect.any(Error),
    );
  });
});
