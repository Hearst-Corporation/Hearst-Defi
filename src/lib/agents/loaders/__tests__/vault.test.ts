import { describe, it, expect, vi, beforeEach } from "vitest";

// `loadMemoInput` feeds the Investor Memo PDF (LP-visible). This suite covers
// the loader's own logic in isolation: provenance tagging (T-15 — a
// `VaultSnapshot.source` of "daily-seed"/"computed" must never badge
// `attested`/`stale`, only `estimated`, no matter how fresh `takenAt` is),
// vault-preset resolution, and the JSON rehydration of persisted scenario /
// backtest artifacts. `loadCoverageForVault` is mocked out — its own
// provenance resolution is that module's responsibility, not this loader's.

const findFirstVaultSnapshot = vi.fn();
const findManyScenarioRun = vi.fn();
const findManyBacktestRun = vi.fn();
const findManyDistribution = vi.fn();
const loadCoverageForVault = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    vaultSnapshot: {
      findFirst: (...a: unknown[]) => findFirstVaultSnapshot(...a),
      findMany: (...a: unknown[]) => findManyVaultSnapshot(...a),
    },
    scenarioRun: { findMany: (...a: unknown[]) => findManyScenarioRun(...a) },
    backtestRun: { findMany: (...a: unknown[]) => findManyBacktestRun(...a) },
    distribution: { findMany: (...a: unknown[]) => findManyDistribution(...a) },
  },
}));

const findManyVaultSnapshot = vi.fn();

vi.mock("@/lib/agents/loaders/coverage", () => ({
  loadCoverageForVault: (...a: unknown[]) => loadCoverageForVault(...a),
}));

import { loadMemoInput, loadVaultMonthlyHistory } from "@/lib/agents/loaders/vault";

function decimal(n: number) {
  return { toNumber: () => n };
}

const PENDING_COVERAGE = {
  state: "pending",
  provenance: "pending",
  ratio: null,
  netMiningCashUsd: null,
  targetDistributionUsdc: null,
  recommendation: { action: "hold", note: "", maxPayout: null },
  period: null,
  vaultRef: null,
  lastUpdated: null,
  missingInputs: ["mining_metric"],
  summary: "",
  healthy: true,
};

function makeSnapshot(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    takenAt: new Date(),
    source: "live",
    aumUsdc: decimal(24_500_000),
    currentApyLow: decimal(9.4),
    currentApyHigh: decimal(12.8),
    riskScore: 42,
    mode: "balanced",
    ...overrides,
  };
}

function makeScenarioRow(id = "sr-1") {
  return {
    id,
    outputs: JSON.stringify({
      apy_range: { low: 9.4, high: 12.8 },
      stressed_apy: 6.1,
      risk_score: 42,
      mining_margin_score: 64,
      mode: "balanced",
      allocations: [
        { bucket: "mining", pct: 40, yield_contribution_bps: 400 },
        { bucket: "usdc_base", pct: 60, yield_contribution_bps: 480 },
      ],
      assumptions: ["Methodology v1.0 anchor"],
      confidence: "medium",
      btc_tactical: {
        triggers: [],
        guardrails: [],
        targetExposurePct: 0,
      },
    }),
  };
}

function makeBacktestRow(id = "br-1") {
  return {
    id,
    backtestKey: "bear_2022",
    initialCapital: decimal(1_000_000),
    endingValue: decimal(1_120_000),
    totalReturnPct: decimal(12),
    maxDrawdownPct: decimal(-8),
    worstMonthPct: decimal(-3.2),
    numRebalances: 4,
    rulesMode: "hearst_rules",
    monthlySeries: JSON.stringify([
      { month: "2022-01", valueUsdc: 1_000_000, distributionUsdc: 8_000 },
      { month: "2022-02", valueUsdc: 1_010_000, distributionUsdc: 8_100 },
    ]),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  findManyScenarioRun.mockResolvedValue([makeScenarioRow()]);
  findManyBacktestRun.mockResolvedValue([makeBacktestRow()]);
  loadCoverageForVault.mockResolvedValue(PENDING_COVERAGE);
});

describe("loadMemoInput — vault resolution", () => {
  it("rejects an unknown vaultId before touching the DB", async () => {
    await expect(loadMemoInput("phantom-vault")).rejects.toThrow(/unknown vaultId/i);
    expect(findFirstVaultSnapshot).not.toHaveBeenCalled();
  });

  it("defaults to the Yield vault when no vaultId is given", async () => {
    findFirstVaultSnapshot.mockResolvedValue(makeSnapshot());
    const result = await loadMemoInput();
    expect(result.vault.id).toBe("yield");
    expect(result.vault.apyRange).toEqual({ low: 8, high: 15 });
  });

  it("pins the requested vault's own label/apyRange/assumptions, not the snapshot's", async () => {
    findFirstVaultSnapshot.mockResolvedValue(makeSnapshot());
    const result = await loadMemoInput("btc-plus");
    expect(result.vault.id).toBe("btc-plus");
    expect(result.vault.name).toBe("Hearst BTC Plus Vault");
    expect(result.vault.apyRange).toEqual({ low: 10, high: 20 });
    // AUM/mode/riskScore come from the live snapshot, not the preset.
    expect(result.vault.aumUsdc).toBe(24_500_000);
    expect(result.vault.mode).toBe("balanced");
    expect(result.vault.riskScore).toBe(42);
  });

  it("throws when no VaultSnapshot exists", async () => {
    findFirstVaultSnapshot.mockResolvedValue(null);
    await expect(loadMemoInput("yield")).rejects.toThrow(/Vault state incomplete/i);
  });

  it("throws when there are no backtest runs", async () => {
    findFirstVaultSnapshot.mockResolvedValue(makeSnapshot());
    findManyBacktestRun.mockResolvedValue([]);
    await expect(loadMemoInput("yield")).rejects.toThrow(/Vault state incomplete/i);
  });
});

describe("loadMemoInput — provenance (T-15 regression)", () => {
  it("badges a fresh, live-sourced snapshot as attested", async () => {
    findFirstVaultSnapshot.mockResolvedValue(
      makeSnapshot({ source: "live", takenAt: new Date() }),
    );
    const result = await loadMemoInput("yield");
    expect(result.provenance.vault).toBe("attested");
    expect(result.provenance.mining).toBe("attested");
  });

  it("badges a stale live-sourced snapshot as stale, not attested", async () => {
    findFirstVaultSnapshot.mockResolvedValue(
      makeSnapshot({
        source: "oracle",
        takenAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days old
      }),
    );
    const result = await loadMemoInput("yield");
    expect(result.provenance.vault).toBe("stale");
    expect(result.provenance.mining).toBe("stale");
  });

  it("never badges a fresh daily-seed snapshot as attested — estimated instead", async () => {
    findFirstVaultSnapshot.mockResolvedValue(
      makeSnapshot({ source: "daily-seed", takenAt: new Date() }),
    );
    const result = await loadMemoInput("yield");
    expect(result.provenance.vault).toBe("estimated");
    expect(result.provenance.mining).toBe("estimated");
  });

  it("never badges a fresh computed (preset-run) snapshot as attested — estimated instead", async () => {
    findFirstVaultSnapshot.mockResolvedValue(
      makeSnapshot({ source: "computed", takenAt: new Date() }),
    );
    const result = await loadMemoInput("yield");
    expect(result.provenance.vault).toBe("estimated");
    expect(result.provenance.mining).toBe("estimated");
  });

  it("maps coverage provenance verbatim, collapsing invalid to pending", async () => {
    findFirstVaultSnapshot.mockResolvedValue(makeSnapshot());
    loadCoverageForVault.mockResolvedValue({ ...PENDING_COVERAGE, provenance: "invalid" });
    const result = await loadMemoInput("yield");
    expect(result.provenance.coverage).toBe("pending");
  });

  it("badges persisted scenarios/backtests as attested (reproducible engine artifacts)", async () => {
    findFirstVaultSnapshot.mockResolvedValue(makeSnapshot());
    const result = await loadMemoInput("yield");
    expect(result.provenance.scenarios).toBe("attested");
    expect(result.provenance.backtests).toBe("attested");
  });
});

describe("loadMemoInput — scenario/backtest rehydration", () => {
  it("parses a well-formed persisted ScenarioRun into ScenarioOutput", async () => {
    findFirstVaultSnapshot.mockResolvedValue(makeSnapshot());
    const result = await loadMemoInput("yield");
    expect(result.scenarios).toHaveLength(1);
    expect(result.scenarios[0]).toMatchObject({
      apy_range: { low: 9.4, high: 12.8 },
      mode: "balanced",
      confidence: "medium",
    });
  });

  it("throws a clear error when ScenarioRun.outputs is not valid JSON", async () => {
    findFirstVaultSnapshot.mockResolvedValue(makeSnapshot());
    findManyScenarioRun.mockResolvedValue([{ id: "bad-1", outputs: "{not json" }]);
    await expect(loadMemoInput("yield")).rejects.toThrow(/not valid JSON/i);
  });

  it("throws a clear error when ScenarioRun.outputs is missing apy_range", async () => {
    findFirstVaultSnapshot.mockResolvedValue(makeSnapshot());
    findManyScenarioRun.mockResolvedValue([
      { id: "bad-2", outputs: JSON.stringify({ mode: "balanced" }) },
    ]);
    await expect(loadMemoInput("yield")).rejects.toThrow(/apy_range missing/i);
  });

  it("parses a well-formed persisted BacktestRun into BacktestOutput", async () => {
    findFirstVaultSnapshot.mockResolvedValue(makeSnapshot());
    const result = await loadMemoInput("yield");
    expect(result.backtests).toHaveLength(1);
    expect(result.backtests[0]).toMatchObject({
      key: "bear_2022",
      startDate: "2022-01",
      endDate: "2022-02",
      hearstRulesMode: true,
    });
  });

  it("throws a clear error on an unknown backtestKey", async () => {
    findFirstVaultSnapshot.mockResolvedValue(makeSnapshot());
    findManyBacktestRun.mockResolvedValue([
      { ...makeBacktestRow(), backtestKey: "not_a_real_key" },
    ]);
    await expect(loadMemoInput("yield")).rejects.toThrow(/backtestKey invalid/i);
  });

  it("throws a clear error when BacktestRun.monthlySeries is empty", async () => {
    findFirstVaultSnapshot.mockResolvedValue(makeSnapshot());
    findManyBacktestRun.mockResolvedValue([
      { ...makeBacktestRow(), monthlySeries: JSON.stringify([]) },
    ]);
    await expect(loadMemoInput("yield")).rejects.toThrow(/monthlySeries empty/i);
  });
});

describe("loadVaultMonthlyHistory", () => {
  it("returns an empty array for zero or negative months", async () => {
    expect(await loadVaultMonthlyHistory(0)).toEqual([]);
    expect(await loadVaultMonthlyHistory(-3)).toEqual([]);
    expect(findManyVaultSnapshot).not.toHaveBeenCalled();
  });

  it("queries only source=\"backfill\" snapshots (never mixes daily-seed/computed NAV scale)", async () => {
    findManyVaultSnapshot.mockResolvedValue([]);
    findManyDistribution.mockResolvedValue([]);
    await loadVaultMonthlyHistory(2);
    expect(findManyVaultSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ where: { source: "backfill" } }),
    );
  });

  it("computes apy_achieved from NAV delta + distribution, keyed by month", async () => {
    findManyVaultSnapshot.mockResolvedValue([
      {
        takenAt: new Date("2026-02-15T00:00:00Z"),
        aumUsdc: decimal(24_700_000),
        currentApyLow: decimal(9.4),
        currentApyHigh: decimal(12.8),
      },
      {
        takenAt: new Date("2026-01-15T00:00:00Z"),
        aumUsdc: decimal(24_500_000),
        currentApyLow: decimal(9.3),
        currentApyHigh: decimal(12.7),
      },
    ]);
    findManyDistribution.mockResolvedValue([
      { period: "2026-02", amountUsdc: decimal(197_600) },
      { period: "2026-01", amountUsdc: decimal(196_400) },
    ]);

    const rows = await loadVaultMonthlyHistory(2);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.period).toBe("2026-01");
    expect(rows[1]?.period).toBe("2026-02");
    // First anchored row has no predecessor -> falls back to the APY midpoint.
    expect(rows[0]?.apy_achieved).toBe(11.0);
    // Second row: ((24.7M - 24.5M + 197_600) / 24.5M) * 12 * 100, rounded to 1dp.
    const expected =
      Math.round((((24_700_000 - 24_500_000 + 197_600) / 24_500_000) * 12 * 100) * 10) / 10;
    expect(rows[1]?.apy_achieved).toBe(expected);
  });

  it("pads with a zero-anchored synthetic series when there is no real history", async () => {
    findManyVaultSnapshot.mockResolvedValue([]);
    findManyDistribution.mockResolvedValue([]);
    const rows = await loadVaultMonthlyHistory(3);
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.apy_low).toBe(9.0);
      expect(row.apy_high).toBe(13.0);
      // "Mode vérité live": never fabricate a NAV anchor out of thin air.
      expect(row.nav_usdc).toBe(0);
    }
  });
});
