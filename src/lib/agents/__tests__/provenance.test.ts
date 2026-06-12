/**
 * PR-4 — data provenance is THREADED into the 4 structured agents (CLAUDE.md
 * non-negotiable #2). These tests lock the invariant that every agent:
 *   1. injects the shared provenance system rule into its system prompt, and
 *   2. renders the per-metric / per-section provenance INTO the user prompt,
 *      flagging degraded data (Estimated / Stale / fallback / Manual / Pending)
 *      in-line so the model can never present it as attested fact.
 *
 * Strategy mirrors `agent-user-context.test.ts`: mock `server-only`,
 * `@/lib/db` (Prisma), and `@/lib/llm/client` (capture `params`), then run
 * each agent with a real input carrying a degraded provenance tag and assert
 * the captured prompt qualifies the numbers.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LlmParams } from "@/lib/llm/client";

// ---- module mocks (must precede any module-under-test import) --------------

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", () => ({
  prisma: {
    llmRun: {
      create: vi.fn().mockResolvedValue({ id: "mock-run-id" }),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

// Capture every `params` handed to callLlm. Module-level so each test inspects
// the latest call after clearing in beforeEach.
const capturedParams: Array<{ agentName: string; params: LlmParams }> = [];

vi.mock("@/lib/llm/client", () => ({
  callLlm: vi.fn(async (agentName: string, params: LlmParams) => {
    capturedParams.push({ agentName, params });
    const text =
      agentName === "investor-memo"
        ? JSON.stringify({
            executive_summary:
              "Under the assumption that hashprice stays within range, the vault targets a 9.00-12.00% APY range.",
            vault_structure:
              "Cayman SPV with a $250k minimum. Under the assumption of stable regulation, lock-up is 60 days.",
            scenario_analysis:
              "Under the assumption of flat hashprice, projected APY range is 9.00-12.00%.",
            risk_section:
              "Under the assumption of stable on-chain conditions, market risk is moderate.",
            mining_section:
              "Under the assumption that energy cost stays flat, mining margin remains positive.",
            performance_section:
              "Under the assumption of historical drawdown patterns, maxDrawdownPct was 5.2% and totalReturnPct was 11.4%.",
            methodology_note:
              "Under the assumption that methodology v1.0 remains current, this memo follows the spec.",
            disclaimer:
              "Past performance is not indicative of future results. Outcomes are not guaranteed.",
          })
        : agentName === "mining-health"
          ? JSON.stringify({
              alert_level: "green",
              summary:
                "Under the assumption that hashprice stays flat, margins are healthy at 17.5%.",
              recommendation: "Suggest continued monitoring of the hosting contract.",
            })
          : agentName === "risk-explanation"
            ? JSON.stringify({
                top_risks: [
                  {
                    risk_id: "market",
                    name: "Market Risk",
                    explanation:
                      "Under the assumption that BTC price stays within the current range, market risk is elevated.",
                    suggested_guardrail:
                      "Consider reviewing the tactical sleeve size per Rule RISK-02.",
                  },
                ],
                overall_summary:
                  "Under the assumption that mining economics remain stable, the overall posture is moderate.",
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
  }),
}));

// ---- imports (after mocks) --------------------------------------------------

import {
  PROVENANCE_SYSTEM_RULE,
  PROVENANCE_TAGS,
  ProvenanceTagSchema,
  isDegradedProvenance,
  provenanceLabel,
  renderProvenanceLine,
  type ProvenanceTag,
} from "@/lib/agents/schemas";
import { runMiningHealth } from "@/lib/agents/mining-health";
import { runRiskExplanation } from "@/lib/agents/risk-explanation";
import { runScenarioNarrative } from "@/lib/agents/scenario-narrative";
import { runInvestorMemo } from "@/lib/agents/investor-memo";
import type { MiningHealthInput } from "@/lib/agents/mining-health";
import type { InvestorMemoInput } from "@/lib/agents/investor-memo";
import type { ScenarioOutput } from "@/lib/engine/types";

// ---- helpers ----------------------------------------------------------------

/** Concatenate every system block + user message of the latest captured call. */
function latestPromptText(): string {
  const last = capturedParams[capturedParams.length - 1];
  if (!last) throw new Error("No captured callLlm params.");
  const { params } = last;
  const systemText = Array.isArray(params.system)
    ? params.system
        .map((b) => (typeof b === "string" ? b : b.text))
        .join("\n")
    : (params.system ?? "");
  const userText = params.messages
    .map((m) => (typeof m.content === "string" ? m.content : m.content.map((c) => c.text).join("\n")))
    .join("\n");
  return `${systemText}\n${userText}`;
}

/** The user message only (no system blocks) of the latest captured call. */
function latestUserPrompt(): string {
  const last = capturedParams[capturedParams.length - 1];
  if (!last) throw new Error("No captured callLlm params.");
  const m = last.params.messages[0];
  if (!m) throw new Error("No user message captured.");
  return typeof m.content === "string"
    ? m.content
    : m.content.map((c) => c.text).join("\n");
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
      { bucket: "mining", pct: 60, yield_contribution_bps: 480 },
      { bucket: "usdc_base", pct: 40, yield_contribution_bps: 200 },
    ],
    assumptions: ["hashprice_usd_th_day=0.08", "energy_cost_kwh=0.045"],
    btc_tactical: { triggers: [], guardrails: [], targetExposurePct: 0 },
  };
}

beforeEach(() => {
  capturedParams.length = 0;
});

// ---------------------------------------------------------------------------
// Schema helpers
// ---------------------------------------------------------------------------

describe("provenance vocabulary (schemas.ts)", () => {
  it("exposes the canonical tag set as a Zod enum", () => {
    expect([...PROVENANCE_TAGS]).toEqual([
      "attested",
      "live",
      "oracle",
      "manual",
      "estimated",
      "stale",
      "fallback",
      "pending",
    ]);
    for (const tag of PROVENANCE_TAGS) {
      expect(ProvenanceTagSchema.parse(tag)).toBe(tag);
    }
    expect(() => ProvenanceTagSchema.parse("bogus")).toThrow();
  });

  it("maps every tag onto the badge vocabulary (Live/Oracle/Attested/Estimated/Manual/Stale)", () => {
    expect(provenanceLabel("live")).toBe("Live");
    expect(provenanceLabel("oracle")).toBe("Oracle");
    expect(provenanceLabel("attested")).toBe("Attested");
    expect(provenanceLabel("estimated")).toBe("Estimated");
    expect(provenanceLabel("manual")).toBe("Manual");
    expect(provenanceLabel("stale")).toBe("Stale");
    expect(provenanceLabel("fallback")).toContain("Estimated");
    expect(provenanceLabel("pending")).toBe("Pending");
  });

  it("classifies degraded vs trustworthy tags", () => {
    expect(isDegradedProvenance("attested")).toBe(false);
    expect(isDegradedProvenance("live")).toBe(false);
    expect(isDegradedProvenance("oracle")).toBe(false);
    expect(isDegradedProvenance("estimated")).toBe(true);
    expect(isDegradedProvenance("stale")).toBe(true);
    expect(isDegradedProvenance("fallback")).toBe(true);
    expect(isDegradedProvenance("manual")).toBe(true);
    expect(isDegradedProvenance("pending")).toBe(true);
  });

  it("renderProvenanceLine flags degraded tags in-line but not trustworthy ones", () => {
    const degraded = renderProvenanceLine("margin_pct", "estimated");
    expect(degraded).toContain("margin_pct");
    expect(degraded).toContain("Estimated");
    expect(degraded).toMatch(/FLAG IN-LINE/);

    const attested = renderProvenanceLine("uptime_pct", "attested");
    expect(attested).toContain("Attested");
    expect(attested).not.toMatch(/FLAG IN-LINE/);
  });

  it("PROVENANCE_SYSTEM_RULE names the full badge vocabulary and the flag mandate", () => {
    expect(PROVENANCE_SYSTEM_RULE).toMatch(/Live \/ Oracle \/ Attested \/ Estimated \/ Manual \/ Stale/);
    expect(PROVENANCE_SYSTEM_RULE).toMatch(/flag/i);
    expect(PROVENANCE_SYSTEM_RULE).toMatch(/non-negotiable #2/);
  });
});

// ---------------------------------------------------------------------------
// Mining Health agent
// ---------------------------------------------------------------------------

describe("mining-health agent threads per-metric provenance", () => {
  const base: MiningHealthInput = {
    hashprice_usd_per_th: 0.085,
    difficulty_change_pct: 3.2,
    margin_pct: 17.5,
    uptime_pct: 98.4,
    period_days: 30,
  };

  it("injects the provenance system rule", async () => {
    await runMiningHealth(base, { client: undefined });
    expect(latestPromptText()).toContain(PROVENANCE_SYSTEM_RULE);
  });

  it("renders attested provenance per metric when nothing is degraded", async () => {
    await runMiningHealth(base);
    const user = latestUserPrompt();
    expect(user).toMatch(/hashprice_usd_per_th provenance: Attested/);
    expect(user).toMatch(/margin_pct provenance: Attested/);
    expect(user).not.toMatch(/FLAG IN-LINE/);
  });

  it("flags a fallback / stale metric in-line and does not present it as attested", async () => {
    await runMiningHealth({
      ...base,
      provenance: {
        hashprice_usd_per_th: "stale",
        difficulty_change_pct: "estimated",
        margin_pct: "fallback",
        uptime_pct: "estimated",
      },
    });
    const user = latestUserPrompt();
    expect(user).toMatch(/hashprice_usd_per_th provenance: Stale — FLAG IN-LINE/);
    expect(user).toMatch(/margin_pct provenance: Estimated \(fallback\) — FLAG IN-LINE/);
    // A degraded metric must NEVER be labelled Attested.
    expect(user).not.toMatch(/margin_pct provenance: Attested/);
  });
});

// ---------------------------------------------------------------------------
// Risk Explanation agent
// ---------------------------------------------------------------------------

describe("risk-explanation agent threads score provenance", () => {
  const componentScores = {
    market: 62,
    mining: 45,
    liquidity: 30,
    smart_contract: 42,
    counterparty: 25,
  };

  it("injects the provenance system rule", async () => {
    await runRiskExplanation({ riskScore: 58, componentScores, mode: "base" });
    expect(latestPromptText()).toContain(PROVENANCE_SYSTEM_RULE);
  });

  it("renders attested when source provenance is attested", async () => {
    await runRiskExplanation({
      riskScore: 58,
      componentScores,
      mode: "base",
      provenance: "attested",
    });
    const user = latestUserPrompt();
    expect(user).toMatch(/Risk-score provenance: Attested/);
    expect(user).not.toMatch(/NOT fully attested/);
  });

  it("flags a fallback risk source in-line", async () => {
    await runRiskExplanation({
      riskScore: 58,
      componentScores,
      mode: "base",
      provenance: "fallback",
    });
    const user = latestUserPrompt();
    expect(user).toMatch(/Risk-score provenance: Estimated \(fallback\)/);
    expect(user).toMatch(/NOT fully attested/);
  });
});

// ---------------------------------------------------------------------------
// Scenario Narrative agent
// ---------------------------------------------------------------------------

describe("scenario-narrative agent threads projection provenance", () => {
  it("injects the provenance system rule", async () => {
    await runScenarioNarrative({
      scenario_id: "base",
      scenario_output: makeScenarioOutput(),
    });
    expect(latestPromptText()).toContain(PROVENANCE_SYSTEM_RULE);
  });

  it("defaults the projection to Estimated and flags it (a scenario is never attested)", async () => {
    await runScenarioNarrative({
      scenario_id: "base",
      scenario_output: makeScenarioOutput(),
    });
    const user = latestUserPrompt();
    expect(user).toMatch(/scenario projection.*provenance: Estimated — FLAG IN-LINE/);
  });

  it("renders the coverage provenance when threaded", async () => {
    await runScenarioNarrative({
      scenario_id: "base",
      scenario_output: makeScenarioOutput(),
      provenance: { projection: "estimated", coverage: "pending" },
    });
    const user = latestUserPrompt();
    expect(user).toMatch(/distribution coverage ratio provenance: Pending/);
  });
});

// ---------------------------------------------------------------------------
// Investor Memo agent
// ---------------------------------------------------------------------------

describe("investor-memo agent threads per-section provenance", () => {
  const base: InvestorMemoInput = {
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

  it("injects the provenance system rule", async () => {
    await runInvestorMemo(base);
    expect(latestPromptText()).toContain(PROVENANCE_SYSTEM_RULE);
  });

  it("renders a provenance line per data domain", async () => {
    await runInvestorMemo(base);
    const user = latestUserPrompt();
    expect(user).toMatch(/vault state.*provenance:/);
    expect(user).toMatch(/mining \/ cash-flow.*provenance:/);
    expect(user).toMatch(/distribution coverage ratio provenance:/);
    expect(user).toMatch(/scenario projections provenance:/);
    expect(user).toMatch(/backtest results provenance:/);
  });

  it("flags an Estimated coverage and a Stale vault snapshot in-line", async () => {
    await runInvestorMemo({
      ...base,
      provenance: {
        vault: "stale",
        mining: "estimated",
        coverage: "estimated",
        scenarios: "attested",
        backtests: "attested",
      },
    });
    const user = latestUserPrompt();
    expect(user).toMatch(/vault state.*provenance: Stale — FLAG IN-LINE/);
    expect(user).toMatch(/distribution coverage ratio provenance: Estimated — FLAG IN-LINE/);
    // Trustworthy sections are NOT flagged.
    expect(user).toMatch(/scenario projections provenance: Attested(?! — FLAG)/);
  });
});

// ---------------------------------------------------------------------------
// Type-level guard: every tag is a valid ProvenanceTag (no drift).
// ---------------------------------------------------------------------------

describe("ProvenanceTag exhaustiveness", () => {
  it("provenanceLabel is total over the enum", () => {
    for (const tag of PROVENANCE_TAGS) {
      const t: ProvenanceTag = tag;
      expect(typeof provenanceLabel(t)).toBe("string");
    }
  });
});
