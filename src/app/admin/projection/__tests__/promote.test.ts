/**
 * Unit tests for promoteStudyToDraft — src/app/admin/projection/actions.ts
 *
 * Coverage targets:
 *   1. All CreateDraftSchema fields are populated in the VaultDeployment row.
 *   2. Allocation bps always sum to exactly 10000.
 *   3. Default fields are applied when the study is partial (all-zero allocations).
 *   4. APY range invariant (high > low) is upheld even for degenerate outputs.
 *   5. signersWhitelist is JSON from VAULT_DEFAULT_SIGNERS (empty when env unset).
 *   6. requiredSigners is seeded (≥ 2).
 *   7. Throws when study not found.
 *   8. Throws when study has no ScenarioRun rows.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (before module import) ─────────────────────────────────────────────

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    projectionStudyRun: {
      findUniqueOrThrow: vi.fn(),
    },
    scenarioRun: {
      findUniqueOrThrow: vi.fn(),
    },
    vaultDeployment: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/admin/audit", () => ({
  recordAdminAudit: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  assertRateLimit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/engine/scenario", () => ({
  runScenario: vi.fn(),
  getPresetInputs: vi.fn(),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { promoteStudyToDraft } from "../actions";
import type { CreateDraftInput } from "@/app/admin/vaults/actions";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** A valid cuid-shaped id used as the study identifier in tests. */
const STUDY_ID = "clr000000000000000000000a";
const DEPLOYMENT_ID = "clr000000000000000000000c";

function makeStudy(
  overrides: Partial<{ scenarioRunIds: string; label: string | null }> = {},
) {
  return {
    id: STUDY_ID,
    scenarioRunIds:
      overrides.scenarioRunIds ??
      JSON.stringify(["clr000000000000000000000b"]),
    label: overrides.label ?? "Test Projection Study",
  };
}

type AllocationBucket = { bucket: string; pct: number };

function makeScenarioOutputs(
  apyLow = 8.5,
  apyHigh = 13.2,
  allocations: AllocationBucket[] = [
    { bucket: "mining", pct: 40 },
    { bucket: "btc_tactical", pct: 20 },
    { bucket: "usdc_base", pct: 25 },
    { bucket: "stable_reserve", pct: 15 },
  ],
) {
  return JSON.stringify({
    apy_range: { low: apyLow, high: apyHigh },
    risk_score: 42,
    allocations,
    confidence: 0.85,
  });
}

/**
 * Sets up study + scenario mocks and the vaultDeployment.create stub.
 * Returns a helper that extracts the data object passed to create()
 * after the action completes.
 */
function setupHappyPath(outputs = makeScenarioOutputs()) {
  vi.mocked(prisma.projectionStudyRun.findUniqueOrThrow).mockResolvedValue(
    makeStudy() as never,
  );
  vi.mocked(prisma.scenarioRun.findUniqueOrThrow).mockResolvedValue({
    outputs,
    inputs: "{}",
  } as never);
  vi.mocked(prisma.vaultDeployment.create).mockResolvedValue({
    id: DEPLOYMENT_ID,
  } as never);

  return function getCreatedData(): Record<string, unknown> {
    const calls = vi.mocked(prisma.vaultDeployment.create).mock.calls;
    const lastCall = calls[calls.length - 1];
    if (!lastCall) throw new Error("vaultDeployment.create was not called");
    return lastCall[0].data as Record<string, unknown>;
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAdmin).mockResolvedValue({
    userId: "user_admin",
    walletAddress: "0xAdmin",
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("promoteStudyToDraft — field completeness", () => {
  it("happy path — all CreateDraftSchema-required fields are populated", async () => {
    const getCreatedData = setupHappyPath();
    await promoteStudyToDraft(STUDY_ID);
    const data = getCreatedData();

    // Required scalar fields
    expect(typeof data.ticker).toBe("string");
    expect((data.ticker as string).length).toBeGreaterThan(0);
    expect(typeof data.name).toBe("string");
    expect(data.strategy).toBe("mining_yield");
    expect(data.status).toBe("draft");

    // Fee / lockup fields (were missing before fix)
    expect(typeof data.mgmtFeeBps).toBe("number");
    expect(typeof data.perfFeeBps).toBe("number");
    expect(typeof data.softLockupDays).toBe("number");

    // Governance fields (were missing before fix)
    expect(typeof data.requiredSigners).toBe("number");
    expect(data.requiredSigners as number).toBeGreaterThanOrEqual(2);
    expect(typeof data.shareClass).toBe("string");
    expect((data.shareClass as string).length).toBe(1);

    // SPV / legal fields
    expect(data.spvJurisdiction).toBe("cayman");
    expect(data.regExemption).toBe("regD_506c");

    // Disclaimers — must satisfy min(80 chars) and no forbidden words
    expect(typeof data.disclaimers).toBe("string");
    expect((data.disclaimers as string).length).toBeGreaterThanOrEqual(80);
    const forbiddenWords = [
      "guarantee",
      "promise",
      "certain",
      "will deliver",
      "risk-free",
    ];
    for (const word of forbiddenWords) {
      expect((data.disclaimers as string).toLowerCase()).not.toContain(word);
    }

    // APY range — high strictly greater than low
    expect(typeof data.targetApyLowBps).toBe("number");
    expect(typeof data.targetApyHighBps).toBe("number");
    expect(data.targetApyHighBps as number).toBeGreaterThan(
      data.targetApyLowBps as number,
    );

    // Allocation bps sum to exactly 10000
    const sum =
      (data.targetMiningBps as number) +
      (data.targetBtcTacticalBps as number) +
      (data.targetUsdcBaseBps as number) +
      (data.targetStableReserveBps as number);
    expect(sum).toBe(10_000);

    // signersWhitelist — JSON array from VAULT_DEFAULT_SIGNERS (empty when unset)
    expect(typeof data.signersWhitelist).toBe("string");
    const parsedSigners = JSON.parse(
      data.signersWhitelist as string,
    ) as unknown[];
    expect(Array.isArray(parsedSigners)).toBe(true);
    for (const entry of parsedSigners) {
      expect(typeof entry).toBe("string");
      expect((entry as string).length).toBeGreaterThan(0);
    }
  });

  it("allocation bps sum to exactly 10000 with float pct inputs", async () => {
    const getCreatedData = setupHappyPath(
      makeScenarioOutputs(9, 14, [
        { bucket: "mining", pct: 41.7 },
        { bucket: "btc_tactical", pct: 18.3 },
        { bucket: "usdc_base", pct: 24.6 },
        { bucket: "stable_reserve", pct: 15.4 },
      ]),
    );
    await promoteStudyToDraft(STUDY_ID);
    const data = getCreatedData();

    const sum =
      (data.targetMiningBps as number) +
      (data.targetBtcTacticalBps as number) +
      (data.targetUsdcBaseBps as number) +
      (data.targetStableReserveBps as number);
    expect(sum).toBe(10_000);
  });

  it("defaults applied when engine returns all-zero allocations", async () => {
    const getCreatedData = setupHappyPath(
      makeScenarioOutputs(8, 13, [
        { bucket: "mining", pct: 0 },
        { bucket: "btc_tactical", pct: 0 },
        { bucket: "usdc_base", pct: 0 },
        { bucket: "stable_reserve", pct: 0 },
      ]),
    );
    await promoteStudyToDraft(STUDY_ID);
    const data = getCreatedData();

    // Should use fallback defaults, which also sum to 10000
    const sum =
      (data.targetMiningBps as number) +
      (data.targetBtcTacticalBps as number) +
      (data.targetUsdcBaseBps as number) +
      (data.targetStableReserveBps as number);
    expect(sum).toBe(10_000);

    // Fallback values are positive
    expect(data.targetMiningBps as number).toBeGreaterThan(0);
    expect(data.targetBtcTacticalBps as number).toBeGreaterThan(0);
    expect(data.targetUsdcBaseBps as number).toBeGreaterThan(0);
    expect(data.targetStableReserveBps as number).toBeGreaterThan(0);
  });

  it("APY range invariant — high > low even when engine outputs equal values", async () => {
    // Degenerate: high === low (same value)
    const getCreatedData = setupHappyPath(makeScenarioOutputs(10, 10));
    await promoteStudyToDraft(STUDY_ID);
    const data = getCreatedData();

    expect(data.targetApyHighBps as number).toBeGreaterThan(
      data.targetApyLowBps as number,
    );
  });

  it("requiredSigners is seeded; capped by whitelist when signers are configured", async () => {
    const getCreatedData = setupHappyPath();
    await promoteStudyToDraft(STUDY_ID);
    const data = getCreatedData();

    const whitelist = JSON.parse(
      data.signersWhitelist as string,
    ) as unknown[];
    expect(data.requiredSigners as number).toBeGreaterThanOrEqual(2);
    if (whitelist.length > 0) {
      expect(data.requiredSigners as number).toBeLessThanOrEqual(
        whitelist.length,
      );
    }
  });
});

describe("promoteStudyToDraft — error paths", () => {
  it("throws when study is not found", async () => {
    vi.mocked(prisma.projectionStudyRun.findUniqueOrThrow).mockRejectedValue(
      new Error("Not found"),
    );

    await expect(promoteStudyToDraft(STUDY_ID)).rejects.toThrow();
    expect(prisma.vaultDeployment.create).not.toHaveBeenCalled();
  });

  it("throws 'Study has no associated ScenarioRun rows' when runIds is empty", async () => {
    vi.mocked(prisma.projectionStudyRun.findUniqueOrThrow).mockResolvedValue(
      makeStudy({ scenarioRunIds: JSON.stringify([]) }) as never,
    );

    await expect(promoteStudyToDraft(STUDY_ID)).rejects.toThrow(
      "Study has no associated ScenarioRun rows.",
    );
    expect(prisma.vaultDeployment.create).not.toHaveBeenCalled();
  });

  it("throws when studyId is not a valid cuid", async () => {
    await expect(promoteStudyToDraft("not-a-cuid!!")).rejects.toThrow();
    expect(
      prisma.projectionStudyRun.findUniqueOrThrow,
    ).not.toHaveBeenCalled();
  });

  it("throws when scenario outputs JSON is malformed", async () => {
    vi.mocked(prisma.projectionStudyRun.findUniqueOrThrow).mockResolvedValue(
      makeStudy() as never,
    );
    vi.mocked(prisma.scenarioRun.findUniqueOrThrow).mockResolvedValue({
      outputs: "INVALID JSON {{{",
      inputs: "{}",
    } as never);

    await expect(promoteStudyToDraft(STUDY_ID)).rejects.toThrow(
      "Invalid scenario outputs format",
    );
    expect(prisma.vaultDeployment.create).not.toHaveBeenCalled();
  });

  it("returns deploymentId from created row", async () => {
    setupHappyPath();
    const result = await promoteStudyToDraft(STUDY_ID);
    expect(result.deploymentId).toBe(DEPLOYMENT_ID);
  });
});

// ── Integration-style: promoted row covers all CreateDraftInput keys ──────────

describe("promoteStudyToDraft — schema compatibility", () => {
  it("promoted data covers all CreateDraftInput fields (no required field undefined)", async () => {
    const getCreatedData = setupHappyPath();
    await promoteStudyToDraft(STUDY_ID);
    const data = getCreatedData();

    // All keys that CreateDraftSchema requires must be present and non-undefined
    const requiredKeys: (keyof CreateDraftInput)[] = [
      "ticker",
      "name",
      "strategy",
      "minTicketUsdc",
      "capacityUsdc",
      "mgmtFeeBps",
      "perfFeeBps",
      "softLockupDays",
      "targetApyLowBps",
      "targetApyHighBps",
      "spvJurisdiction",
      "shareClass",
      "regExemption",
      "disclaimers",
      "targetMiningBps",
      "targetBtcTacticalBps",
      "targetUsdcBaseBps",
      "targetStableReserveBps",
      "requiredSigners",
    ] as const;

    for (const key of requiredKeys) {
      expect(data[key], `Field "${key}" must be defined`).not.toBeUndefined();
    }

    // signersWhitelist is stored as JSON string in DB
    const signers = JSON.parse(data.signersWhitelist as string) as unknown[];
    expect(Array.isArray(signers)).toBe(true);
  });
});
