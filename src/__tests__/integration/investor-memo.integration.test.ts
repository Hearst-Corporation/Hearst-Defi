import { describe, expect, it, vi } from "vitest";

import { runInvestorMemo, INVESTOR_MEMO_MODEL } from "@/lib/agents/investor-memo";
import { prisma } from "@/lib/db";
import type { InvestorMemoInput } from "@/lib/agents/investor-memo";

/** OpenAI-SDK-style error: an Error carrying an HTTP `status`. The client
 *  classifies retryability by the numeric `status`, not by any SDK class. */
function apiError(status: number, message: string): Error {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

describe("Investor Memo integration", () => {
  it("generates a memo and persists a LlmRun record", async () => {
    const mockResponse = {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            executive_summary: "Under the assumption that hashprice remains stable, the vault targets 9–12% APY.",
            vault_structure: "Based on the stated assumption of a Cayman SPV wrapper, the structure isolates investor liability.",
            scenario_analysis: "Under the assumption that BTC price holds, the scenario projects 10% APY range.",
            risk_section: "Under the assumption of moderate volatility, the risk score of 38 reflects measured exposure.",
            mining_section: "Under the assumption of stable energy costs, mining margins remain healthy.",
            performance_section: "Based on the assumption that historical hashprice patterns persist, performance tracks the projected band.",
            methodology_note: "This narrative is built on the assumption that the rule-based engine inputs stay within published bounds.",
            disclaimer: "Test disclaimer.",
          }),
        },
      ],
      usage: { input_tokens: 500, output_tokens: 300 },
    };

    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue(mockResponse),
      },
    };

    const input: InvestorMemoInput = {
      vault: {
        aumUsdc: 12_500_000,
        apyRange: { low: 9.2, high: 12.8 },
        mode: "balanced",
        riskScore: 38,
      },
      scenarios: [],
      backtests: [],
      generatedAt: new Date().toISOString(),
    };

    const result = await runInvestorMemo(input, { client: mockClient });

    expect(result.executive_summary).toContain("assumption");
    expect(mockClient.messages.create).toHaveBeenCalledTimes(1);

    // Verify LlmRun was persisted
    const runs = await prisma.llmRun.findMany({
      where: { agentName: "investor-memo" },
      orderBy: { createdAt: "desc" },
      take: 1,
    });

    expect(runs.length).toBe(1);
    const run = runs[0];
    expect(run).toBeDefined();
    if (run) {
      expect(run.status).toBe("success");
      expect(run.model).toBe(INVESTOR_MEMO_MODEL);
      expect(run.inputTokens).toBe(500);
      expect(run.outputTokens).toBe(300);
      expect(run.costUsd).toBeGreaterThan(0);
    }
  });

  it("retries on 429 and eventually succeeds", async () => {
    const mockResponse = {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            executive_summary: "Under the assumption that hashprice remains stable, this retry summary projects 9–12% APY.",
            vault_structure: "Based on the stated assumption of a Cayman SPV wrapper, the retry structure isolates investor liability.",
            scenario_analysis: "Under the assumption that BTC holds, the retry scenario projects stable returns.",
            risk_section: "Under the assumption of moderate volatility, the retry risk section reports a score of 38.",
            mining_section: "Under the assumption of stable energy costs, retry mining section details margin.",
            performance_section: "Based on the assumption that historical hashprice patterns persist, retry performance tracks the band.",
            methodology_note: "This retry note rests on the assumption that the rule-based engine inputs stay within published bounds.",
            disclaimer: "Retry disclaimer.",
          }),
        },
      ],
      usage: { input_tokens: 100, output_tokens: 50 },
    };

    const error429 = apiError(429, "Rate limited");

    const mockClient = {
      messages: {
        create: vi
          .fn()
          .mockRejectedValueOnce(error429)
          .mockResolvedValueOnce(mockResponse),
      },
    };

    const input: InvestorMemoInput = {
      vault: {
        aumUsdc: 12_500_000,
        apyRange: { low: 9.2, high: 12.8 },
        mode: "balanced",
        riskScore: 38,
      },
      scenarios: [],
      backtests: [],
      generatedAt: new Date().toISOString(),
    };

    const result = await runInvestorMemo(input, { client: mockClient });
    expect(result.executive_summary).toContain("assumption");
    expect(mockClient.messages.create).toHaveBeenCalledTimes(2);
  });
});
