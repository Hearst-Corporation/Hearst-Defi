/**
 * Tests for per-user context injection in scenario-narrative and investor-memo agents.
 *
 * Criteria:
 *   - Without userId → params.system has exactly 1 block (unchanged behaviour)
 *   - With userId pointing to a mocked profile → params.system has 2 blocks,
 *     the 2nd without cache_control
 *   - P1 best-effort: if loaders throw, the agent must NOT throw — it falls
 *     back to 1 system block (the cached methodology) and logs a warning.
 *
 * Strategy:
 *   - Mock `server-only`, `@/lib/db` (Prisma), `@/lib/llm/client` (callLlm),
 *     `@/lib/logger` (to assert warn is called), and
 *     `@/lib/agents/user-context` (async loaders) so no I/O is triggered.
 *   - The mock client captures the `params` passed to `callLlm` so we can
 *     assert on the system-block array shape.
 *   - `buildUserContextSystemBlock` is the real implementation (pure function).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LlmParams } from "@/lib/llm/client";
import { LLM_MODEL } from "@/lib/llm/openai";

// ---- module mocks (must be top-level before any imports) -------------------

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", () => ({
  prisma: {
    llmRun: {
      create: vi.fn().mockResolvedValue({ id: "mock-run-id" }),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

// Mock logger so we can assert warn() is called in best-effort paths.
// Use vi.hoisted() so the reference is available inside the vi.mock factory,
// which is hoisted to the top of the file by Vitest before variable declarations.
const { mockLoggerWarn } = vi.hoisted(() => ({
  mockLoggerWarn: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  logger: {
    warn: mockLoggerWarn,
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// Capture params passed to callLlm. We mock the whole module so no real API
// call is made. The array is module-level so each test can inspect it after
// clearing in beforeEach.
const capturedParams: LlmParams[] = [];

vi.mock("@/lib/llm/client", () => ({
  callLlm: vi.fn(
    async (
      agentName: string,
      params: LlmParams,
    ) => {
      capturedParams.push(params);
      // Return appropriate fixture based on which agent is calling.
      const text =
        agentName === "investor-memo"
          ? JSON.stringify({
              executive_summary:
                "Under the assumption that hashprice stays within range, the vault targets a 9.00-12.00% APY range.",
              vault_structure:
                "Cayman SPV structure with a $250k minimum. Under the assumption of stable regulation, lock-up terms are 60 days.",
              scenario_analysis:
                "Under the assumption of flat hashprice, projected APY range is 9.00-12.00%.",
              risk_section:
                "Under the assumption of stable on-chain conditions, market risk is moderate.",
              mining_section:
                "Under the assumption that energy cost stays at $0.045/kWh, mining margin remains positive.",
              performance_section:
                "Under the assumption of historical drawdown patterns, maxDrawdownPct was 5.2% and totalReturnPct was 11.4%.",
              methodology_note:
                "Under the assumption that methodology v1.0 remains current, this memo follows the immutable specification.",
              disclaimer:
                "Past performance is not indicative of future results. This is not a guarantee of any return.",
            })
          : JSON.stringify({
              narrative_md:
                "Under the assumption that hashprice stays flat, the projected APY range is 9.00-12.00%.",
              risk_warning: "Hashprice volatility could compress mining margin.",
              confidence: "medium",
              key_drivers: ["hashprice stability", "uptime above 98%", "USDC base yield"],
              ptai: {
                projection: "APY 9.0-12.0% in Balanced mode under stable hashprice.",
                trigger: "No active rule triggered — holding current posture.",
                action: "Hold current allocation: mining 45%, btc_tactical 25%.",
                impact: "Stressed APY 6.4%; risk score 38/100 (moderate).",
              },
            });
      return {
        response: {
          content: [{ type: "text", text }],
          usage: { input_tokens: 10, output_tokens: 50 },
        },
        latencyMs: 0,
        runId: "mock-run-id",
      };
    },
  ),
}));

// Mock the async loaders only — buildUserContextSystemBlock keeps the real
// implementation (pure function, no Prisma I/O).
vi.mock("@/lib/agents/user-context", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/agents/user-context")>();
  return {
    ...original,
    loadUserAgentProfile: vi.fn(),
    loadUserMemory: vi.fn(),
  };
});

// ---- imports (after mocks) --------------------------------------------------

import type { UserAgentProfile } from "@prisma/client";
import {
  loadUserAgentProfile,
  loadUserMemory,
} from "@/lib/agents/user-context";
import { runScenarioNarrative } from "@/lib/agents/scenario-narrative";
import { runInvestorMemo } from "@/lib/agents/investor-memo";
import type { ScenarioOutput } from "@/lib/engine/types";
import type { InvestorMemoInput } from "@/lib/agents/investor-memo";

// ---- fixtures ---------------------------------------------------------------

function makeProfile(
  overrides: Partial<UserAgentProfile> = {},
): UserAgentProfile {
  return {
    id: "test-profile-id",
    userId: "user-abc",
    agentName: "scenario-narrative",
    tone: "concise",
    language: "fr",
    verbosity: null,
    customInstructions: null,
    templateId: null,
    createdAt: new Date("2026-05-21T00:00:00Z"),
    updatedAt: new Date("2026-05-21T00:00:00Z"),
    ...overrides,
  };
}

function makeScenarioOutput(): ScenarioOutput {
  return {
    mode: "balanced",
    confidence: "medium",
    apy_range: { low: 9.0, high: 12.0 },
    stressed_apy: 7.5,
    risk_score: 42,
    mining_margin_score: 65,
    allocations: [
      {
        bucket: "mining",
        pct: 60,
        yield_contribution_bps: 480,
      },
      {
        bucket: "usdc_base",
        pct: 40,
        yield_contribution_bps: 200,
      },
    ],
    assumptions: [
      "hashprice_usd_th_day=0.08",
      "energy_cost_kwh=0.045",
      "stable_apy_pct=5.0",
    ],
    btc_tactical: {
      triggers: [],
      guardrails: [],
      targetExposurePct: 0,
    },
  };
}

function makeInvestorMemoInput(): InvestorMemoInput {
  return {
    vault: {
      aumUsdc: 5_000_000,
      apyRange: { low: 9.0, high: 12.0 },
      mode: "balanced",
      riskScore: 42,
    },
    scenarios: [makeScenarioOutput()],
    backtests: [],
    generatedAt: "2026-05-21T00:00:00Z",
  };
}

// ---- helpers ----------------------------------------------------------------

const mockLoadUserAgentProfile = vi.mocked(loadUserAgentProfile);
const mockLoadUserMemory = vi.mocked(loadUserMemory);

// Helper: safely extract the system blocks as a typed array for assertions.
// params.system can be `string | TextBlockParam[] | undefined` — we narrow to
// the array case (which is what our agents always produce) via `unknown`.
function getSystemBlocks(
  params: LlmParams,
): Array<{ type: string; text?: string; cache_control?: unknown }> {
  if (!Array.isArray(params.system)) return [];
  return (params.system as unknown) as Array<{
    type: string;
    text?: string;
    cache_control?: unknown;
  }>;
}

// ---- tests ------------------------------------------------------------------

describe("runScenarioNarrative — user-context injection", () => {
  beforeEach(() => {
    capturedParams.length = 0;
    vi.clearAllMocks();
  });

  it("without userId → params.system has exactly 1 block (unchanged behaviour)", async () => {
    await runScenarioNarrative({
      scenario_id: "base",
      scenario_output: makeScenarioOutput(),
    });

    expect(capturedParams).toHaveLength(1);
    const blocks = getSystemBlocks(capturedParams[0]!);
    expect(blocks).toHaveLength(1);

    // Loaders must NOT have been called
    expect(mockLoadUserAgentProfile).not.toHaveBeenCalled();
    expect(mockLoadUserMemory).not.toHaveBeenCalled();
  });

  it("without userId (explicit undefined) → params.system still has 1 block", async () => {
    await runScenarioNarrative(
      { scenario_id: "custom", scenario_output: makeScenarioOutput() },
      { userId: undefined },
    );

    expect(capturedParams).toHaveLength(1);
    const blocks = getSystemBlocks(capturedParams[0]!);
    expect(blocks).toHaveLength(1);
    expect(mockLoadUserAgentProfile).not.toHaveBeenCalled();
    expect(mockLoadUserMemory).not.toHaveBeenCalled();
  });

  it("with userId + non-empty profile → params.system has 2 blocks", async () => {
    mockLoadUserAgentProfile.mockResolvedValue(makeProfile({ tone: "concise" }));
    mockLoadUserMemory.mockResolvedValue(
      "Scénarios récents (1) :\n- 2026-05-21 · preset=base · confidence=medium",
    );

    await runScenarioNarrative(
      { scenario_id: "base", scenario_output: makeScenarioOutput() },
      { userId: "user-abc" },
    );

    expect(capturedParams).toHaveLength(1);
    const blocks = getSystemBlocks(capturedParams[0]!);
    expect(blocks).toHaveLength(2);

    // Block 0: cached methodology — must have cache_control
    expect(blocks[0]).toHaveProperty("cache_control");
    expect(blocks[0]?.type).toBe("text");

    // Block 1: user-context — must NOT have cache_control
    expect(blocks[1]).not.toHaveProperty("cache_control");
    expect(blocks[1]?.type).toBe("text");
    expect(typeof blocks[1]?.text).toBe("string");
    expect(blocks[1]?.text).toMatch(/USER PERSONALISATION/);
  });

  it("with userId but null profile + empty memory → params.system has 1 block (no injection)", async () => {
    mockLoadUserAgentProfile.mockResolvedValue(null);
    mockLoadUserMemory.mockResolvedValue("");

    await runScenarioNarrative(
      { scenario_id: "base", scenario_output: makeScenarioOutput() },
      { userId: "user-no-profile" },
    );

    expect(capturedParams).toHaveLength(1);
    // buildUserContextSystemBlock returns null → no 2nd block
    const blocks = getSystemBlocks(capturedParams[0]!);
    expect(blocks).toHaveLength(1);
  });

  it("loaders are called with the correct agentName when userId is provided", async () => {
    mockLoadUserAgentProfile.mockResolvedValue(makeProfile());
    mockLoadUserMemory.mockResolvedValue(
      "- 2026-05-21 · preset=base · confidence=medium",
    );

    await runScenarioNarrative(
      { scenario_id: "base", scenario_output: makeScenarioOutput() },
      { userId: "user-check" },
    );

    expect(mockLoadUserAgentProfile).toHaveBeenCalledWith(
      "user-check",
      "scenario-narrative",
    );
    expect(mockLoadUserMemory).toHaveBeenCalledWith(
      "user-check",
      "scenario-narrative",
    );
  });

  // ---- P1 best-effort: enrichment must not block the agent -------------------

  it("P1: loader throws → runScenarioNarrative does NOT throw, falls back to 1 block", async () => {
    mockLoadUserAgentProfile.mockRejectedValue(new Error("DB connection refused"));
    mockLoadUserMemory.mockRejectedValue(new Error("DB connection refused"));

    // Must resolve without throwing
    await expect(
      runScenarioNarrative(
        { scenario_id: "base", scenario_output: makeScenarioOutput() },
        { userId: "user-db-down" },
      ),
    ).resolves.not.toThrow();

    // callLlm was still called with exactly 1 system block (methodology only)
    expect(capturedParams).toHaveLength(1);
    const blocks = getSystemBlocks(capturedParams[0]!);
    expect(blocks).toHaveLength(1);

    // logger.warn was called with the userId
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.stringContaining("per-user enrichment failed"),
      expect.objectContaining({ userId: "user-db-down" }),
      expect.any(Error),
    );
  });
});

describe("runInvestorMemo — user-context injection + P1 best-effort", () => {
  beforeEach(() => {
    capturedParams.length = 0;
    vi.clearAllMocks();
  });

  it("without userId → params.system has exactly 1 block", async () => {
    await runInvestorMemo(makeInvestorMemoInput(), { model: LLM_MODEL });

    expect(capturedParams).toHaveLength(1);
    const blocks = getSystemBlocks(capturedParams[0]!);
    expect(blocks).toHaveLength(1);
    expect(mockLoadUserAgentProfile).not.toHaveBeenCalled();
    expect(mockLoadUserMemory).not.toHaveBeenCalled();
  });

  it("with userId + non-empty profile → params.system has 2 blocks", async () => {
    mockLoadUserAgentProfile.mockResolvedValue(
      makeProfile({ agentName: "investor-memo", tone: "institutional" }),
    );
    mockLoadUserMemory.mockResolvedValue(
      "Scénarios récents (1) :\n- 2026-05-21 · preset=base · confidence=medium",
    );

    await runInvestorMemo(makeInvestorMemoInput(), {
      model: LLM_MODEL,
      userId: "user-abc",
    });

    expect(capturedParams).toHaveLength(1);
    const blocks = getSystemBlocks(capturedParams[0]!);
    expect(blocks).toHaveLength(2);

    // Block 0: cached methodology
    expect(blocks[0]).toHaveProperty("cache_control");
    // Block 1: user-context — no cache_control
    expect(blocks[1]).not.toHaveProperty("cache_control");
    expect(blocks[1]?.text).toMatch(/USER PERSONALISATION/);
  });

  it("P1: loader throws → runInvestorMemo does NOT throw, falls back to 1 block", async () => {
    mockLoadUserAgentProfile.mockRejectedValue(new Error("DB timeout"));
    mockLoadUserMemory.mockRejectedValue(new Error("DB timeout"));

    // Must resolve without throwing
    await expect(
      runInvestorMemo(makeInvestorMemoInput(), {
        model: LLM_MODEL,
        userId: "user-db-down",
      }),
    ).resolves.not.toThrow();

    // callLlm was still called with exactly 1 system block (methodology only)
    expect(capturedParams).toHaveLength(1);
    const blocks = getSystemBlocks(capturedParams[0]!);
    expect(blocks).toHaveLength(1);

    // logger.warn was called with the userId
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.stringContaining("per-user enrichment failed"),
      expect.objectContaining({ userId: "user-db-down" }),
      expect.any(Error),
    );
  });

  it("P1: buildUserContextSystemBlock throws (forbidden word in customInstructions) → runInvestorMemo does NOT throw", async () => {
    // Profile with a forbidden word triggers assertNoForbiddenWords inside
    // buildUserContextSystemBlock, which is called synchronously inside the
    // try/catch block — this must be swallowed and logged.
    mockLoadUserAgentProfile.mockResolvedValue(
      makeProfile({
        agentName: "investor-memo",
        customInstructions: "Always guarantee the best outcome.",
      }),
    );
    mockLoadUserMemory.mockResolvedValue("");

    await expect(
      runInvestorMemo(makeInvestorMemoInput(), {
        model: LLM_MODEL,
        userId: "user-bad-instructions",
      }),
    ).resolves.not.toThrow();

    // callLlm is still called (1 block only — the enrichment was discarded)
    expect(capturedParams).toHaveLength(1);
    const blocks = getSystemBlocks(capturedParams[0]!);
    expect(blocks).toHaveLength(1);

    // warn was called
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.stringContaining("per-user enrichment failed"),
      expect.objectContaining({ userId: "user-bad-instructions" }),
      expect.any(Error),
    );
  });
});
