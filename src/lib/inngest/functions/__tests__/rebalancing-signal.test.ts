import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  RebalanceSignal,
  VaultStateForSignal,
} from "@/lib/inngest/functions/rebalancing-signal";

// ---------------------------------------------------------------------------
// Mocks — hoisted before importing the module under test.
// ---------------------------------------------------------------------------

/**
 * Loader mock — we drive the loader output per-test by mutating `loaderState`.
 */
const buildHealthyState = (): VaultStateForSignal => ({
  scenarioInputs: {
    btc_price_change_pct: 4,
    hashprice_usd_th_day: 0.082,
    energy_cost_kwh: 0.05,
    stable_apy_pct: 4.0,
    vol_index: 45,
  },
  mode: "balanced",
  riskScore: 42,
  miningMarginScore: 70,
  miningNetApyPct: 9.2,
  stableApyPct: 4.0,
  hashpriceTrendPct: -3.2,
  btcPositionPct: 14,
  btcUsd: 95_000,
  source: "db",
});

let loaderState: VaultStateForSignal = buildHealthyState();
let loaderShouldThrow: Error | null = null;

const loadVaultStateForSignalMock = vi.fn(async () => {
  if (loaderShouldThrow) throw loaderShouldThrow;
  return loaderState;
});

vi.mock("@/lib/data/btc-price", () => ({
  fetchBtcPrice: vi.fn(async () => ({
    usd: 95_000,
    usd_24h_change: 4,
    fetched_at: new Date(),
    stale: false,
  })),
}));

vi.mock("@/lib/data/hashprice", () => ({
  fetchHashprice: vi.fn(async () => ({
    usd_per_th_day: 0.082,
    difficulty: 100,
    stale: false,
  })),
}));

// We override the loader exported from the module under test by overriding
// the underlying Prisma calls. Because the loader also references engine
// functions (kept pure), it suffices to mock prisma reads + the http fetchers.
type RebalanceEventRow = {
  id: string;
  ruleId: string;
  executedAt: Date;
  triggerText: string;
  actionText: string;
  impactText: string;
  projection: string;
  status: string;
  triggeredAt: Date;
  sourceEventName: string | null;
  sourceEventId: string | null;
  fromAllocation: string;
  toAllocation: string;
  approvedBy: string;
};

const rebalanceEventFindFirstMock = vi.fn<
  (args: unknown) => Promise<RebalanceEventRow | null>
>(async () => null);

let createdRowCounter = 0;
const rebalanceEventCreateMock = vi.fn(
  async (args: { data: Omit<RebalanceEventRow, "id" | "executedAt"> }) => {
    createdRowCounter += 1;
    return {
      id: `evt-${createdRowCounter}`,
      executedAt: new Date(),
      ...args.data,
    } satisfies RebalanceEventRow;
  },
);

const vaultSnapshotFindFirstMock = vi.fn(async () => null);
const miningMetricFindFirstMock = vi.fn(async () => null);

vi.mock("@/lib/db", () => ({
  prisma: {
    rebalanceEvent: {
      findFirst: rebalanceEventFindFirstMock,
      create: rebalanceEventCreateMock,
    },
    vaultSnapshot: { findFirst: vaultSnapshotFindFirstMock },
    miningMetric: { findFirst: miningMetricFindFirstMock },
  },
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    send: vi.fn(async () => undefined),
    createFunction: vi.fn((opts: unknown, handler: unknown) => ({
      opts,
      handler,
      name: (opts as { id: string }).id,
    })),
  },
}));

// ---------------------------------------------------------------------------
// Step shim — runs each callback inline, collects emitted events.
// ---------------------------------------------------------------------------

interface EmittedEvent {
  id: string;
  payload: { name: string; data: Record<string, unknown> };
}

function makeStepShim(): {
  step: {
    run: <T>(_name: string, fn: () => T | Promise<T>) => Promise<T>;
    sendEvent: (
      id: string,
      payload: { name: string; data: Record<string, unknown> },
    ) => Promise<unknown>;
  };
  emitted: EmittedEvent[];
} {
  const emitted: EmittedEvent[] = [];
  return {
    step: {
      run: <T,>(_name: string, fn: () => T | Promise<T>): Promise<T> =>
        Promise.resolve(fn()),
      sendEvent: async (
        id: string,
        payload: { name: string; data: Record<string, unknown> },
      ): Promise<unknown> => {
        emitted.push({ id, payload });
        return undefined;
      },
    },
    emitted,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function importModule() {
  return await import("@/lib/inngest/functions/rebalancing-signal");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("rebalancingSignal Inngest function", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rebalanceEventFindFirstMock.mockResolvedValue(null);
    createdRowCounter = 0;
    loaderShouldThrow = null;
    loaderState = buildHealthyState();
  });

  // ---- Registration -------------------------------------------------------

  it("registers with id 'rebalancing-signal' and event triggers", async () => {
    const { rebalancingSignal, REBALANCING_SIGNAL_ID } = await importModule();
    expect(REBALANCING_SIGNAL_ID).toBe("rebalancing-signal");
    const opts = (
      rebalancingSignal as {
        opts: { id: string; concurrency: { limit: number }; triggers: Array<{ event?: string; cron?: string }> };
      }
    ).opts;
    expect(opts.id).toBe("rebalancing-signal");
    expect(opts.concurrency.limit).toBe(1);
    expect(opts.triggers).toHaveLength(3);
    expect(opts.triggers.map((t) => t.event)).toEqual([
      "risk.daily.completed",
      "rebalance.signal.requested",
      "market.data.updated",
    ]);
  });

  // ---- Case A: R1 fires on BTC drawdown -----------------------------------

  it("Case A — R1 fires when BTC 30d drawdown <= -25%", async () => {
    loaderState = {
      ...buildHealthyState(),
      mode: "balanced",
      scenarioInputs: {
        ...buildHealthyState().scenarioInputs,
        btc_price_change_pct: -30,
      },
    };

    const { rebalancingSignalHandler } = await importModule();
    const { step, emitted } = makeStepShim();

    const result = await rebalancingSignalHandler({
      step,
      event: { name: "risk.daily.completed", id: "evt-source-A" },
      loader: loadVaultStateForSignalMock,
    });

    expect(result.signalsTriggered).toBeGreaterThanOrEqual(1);
    expect(result.ruleIds).toContain("R1");

    const r1Create = rebalanceEventCreateMock.mock.calls.find(
      (c) => (c[0] as { data: { ruleId: string } }).data.ruleId === "R1",
    );
    expect(r1Create).toBeDefined();
    const r1Data = (r1Create?.[0] as { data: RebalanceEventRow }).data;
    // Projection is now persisted as its own column (no more "| PROJECTION:"
    // embedded delimiter inside triggerText).
    expect(r1Data.triggerText).not.toContain("PROJECTION");
    expect(r1Data.projection.length).toBeGreaterThan(0);
    expect(r1Data.projection.toLowerCase()).toContain("apy");
    // New traceability columns wired from the Inngest event metadata.
    expect(r1Data.status).toBe("pending");
    expect(r1Data.sourceEventName).toBe("risk.daily.completed");
    expect(r1Data.sourceEventId).toBe("evt-source-A");
    expect(r1Data.triggeredAt).toBeInstanceOf(Date);
    // Forbidden words are tolerated only inside a negated phrase
    // (e.g. "not guaranteed"). Verify the bare bad words never appear.
    const bareBadPattern = /(?<!\b(not|no|never|without)\s+(\w+\s+){0,3})\b(guarantee|promise|certain|will deliver|risk-free|no risk)\w*/i;
    expect(bareBadPattern.test(r1Data.triggerText)).toBe(false);
    expect(bareBadPattern.test(r1Data.actionText)).toBe(false);
    expect(bareBadPattern.test(r1Data.impactText)).toBe(false);
    expect(bareBadPattern.test(r1Data.projection)).toBe(false);

    // Allocation snapshot is JSON-parseable
    const from = JSON.parse(r1Data.fromAllocation) as Record<string, number>;
    const to = JSON.parse(r1Data.toAllocation) as Record<string, number>;
    expect(from.mining).toBe(35);
    expect(to.mining).toBe(25); // defensive target
    expect(to.usdc_base).toBe(55);

    // Approved by starts empty (pending multisig)
    expect(JSON.parse(r1Data.approvedBy)).toEqual([]);

    // Event emitted
    const r1Event = emitted.find(
      (e) => e.payload.data["ruleId"] === "R1",
    );
    expect(r1Event).toBeDefined();
    expect(r1Event?.payload.name).toBe("rebalance.signal.created");
    expect(r1Event?.payload.data["sourceEventName"]).toBe("risk.daily.completed");
  });

  // ---- Case B: Healthy state — no signal --------------------------------

  it("Case B — healthy state: no signals, no rows persisted", async () => {
    loaderState = buildHealthyState();

    const { rebalancingSignalHandler } = await importModule();
    const { step, emitted } = makeStepShim();

    const result = await rebalancingSignalHandler({
      step,
      event: { name: "risk.daily.completed", id: "evt-source-B" },
      loader: loadVaultStateForSignalMock,
    });

    expect(result.signalsTriggered).toBe(0);
    expect(result.signalIds).toEqual([]);
    expect(rebalanceEventCreateMock).not.toHaveBeenCalled();
    expect(emitted).toEqual([]);
  });

  // ---- Case C: Multiple signals (R3 + R-BTC-3) ---------------------------

  it("Case C — both R3 and R-BTC-3 fire on healthy mining + BTC rally", async () => {
    loaderState = {
      ...buildHealthyState(),
      mode: "balanced",
      miningMarginScore: 82,
      btcPositionPct: 14,
      scenarioInputs: {
        ...buildHealthyState().scenarioInputs,
        btc_price_change_pct: 35,
      },
    };

    const { rebalancingSignalHandler } = await importModule();
    const { step, emitted } = makeStepShim();

    const result = await rebalancingSignalHandler({
      step,
      event: { name: "risk.daily.completed", id: "evt-source-C" },
      loader: loadVaultStateForSignalMock,
    });

    expect(result.signalsTriggered).toBeGreaterThanOrEqual(2);
    expect(result.ruleIds).toContain("R3");
    expect(result.ruleIds).toContain("R-BTC-3");

    // Each ruleId persisted exactly once
    const r3Persists = rebalanceEventCreateMock.mock.calls.filter(
      (c) => (c[0] as { data: { ruleId: string } }).data.ruleId === "R3",
    ).length;
    const rbtc3Persists = rebalanceEventCreateMock.mock.calls.filter(
      (c) =>
        (c[0] as { data: { ruleId: string } }).data.ruleId === "R-BTC-3",
    ).length;
    expect(r3Persists).toBe(1);
    expect(rbtc3Persists).toBe(1);

    // Events emitted for each persisted signal
    const ruleIdsEmitted = emitted.map((e) => e.payload.data["ruleId"]);
    expect(ruleIdsEmitted).toContain("R3");
    expect(ruleIdsEmitted).toContain("R-BTC-3");
  });

  // ---- Case D: Idempotency hit ------------------------------------------

  it("Case D — idempotency: existing RebalanceEvent within 1h skips persist", async () => {
    loaderState = {
      ...buildHealthyState(),
      scenarioInputs: {
        ...buildHealthyState().scenarioInputs,
        btc_price_change_pct: -30,
      },
    };

    // First call (R1) returns an existing row → skip
    rebalanceEventFindFirstMock.mockResolvedValueOnce({
      id: "existing-R1",
      ruleId: "R1",
      executedAt: new Date(),
      triggerText: "",
      actionText: "",
      impactText: "",
      projection: "",
      status: "pending",
      triggeredAt: new Date(),
      sourceEventName: null,
      sourceEventId: null,
      fromAllocation: "{}",
      toAllocation: "{}",
      approvedBy: "[]",
    });

    const { rebalancingSignalHandler } = await importModule();
    const { step, emitted } = makeStepShim();

    const result = await rebalancingSignalHandler({
      step,
      event: { name: "risk.daily.completed", id: "evt-source-D" },
      loader: loadVaultStateForSignalMock,
    });

    // R1 was a candidate but idempotency hit → not persisted, not emitted
    const r1Persists = rebalanceEventCreateMock.mock.calls.filter(
      (c) => (c[0] as { data: { ruleId: string } }).data.ruleId === "R1",
    ).length;
    expect(r1Persists).toBe(0);
    expect(result.ruleIds).not.toContain("R1");

    const r1Events = emitted.filter(
      (e) => e.payload.data["ruleId"] === "R1",
    );
    expect(r1Events).toHaveLength(0);

    // Idempotency lookup ran for R1 with the right ruleId filter
    const findCalls = rebalanceEventFindFirstMock.mock.calls;
    const r1Lookup = findCalls.find(
      (c) =>
        (c[0] as { where: { ruleId: string } }).where.ruleId === "R1",
    );
    expect(r1Lookup).toBeDefined();
  });

  // ---- Case E: Loader throws -> error propagates -------------------------

  it("Case E — loader throws: error propagates for Inngest retry", async () => {
    const boom = new Error("upstream BTC feed unreachable");
    loaderShouldThrow = boom;

    const { rebalancingSignalHandler } = await importModule();
    const { step } = makeStepShim();

    await expect(
      rebalancingSignalHandler({
        step,
        event: { name: "risk.daily.completed", id: "evt-source-E" },
        loader: loadVaultStateForSignalMock,
      }),
    ).rejects.toThrow(boom);

    expect(rebalanceEventCreateMock).not.toHaveBeenCalled();
  });

  // ---- Extra: PTAI invariants on a known-armed signal --------------------

  it("PTAI invariants — all four parts present, no forbidden words, APY as range", async () => {
    loaderState = {
      ...buildHealthyState(),
      miningMarginScore: 40,
    };

    const { rebalancingSignalHandler, evaluateRules } = await importModule();
    const { step } = makeStepShim();

    const result = await rebalancingSignalHandler({
      step,
      event: { name: "risk.daily.completed", id: "evt-PTAI" },
      loader: loadVaultStateForSignalMock,
    });

    expect(result.signalsTriggered).toBeGreaterThan(0);

    // Validate the engine output for the same state (deterministic).
    const signals: RebalanceSignal[] = evaluateRules(loaderState);
    expect(signals.length).toBeGreaterThan(0);

    for (const s of signals) {
      expect(s.trigger.length).toBeGreaterThan(0);
      expect(s.action.length).toBeGreaterThan(0);
      expect(s.projection.length).toBeGreaterThan(0);
      expect(s.impact.length).toBeGreaterThan(0);

      const all = [s.trigger, s.action, s.projection, s.impact].join(" ").toLowerCase();
      for (const w of ["guarantee", "promise", "certain", "will deliver", "risk-free", "no risk"]) {
        // Allow only inside a negated phrase ("not guaranteed").
        const present = all.includes(w);
        if (!present) continue;
        const negated = new RegExp(
          `\\b(not|no|never|without)\\s+(\\w+\\s+){0,3}${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
        );
        expect(negated.test(all)).toBe(true);
      }

      // If APY is mentioned in projection/impact, must be a range.
      for (const text of [s.projection, s.impact]) {
        if (text.toLowerCase().includes("apy")) {
          expect(text).toMatch(/\d+(\.\d+)?-\d+(\.\d+)?%/);
        }
      }
    }
  });
});
