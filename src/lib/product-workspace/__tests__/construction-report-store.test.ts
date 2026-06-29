import { describe, expect, it, vi, beforeEach } from "vitest";

const upsert = vi.fn().mockResolvedValue({});
const findUnique = vi.fn().mockResolvedValue(null);
vi.mock("@/lib/db", () => ({
  prisma: { vaultDraft: { upsert: (a: unknown) => upsert(a), findUnique: (a: unknown) => findUnique(a) } },
}));

import {
  saveConstructionReport,
  loadConstructionReport,
} from "@/lib/product-workspace/construction-report-store";
import type { ProductConstructionDraft } from "@/lib/agentic/swarm/live/types";

function draft(over: Partial<ProductConstructionDraft> = {}): ProductConstructionDraft {
  return {
    objective: "BTC yield vault",
    vault: { ticker: "HYV", label: "Hearst Yield Vault" },
    telegram: { configured: true, machineCount: 57, topMachine: "S21" },
    market: { btcUsd: 60000, hashpriceUsdPerThDay: 0.05, defiApyMedianPct: 10 },
    strategy: {
      configured: true,
      miningYieldPct: 14,
      usdcYieldPct: 6,
      usdcSource: "aave",
      btcReturn: { bear: -20, base: 10, bull: 40 },
      headlineApy: { low: 9.4, high: 12.8 },
      assumptions: ["a1"],
      disclaimer: "not guaranteed",
      companyLevers: {
        source: "config",
        status: "CONFIGURED",
        markupPct: 25,
        revenueSharePct: 20,
        borrowAprPct: 6,
        feePct: 2,
        energyCostUsdPerKwh: 0.06,
      },
      provenance: "Live",
    },
    quant: {
      seed: 42,
      paths: 5000,
      horizonMonths: 12,
      percentiles: { p5: 0.06, p25: 0.094, p50: 0.111, p75: 0.128, p95: 0.16 },
      headlineRange: { low: 0.094, high: 0.128 },
      probBelowFloorPct: 8,
      floorApyPct: 8,
      provenance: "Live",
    },
    assumptions: {
      paths: 5000,
      horizonMonths: 12,
      floorApyPct: 8,
      btc: { annualDrift: 0.1, annualVol: 0.6 },
      difficulty: { reversionSpeed: 0.8, longRunMultiple: 1.15, annualVol: 0.25, minMultiple: 0.6, maxMultiple: 2.0 },
      yield: { miningWeight: 0.6, stableApyVol: 0.01 },
      amortizationMonths: 24,
      btcDifficultyCorrelation: 0.4,
    },
    charts: [],
    writeup: { title: "t", prose: "x".repeat(20000), llmAuthored: true, provenance: "Live" },
    audit: [],
    safe: true,
    disclaimer: "not guaranteed",
    mode: "live_read",
    effects: { externalSend: false, deployed: false, markedLive: false, custodialWrite: false },
    ...over,
  };
}

describe("saveConstructionReport", () => {
  beforeEach(() => {
    upsert.mockClear();
    findUnique.mockClear();
  });

  it("persists a bounded summary into VaultDraft.formState under constructionReport", async () => {
    await saveConstructionReport({ userId: "u1", draft: draft(), now: new Date(0) });
    expect(upsert).toHaveBeenCalledTimes(1);
    const arg = upsert.mock.calls[0]![0] as { create: { formState: string } };
    const state = JSON.parse(arg.create.formState) as Record<string, unknown>;
    const report = state.constructionReport as Record<string, unknown>;
    expect(report.vaultTicker).toBe("HYV");
    expect(report.seed).toBe(42);
    expect(report.machineCount).toBe(57);
    // prose is capped at 8000
    expect((report.prose as string).length).toBe(8000);
  });

  it("never throws when the DB write fails (best-effort)", async () => {
    upsert.mockRejectedValueOnce(new Error("db down"));
    await expect(
      saveConstructionReport({ userId: "u1", draft: draft() }),
    ).resolves.toBeUndefined();
  });

  it("merges alongside an existing productWorkspace key (no clobber)", async () => {
    findUnique.mockResolvedValueOnce({
      formState: JSON.stringify({ productWorkspace: { agentBrief: "keep me" } }),
    });
    await saveConstructionReport({ userId: "u1", draft: draft(), now: new Date(0) });
    const arg = upsert.mock.calls[0]![0] as { update: { formState: string } };
    const state = JSON.parse(arg.update.formState) as Record<string, unknown>;
    expect((state.productWorkspace as Record<string, unknown>).agentBrief).toBe("keep me");
    expect(state.constructionReport).toBeDefined();
  });
});

describe("loadConstructionReport", () => {
  beforeEach(() => findUnique.mockClear());

  it("returns null when there is no report", async () => {
    findUnique.mockResolvedValueOnce(null);
    expect(await loadConstructionReport("u1")).toBeNull();
  });

  it("loads a previously stored report", async () => {
    findUnique.mockResolvedValueOnce({
      formState: JSON.stringify({
        constructionReport: { objective: "o", vaultTicker: "HYV", prose: "p", seed: 1 },
      }),
    });
    const r = await loadConstructionReport("u1");
    expect(r?.vaultTicker).toBe("HYV");
  });
});
