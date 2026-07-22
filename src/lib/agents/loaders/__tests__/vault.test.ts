import { describe, it, expect, vi, beforeEach } from "vitest";

// `loadMemoInput` feeds the Investor Memo PDF (LP-visible). This suite covers
// the loader's own logic in isolation: provenance tagging (T-15 — a
// `VaultSnapshot.source` of "daily-seed"/"computed" must never badge
// `attested`/`stale`, only `estimated`, no matter how fresh `takenAt` is) and
// vault-preset resolution.
//
// Scenario / backtest retirement: the v1.0 4-sleeve scenario engine is gone, so
// the loader no longer reads `ScenarioRun` / `BacktestRun` — `scenarios` and
// `backtests` are ALWAYS empty and their provenance is `pending` (no
// trustworthy number exists). These regression tests pin that the loader never
// surfaces a frozen dead projection into the opposable memo.
//
// `loadCoverageForVault` is mocked out — its own provenance resolution is that
// module's responsibility, not this loader's.

const findFirstVaultSnapshot = vi.fn();
const loadCoverageForVault = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    vaultSnapshot: {
      findFirst: (...a: unknown[]) => findFirstVaultSnapshot(...a),
      findMany: (...a: unknown[]) => findManyVaultSnapshot(...a),
    },
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

beforeEach(() => {
  vi.clearAllMocks();
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

  it("badges retired scenarios/backtests as pending (no trustworthy projection exists)", async () => {
    findFirstVaultSnapshot.mockResolvedValue(makeSnapshot());
    const result = await loadMemoInput("yield");
    expect(result.provenance.scenarios).toBe("pending");
    expect(result.provenance.backtests).toBe("pending");
  });
});

describe("loadMemoInput — scenario/backtest retirement", () => {
  it("returns empty scenarios and backtests (the engine is retired, never read from DB)", async () => {
    findFirstVaultSnapshot.mockResolvedValue(makeSnapshot());
    const result = await loadMemoInput("yield");
    expect(result.scenarios).toEqual([]);
    expect(result.backtests).toEqual([]);
  });

  it("does NOT require any backtest runs to succeed", async () => {
    // The old loader threw "Vault state incomplete" when no BacktestRun existed.
    // With the engine retired, only a VaultSnapshot is required.
    findFirstVaultSnapshot.mockResolvedValue(makeSnapshot());
    await expect(loadMemoInput("yield")).resolves.toMatchObject({
      scenarios: [],
      backtests: [],
    });
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
    await loadVaultMonthlyHistory(2);
    expect(findManyVaultSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ where: { source: "backfill" } }),
    );
  });

  it("maps real snapshots to NAV + APY range, keyed by month, is_synthetic=false", async () => {
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

    const rows = await loadVaultMonthlyHistory(2);
    expect(rows).toHaveLength(2);
    // Ordered ascending by month; the loader no longer queries Distribution and
    // carries no distribution/apy_achieved fields (v3.0: no periodic payout).
    expect(rows[0]?.period).toBe("2026-01");
    expect(rows[0]?.nav_usdc).toBe(24_500_000);
    expect(rows[0]?.apy_low).toBe(9.3);
    expect(rows[0]?.apy_high).toBe(12.7);
    expect(rows[0]?.is_synthetic).toBe(false);
    expect(rows[1]?.period).toBe("2026-02");
    expect(rows[1]?.nav_usdc).toBe(24_700_000);
    expect(rows[1]?.is_synthetic).toBe(false);
    // Real rows never carry the retired fields.
    expect(rows[0]).not.toHaveProperty("apy_achieved");
    expect(rows[0]).not.toHaveProperty("distribution_usdc");
  });

  // The padding is GONE. It used to fill missing months with a drifted NAV
  // anchored on `nav ?? aumUsdc ?? 0` and a hardcoded 9.0–13.0 band — invented
  // months inside an investor-facing PDF, while the renderer promised "No
  // history → NO fabricated row". These tests pin the promise instead.

  it("returns [] when there is no real history — no synthetic pad, no zero rows", async () => {
    findManyVaultSnapshot.mockResolvedValue([]);
    const rows = await loadVaultMonthlyHistory(3);
    // Empty means empty: the PDF renders its honest "No monthly history yet"
    // state, which was previously unreachable because the pad always filled.
    expect(rows).toEqual([]);
  });

  it("returns FEWER rows than requested when history is short — never pads the head", async () => {
    findManyVaultSnapshot.mockResolvedValue([
      {
        takenAt: new Date("2026-02-15T00:00:00Z"),
        aumUsdc: decimal(24_700_000),
        currentApyLow: decimal(9.4),
        currentApyHigh: decimal(12.8),
      },
    ]);
    const rows = await loadVaultMonthlyHistory(4);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.period).toBe("2026-02");
    expect(rows[0]?.is_synthetic).toBe(false);
    // No fabricated month, no hardcoded band, no zero NAV anywhere.
    expect(rows.some((r) => r.is_synthetic)).toBe(false);
    expect(rows.some((r) => r.nav_usdc === 0)).toBe(false);
    expect(rows.some((r) => r.apy_low === 9.0 && r.apy_high === 13.0)).toBe(false);
  });

  it("a REAL zero NAV from a snapshot is preserved — a measured 0 is not an absence", async () => {
    findManyVaultSnapshot.mockResolvedValue([
      {
        takenAt: new Date("2026-02-15T00:00:00Z"),
        aumUsdc: decimal(0),
        currentApyLow: decimal(9.4),
        currentApyHigh: decimal(12.8),
      },
    ]);
    const rows = await loadVaultMonthlyHistory(1);
    expect(rows).toHaveLength(1);
    // The snapshot genuinely says 0 — that is a reading, and it stays.
    expect(rows[0]?.nav_usdc).toBe(0);
    expect(rows[0]?.is_synthetic).toBe(false);
  });

  it("a DB failure propagates — it is never converted into rows or an empty pad", async () => {
    findManyVaultSnapshot.mockRejectedValue(new Error("db unreachable"));
    // Outage ≠ empty history: the caller (memo cron) must see the failure, not
    // a blank table it would render as "no history yet".
    await expect(loadVaultMonthlyHistory(3)).rejects.toThrow("db unreachable");
  });
});
