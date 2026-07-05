/**
 * Risk Explanation Agent — nominal end-to-end path + selection formulation matrix.
 *
 * Batch 2/6, `series_opus_agentic_hearst-defi` (agentic-full-test). Gap closed
 * (see `docs/projects/agentic-full-test/COVERAGE_MATRIX.md` §Zone 4 priority 1):
 * existing coverage (`provenance.test.ts`, `assumption-citation.test.ts`) only
 * ever mocks a single static "market risk, 1 entry" response — none of them
 * exercise the tie-break (2 entries) path, or capture the exact structure/
 * fields/status of what the agent actually returns. This file drives
 * `runRiskExplanation` end-to-end for the tie and non-tie selection cases,
 * plus the reject/edge formulations from `COVERAGE_MATRIX.md` Partie 2.
 *
 * Mocking strategy mirrors `provenance.test.ts` / `mining-health-nominal.test.ts`.
 * No real DLLM request in this file — see `canary-dllm.test.ts`.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LlmParams } from "@/lib/llm/client";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", () => ({
  prisma: {
    llmRun: {
      create: vi.fn().mockResolvedValue({ id: "mock-run-id" }),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

let responseQueue: string[] = [];
const capturedParams: LlmParams[] = [];

vi.mock("@/lib/llm/client", () => ({
  callLlm: vi.fn(async (_agentName: string, params: LlmParams) => {
    capturedParams.push(params);
    const text = responseQueue.shift();
    if (!text) throw new Error("risk-explanation mock: responseQueue exhausted");
    return {
      response: {
        content: [{ type: "text", text }],
        usage: { input_tokens: 10, output_tokens: 50 },
      },
      latencyMs: 0,
      runId: "mock-run-id",
    };
  }),
}));

import { runRiskExplanation, type RiskExplanationInput } from "@/lib/agents/risk-explanation";

function queueResponse(obj: unknown) {
  responseQueue.push(JSON.stringify(obj));
}

beforeEach(() => {
  responseQueue = [];
  capturedParams.length = 0;
});

/** One dominant dimension (market=62), rest well clear of a 3-point tie. */
const SINGLE_WINNER: RiskExplanationInput["componentScores"] = {
  market: 62,
  mining: 45,
  liquidity: 30,
  smart_contract: 42,
  counterparty: 25,
};

/** market and mining tied within 3 points (62 vs 60) → both should qualify. */
const TIE_WITHIN_3: RiskExplanationInput["componentScores"] = {
  market: 62,
  mining: 60,
  liquidity: 30,
  smart_contract: 42,
  counterparty: 25,
};

describe("runRiskExplanation — nominal path, single winner", () => {
  it("returns the exact structure/fields/status for a clear single-dimension case", async () => {
    queueResponse({
      top_risks: [
        {
          risk_id: "market",
          name: "Market Risk",
          explanation:
            "Under the assumption that BTC price stays within the current range, market risk is the most elevated dimension at 62/100.",
          suggested_guardrail: "Consider reviewing the tactical sleeve size per Rule RISK-02.",
        },
      ],
      overall_summary:
        "Under the assumption that mining economics remain stable, overall posture is moderate, driven primarily by market risk.",
    });

    const result = await runRiskExplanation({
      riskScore: 58,
      componentScores: SINGLE_WINNER,
      mode: "base",
    });

    expect(result.top_risks).toHaveLength(1);
    expect(result.top_risks[0]).toEqual({
      risk_id: "market",
      name: "Market Risk",
      explanation:
        "Under the assumption that BTC price stays within the current range, market risk is the most elevated dimension at 62/100.",
      suggested_guardrail: "Consider reviewing the tactical sleeve size per Rule RISK-02.",
    });
    expect(Object.keys(result).sort()).toEqual(["overall_summary", "top_risks"]);
  });
});

describe("runRiskExplanation — nominal path, tie-break within 3 points", () => {
  it("accepts 2 top_risks when two dimensions are within 3 points of each other", async () => {
    queueResponse({
      top_risks: [
        {
          risk_id: "market",
          name: "Market Risk",
          explanation:
            "Under the assumption that BTC price stays within the current range, market risk is elevated at 62/100.",
          suggested_guardrail: "Consider reviewing the tactical sleeve size per Rule RISK-02.",
        },
        {
          risk_id: "mining",
          name: "Mining Risk",
          explanation:
            "Assuming hashprice stays within recent bounds, mining risk is closely elevated at 60/100.",
          suggested_guardrail: "Consider reviewing the mining allocation per Rule RISK-01.",
        },
      ],
      overall_summary:
        "Under the assumption that both BTC price and hashprice stay range-bound, market and mining risk are jointly elevated.",
    });

    const result = await runRiskExplanation({
      riskScore: 61,
      componentScores: TIE_WITHIN_3,
      mode: "base",
    });

    expect(result.top_risks).toHaveLength(2);
    expect(result.top_risks.map((r) => r.risk_id).sort()).toEqual(["market", "mining"]);
  });

  it("threads the exact component scores into the user prompt (no silent drop)", async () => {
    queueResponse({
      top_risks: [
        {
          risk_id: "market",
          name: "Market Risk",
          explanation: "Under the assumption that BTC price stays range-bound, market risk is elevated.",
          suggested_guardrail: "Consider reviewing exposure.",
        },
      ],
      overall_summary: "Under the assumption of stable conditions, posture is moderate.",
    });
    await runRiskExplanation({ riskScore: 58, componentScores: SINGLE_WINNER, mode: "base" });
    const userPrompt = capturedParams[0]!.messages[0]!.content as string;
    expect(userPrompt).toContain('"market": 62');
    expect(userPrompt).toContain('"counterparty": 25');
    expect(userPrompt).toContain("Global risk score: 58");
  });
});

describe("runRiskExplanation — reject formulations", () => {
  it("rejects a forbidden word injected into an explanation", async () => {
    queueResponse({
      top_risks: [
        {
          risk_id: "market",
          name: "Market Risk",
          explanation: "We guarantee market risk stays contained, under the assumption of stable BTC price.",
          suggested_guardrail: "Consider reviewing exposure.",
        },
      ],
      overall_summary: "Under the assumption of stable conditions, posture is moderate.",
    });
    await expect(
      runRiskExplanation({ riskScore: 58, componentScores: SINGLE_WINNER, mode: "base" }),
    ).rejects.toThrow(/forbidden word/i);
  });

  it("rejects an overall_summary that cites no assumption at all", async () => {
    queueResponse({
      top_risks: [
        {
          risk_id: "market",
          name: "Market Risk",
          explanation: "Under the assumption that BTC price stays range-bound, market risk is elevated.",
          suggested_guardrail: "Consider reviewing exposure.",
        },
      ],
      overall_summary: "Overall posture is moderate.",
    });
    await expect(
      runRiskExplanation({ riskScore: 58, componentScores: SINGLE_WINNER, mode: "base" }),
    ).rejects.toThrow(/does not reference any assumption/i);
  });

  it("rejects a risk_id outside the 5 canonical dimensions (schema fail-safe)", async () => {
    queueResponse({
      top_risks: [
        {
          risk_id: "regulatory",
          name: "Regulatory Risk",
          explanation: "Under the assumption of stable regulation, this risk is elevated.",
          suggested_guardrail: "Consider legal review.",
        },
      ],
      overall_summary: "Under the assumption of stable conditions, posture is moderate.",
    });
    await expect(
      runRiskExplanation({ riskScore: 58, componentScores: SINGLE_WINNER, mode: "base" }),
    ).rejects.toThrow(/schema validation/i);
  });

  it("rejects more than 2 top_risks (schema max(2), no silent truncation)", async () => {
    queueResponse({
      top_risks: [
        {
          risk_id: "market",
          name: "Market Risk",
          explanation: "Under the assumption that BTC price stays range-bound, market risk is elevated.",
          suggested_guardrail: "Consider reviewing exposure.",
        },
        {
          risk_id: "mining",
          name: "Mining Risk",
          explanation: "Under the assumption that hashprice stays flat, mining risk is elevated.",
          suggested_guardrail: "Consider reviewing mining allocation.",
        },
        {
          risk_id: "liquidity",
          name: "Liquidity Risk",
          explanation: "Under the assumption of stable redemptions, liquidity risk is elevated.",
          suggested_guardrail: "Consider reviewing the redemption buffer.",
        },
      ],
      overall_summary: "Under the assumption of stable conditions, posture is moderate.",
    });
    await expect(
      runRiskExplanation({ riskScore: 58, componentScores: SINGLE_WINNER, mode: "base" }),
    ).rejects.toThrow(/schema validation/i);
  });

  it("rejects zero top_risks (schema min(1))", async () => {
    queueResponse({
      top_risks: [],
      overall_summary: "Under the assumption of stable conditions, posture is moderate.",
    });
    await expect(
      runRiskExplanation({ riskScore: 58, componentScores: SINGLE_WINNER, mode: "base" }),
    ).rejects.toThrow(/schema validation/i);
  });
});

describe("runRiskExplanation — edge / documented gap: selection is prompt-trusted, not code-enforced", () => {
  it("DOCUMENTED GAP: accepts a top_risks selection that ignores the highest-score rule", async () => {
    // buildSystemInstructions instructs the model to pick the 1-2 HIGHEST componentScores
    // (with a 3-point tie-break), but runRiskExplanation never recomputes the top-N from
    // componentScores and cross-checks risk_id. A model that names the wrong dimension
    // (e.g. counterparty=25, the LOWEST score in SINGLE_WINNER) still passes schema
    // validation and every post-validator. Recorded as a passing characterization test —
    // same category of gap as mining-health's alert_level (see COVERAGE_MATRIX.md §Zone 4
    // priority 1). Fixing it is a product-code change outside this batch's test-only scope.
    queueResponse({
      top_risks: [
        {
          risk_id: "counterparty", // lowest score (25) in SINGLE_WINNER — not the top dimension
          name: "Counterparty Risk",
          explanation: "Under the assumption of stable counterparty relationships, this risk is elevated.",
          suggested_guardrail: "Consider reviewing counterparty exposure.",
        },
      ],
      overall_summary: "Under the assumption of stable conditions, posture is moderate.",
    });
    const result = await runRiskExplanation({
      riskScore: 58,
      componentScores: SINGLE_WINNER,
      mode: "base",
    });
    expect(result.top_risks[0]!.risk_id).toBe("counterparty"); // accepted as-is — no code-level selection enforcement today
  });

  it("system prompt states the exact per-dimension thresholds (locks the only source of truth for the invariant)", async () => {
    queueResponse({
      top_risks: [
        {
          risk_id: "market",
          name: "Market Risk",
          explanation: "Under the assumption that BTC price stays range-bound, market risk is elevated.",
          suggested_guardrail: "Consider reviewing exposure.",
        },
      ],
      overall_summary: "Under the assumption of stable conditions, posture is moderate.",
    });
    await runRiskExplanation({ riskScore: 58, componentScores: SINGLE_WINNER, mode: "base" });
    const systemBlocks = capturedParams[0]!.system;
    const systemText = Array.isArray(systemBlocks)
      ? systemBlocks.map((b) => (typeof b === "string" ? b : b.text)).join("\n")
      : (systemBlocks ?? "");
    expect(systemText).toContain("market:          green <40 / amber 40-65 / red >65");
    expect(systemText).toContain("mining:          green <30 / amber 30-60 / red >60");
    expect(systemText).toMatch(/tied within 3 points, include both/);
  });
});
