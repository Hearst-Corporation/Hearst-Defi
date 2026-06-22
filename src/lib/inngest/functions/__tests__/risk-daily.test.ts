import { describe, expect, it, vi, beforeEach } from "vitest";

import type { RiskExplanationOutput } from "@/lib/agents/schemas";
import type { RiskFrameworkData } from "@/lib/data/risk-framework";

// ---------------------------------------------------------------------------
// Mocks — declared before any module under test is imported so Vitest hoisting
// applies correctly.
// ---------------------------------------------------------------------------

/**
 * Fake risk framework data returned by the data loader.
 * Uses the canonical `mining` key (loader and agent schema now agree;
 * the historical `mining_ops` dashboard key was retired in V3.h cleanup).
 */
const riskFrameworkFake: RiskFrameworkData = {
  composite: 58,
  band: "medium",
  bandLabel: "Moderate",
  source: "db",
  dimensions: [
    { id: "market", label: "Market", score: 62, status: "ELEVATED", severity: "medium", detail: "BTC vol index 50/100." },
    { id: "mining", label: "Mining Operations", score: 45, status: "MONITORED", severity: "medium", detail: "Margin score 64/100." },
    { id: "liquidity", label: "Liquidity", score: 30, status: "HEALTHY", severity: "low", detail: "Stable." },
    { id: "smart_contract", label: "Smart Contract", score: 42, status: "MONITORED", severity: "medium", detail: "Pre-audit." },
    { id: "counterparty", label: "Counterparty", score: 25, status: "OPTIMAL", severity: "low", detail: "Diversified." },
  ],
};

const loadRiskFrameworkMock = vi.fn(async () => riskFrameworkFake);

vi.mock("@/lib/data/risk-framework", () => ({
  loadRiskFramework: loadRiskFrameworkMock,
}));

/**
 * Fake agent output — passes forbidden-words constraints, cites assumptions.
 */
const agentOutputFake: RiskExplanationOutput = {
  top_risks: [
    {
      risk_id: "market",
      name: "Market Risk",
      explanation:
        "Under the assumption that BTC price stays within the current range, market risk is elevated given the vol index reading.",
      suggested_guardrail:
        "Consider reviewing the tactical sleeve size per Rule RISK-02.",
    },
  ],
  overall_summary:
    "Under the assumption that mining economics remain stable, the overall risk posture is moderate.",
};

const runRiskExplanationMock = vi.fn(async () => agentOutputFake);

vi.mock("@/lib/agents/risk-explanation", () => ({
  runRiskExplanation: runRiskExplanationMock,
}));

/**
 * Mock idempotency helpers so no Prisma writes happen.
 */
const isDuplicateMock = vi.fn(async () => false);
const markCompleteMock = vi.fn(async () => undefined);

vi.mock("@/lib/idempotency", () => ({
  isDuplicate: isDuplicateMock,
  markComplete: markCompleteMock,
}));

/**
 * Mock the Inngest client's `send` — we don't want real event dispatches.
 */
const inngestSendMock = vi.fn(async () => undefined);

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    send: inngestSendMock,
    createFunction: vi.fn((opts: unknown, handler: unknown) => ({
      opts,
      handler,
      name: (opts as { id: string }).id,
    })),
  },
}));

// ---------------------------------------------------------------------------
// Minimal step shim — runs each callback inline (no Inngest network calls).
// ---------------------------------------------------------------------------

const stepShim = {
  run: <T,>(_name: string, fn: () => T | Promise<T>): Promise<T> =>
    Promise.resolve(fn()),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("riskDaily Inngest function", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isDuplicateMock.mockResolvedValue(false);
  });

  // ---- Registration -------------------------------------------------------

  it("registers with id 'risk-daily'", async () => {
    const { riskDaily, RISK_DAILY_ID } = await import(
      "@/lib/inngest/functions/risk-daily"
    );
    expect(RISK_DAILY_ID).toBe("risk-daily");
    expect((riskDaily as { opts: { id: string } }).opts.id).toBe("risk-daily");
  });

  it("uses the 09:30 UTC daily cron expression", async () => {
    const { riskDaily, RISK_DAILY_CRON } = await import(
      "@/lib/inngest/functions/risk-daily"
    );
    expect(RISK_DAILY_CRON).toBe("30 9 * * *");

    const triggers = (riskDaily as { opts: { triggers?: Array<{ cron?: string }> } }).opts.triggers;
    expect(triggers).toBeDefined();
    expect(triggers).toHaveLength(1);
    const trigger = triggers?.[0];
    if (!trigger || !("cron" in trigger)) {
      throw new Error("Expected a cron trigger on riskDaily.");
    }
    expect(trigger.cron).toBe("30 9 * * *");
  });

  it("enforces concurrency limit = 1", async () => {
    const { riskDaily } = await import("@/lib/inngest/functions/risk-daily");
    const concurrency = (riskDaily as { opts: { concurrency?: { limit: number } } }).opts.concurrency;
    expect(concurrency?.limit).toBe(1);
  });

  // ---- Case A: First run of the day ---------------------------------------

  it("Case A — first run: fetches data, invokes agent, emits completion event", async () => {
    isDuplicateMock.mockResolvedValue(false);

    const { riskDailyHandler } = await import(
      "@/lib/inngest/functions/risk-daily"
    );

    const result = await riskDailyHandler({ step: stepShim });

    // loadRiskFramework called
    expect(loadRiskFrameworkMock).toHaveBeenCalledTimes(1);

    // Agent called with canonical dimension keys (loader already emits the
    // canonical `mining` key — no remap needed).
    expect(runRiskExplanationMock).toHaveBeenCalledTimes(1);
    const agentCalls = runRiskExplanationMock.mock.calls;
    expect(agentCalls.length).toBeGreaterThan(0);
    const agentCall = agentCalls[0] as unknown[];
    const agentInput = agentCall[0] as { riskScore: number; componentScores: Record<string, number>; mode: string; provenance?: string };
    expect(agentInput.riskScore).toBe(58);
    expect(agentInput.mode).toBe("base");
    // Provenance (CLAUDE.md #2): the loader reported source="db" → the agent
    // must receive `attested` so the scores are qualified, not stripped.
    expect(agentInput.provenance).toBe("attested");
    // Canonical pass-through — historical `mining_ops` key must never appear.
    expect(agentInput.componentScores["mining"]).toBe(45);
    expect("mining_ops" in agentInput.componentScores).toBe(false);
    expect(agentInput.componentScores["market"]).toBe(62);
    expect(agentInput.componentScores["liquidity"]).toBe(30);

    // Idempotency checks the real LlmRun agent name (no synthetic markComplete)
    expect(isDuplicateMock).toHaveBeenCalledWith(
      "risk-daily",
      expect.any(Date),
      { llmAgentName: "risk-explanation" },
    );

    // Completion event emitted
    expect(inngestSendMock).toHaveBeenCalledTimes(1);
    const eventCalls = inngestSendMock.mock.calls;
    expect(eventCalls.length).toBeGreaterThan(0);
    const eventCall = eventCalls[0] as unknown[];
    const eventPayload = eventCall[0] as { name: string; data: Record<string, unknown> };
    expect(eventPayload.name).toBe("risk.daily.completed");
    expect(eventPayload.data["topRiskIds"]).toEqual(["market"]);
    expect(eventPayload.data["composite"]).toBe(58);

    // Return shape
    expect("status" in result ? result.status : null).toBe("completed");
    if ("status" in result) {
      expect(result.topRiskIds).toEqual(["market"]);
    }
  });

  // ---- Provenance threading (CLAUDE.md #2) --------------------------------

  it("maps loader source 'partial' → agent provenance 'estimated'", async () => {
    isDuplicateMock.mockResolvedValue(false);
    loadRiskFrameworkMock.mockResolvedValueOnce({
      ...riskFrameworkFake,
      source: "partial",
    });

    const { riskDailyHandler } = await import(
      "@/lib/inngest/functions/risk-daily"
    );
    await riskDailyHandler({ step: stepShim });

    const agentCall = runRiskExplanationMock.mock.calls[0] as unknown[];
    const agentInput = agentCall[0] as { provenance?: string };
    expect(agentInput.provenance).toBe("estimated");
  });

  it("maps loader source 'fallback' → agent provenance 'fallback'", async () => {
    isDuplicateMock.mockResolvedValue(false);
    loadRiskFrameworkMock.mockResolvedValueOnce({
      ...riskFrameworkFake,
      source: "fallback",
    });

    const { riskDailyHandler } = await import(
      "@/lib/inngest/functions/risk-daily"
    );
    await riskDailyHandler({ step: stepShim });

    const agentCall = runRiskExplanationMock.mock.calls[0] as unknown[];
    const agentInput = agentCall[0] as { provenance?: string };
    expect(agentInput.provenance).toBe("fallback");
  });

  // ---- Case B: Replay / idempotency hit -----------------------------------

  it("Case B — idempotency hit: skips without calling agent or emitting event", async () => {
    isDuplicateMock.mockResolvedValue(true);

    const { riskDailyHandler } = await import(
      "@/lib/inngest/functions/risk-daily"
    );

    const result = await riskDailyHandler({ step: stepShim });

    expect(loadRiskFrameworkMock).not.toHaveBeenCalled();
    expect(runRiskExplanationMock).not.toHaveBeenCalled();
    expect(markCompleteMock).not.toHaveBeenCalled();
    expect(inngestSendMock).not.toHaveBeenCalled();

    expect("skipped" in result ? result.skipped : false).toBe(true);
    if ("skipped" in result) {
      expect(result.reason).toBe("already_ran");
    }
  });

  // ---- Case C: Agent failure (forbidden-words / Anthropic timeout) --------

  it("Case C — agent failure: propagates the error for Inngest retry", async () => {
    isDuplicateMock.mockResolvedValue(false);
    const agentError = new Error(
      "Risk Explanation agent output failed schema validation: forbidden word detected",
    );
    runRiskExplanationMock.mockRejectedValueOnce(agentError);

    const { riskDailyHandler } = await import(
      "@/lib/inngest/functions/risk-daily"
    );

    await expect(riskDailyHandler({ step: stepShim })).rejects.toThrow(
      agentError,
    );

    // Data was fetched before the agent was called
    expect(loadRiskFrameworkMock).toHaveBeenCalledTimes(1);
    // markComplete and event must NOT have been called — run did not succeed
    expect(markCompleteMock).not.toHaveBeenCalled();
    expect(inngestSendMock).not.toHaveBeenCalled();
  });
});
