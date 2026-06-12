import { describe, expect, it, vi } from "vitest";

import type { InvestorMemoInput } from "@/lib/agents/investor-memo";
import type { InvestorMemoOutput } from "@/lib/agents/schemas";

const loaderFake: InvestorMemoInput = {
  vault: {
    aumUsdc: 12_500_000,
    apyRange: { low: 9.2, high: 12.8 },
    mode: "balanced",
    riskScore: 38,
  },
  scenarios: [],
  backtests: [],
  generatedAt: "2026-01-01T00:00:00.000Z",
  // Loader resolves per-section provenance (CLAUDE.md #2); the handler must
  // forward it whole to the agent.
  provenance: {
    vault: "attested",
    mining: "attested",
    coverage: "pending",
    scenarios: "attested",
    backtests: "attested",
  },
};

const loadMemoInputMock = vi.fn(async () => loaderFake);

vi.mock("@/lib/agents/loaders/vault", () => ({
  loadMemoInput: loadMemoInputMock,
}));

const memoOutputFake: InvestorMemoOutput = {
  executive_summary:
    "Under the assumption that current market conditions persist, the vault is operating in balanced mode at 9.20-12.80%.",
  vault_structure:
    "Cayman SPV with single-vault posture, assumes 60-day soft lock-up.",
  scenario_analysis:
    "No scenarios were supplied this period; this assumes the cron seeded a baseline.",
  risk_section:
    "Market, mining, liquidity, smart_contract, counterparty — assumes current posture documented.",
  mining_section:
    "Hashrate, margin, energy, uptime — assumes 30-day rolling window.",
  performance_section:
    "No backtests supplied; this assumes the memo cron was triggered out-of-cycle.",
  methodology_note:
    "Methodology v1.0 — assumes the immutable rubric is up to date.",
  disclaimer:
    "Projection only; past performance is not indicative of future results. Outputs are not guaranteed.",
};

const runInvestorMemoMock = vi.fn(async (_input: InvestorMemoInput) => memoOutputFake);

vi.mock("@/lib/agents/investor-memo", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/agents/investor-memo")
  >("@/lib/agents/investor-memo");
  return {
    ...actual,
    runInvestorMemo: runInvestorMemoMock,
  };
});

/**
 * Mock Prisma so the persist step does not hit the real database.
 */
const reportExportCreateMock = vi.fn(
  async (args: { data: Record<string, unknown> }) => ({
    id: "mock-report-export-id",
    ...args.data,
  }),
);

const llmRunFindFirstMock = vi.fn(async () => null);
const llmRunCreateMock = vi.fn(async (args: { data: Record<string, unknown> }) => ({
  id: "mock-llm-run-id",
  ...args.data,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    reportExport: {
      create: reportExportCreateMock,
    },
    llmRun: {
      findFirst: llmRunFindFirstMock,
      create: llmRunCreateMock,
    },
  },
}));

describe("investorMemoMonthly Inngest function", () => {
  it("registers with id 'investor-memo-monthly'", async () => {
    const { investorMemoMonthly, INVESTOR_MEMO_MONTHLY_ID } = await import(
      "@/lib/inngest/functions/investor-memo-monthly"
    );
    expect(INVESTOR_MEMO_MONTHLY_ID).toBe("investor-memo-monthly");
    expect(investorMemoMonthly.opts.id).toBe("investor-memo-monthly");
  });

  it("uses the monthly cron expression (1st of month, 09:00 UTC)", async () => {
    const { investorMemoMonthly, INVESTOR_MEMO_MONTHLY_CRON } = await import(
      "@/lib/inngest/functions/investor-memo-monthly"
    );
    expect(INVESTOR_MEMO_MONTHLY_CRON).toBe("0 9 1 * *");

    const triggers = investorMemoMonthly.opts.triggers;
    expect(triggers).toHaveLength(1);
    const trigger = triggers?.[0];
    if (!trigger || !("cron" in trigger)) {
      throw new Error("Expected a cron trigger on investorMemoMonthly.");
    }
    expect(trigger.cron).toBe("0 9 1 * *");
  });

  it("handler calls the loader and forwards its output to the agent", async () => {
    loadMemoInputMock.mockClear();
    runInvestorMemoMock.mockClear();

    const { investorMemoMonthlyHandler } = await import(
      "@/lib/inngest/functions/investor-memo-monthly"
    );

    const stepShim = {
      run: <T,>(_name: string, fn: () => T | Promise<T>): Promise<T> =>
        Promise.resolve(fn()),
    };

    const out = await investorMemoMonthlyHandler({ step: stepShim });

    expect(loadMemoInputMock).toHaveBeenCalledTimes(1);
    expect(runInvestorMemoMock).toHaveBeenCalledTimes(1);
    expect(runInvestorMemoMock).toHaveBeenCalledWith(loaderFake);
    // Provenance (CLAUDE.md #2) must survive the handler boundary intact.
    const forwarded = runInvestorMemoMock.mock.calls[0]?.[0] as InvestorMemoInput;
    expect(forwarded.provenance).toEqual(loaderFake.provenance);
    if ("skipped" in out) {
      throw new Error("Expected memo output, got skipped");
    }
    expect(out).toEqual(memoOutputFake);
  });

  it("persists agent output to ReportExport", async () => {
    reportExportCreateMock.mockClear();

    const { investorMemoMonthlyHandler } = await import(
      "@/lib/inngest/functions/investor-memo-monthly"
    );

    const stepShim = {
      run: <T,>(_name: string, fn: () => T | Promise<T>): Promise<T> =>
        Promise.resolve(fn()),
    };

    await investorMemoMonthlyHandler({ step: stepShim });

    expect(reportExportCreateMock).toHaveBeenCalledTimes(1);

    const createCall = reportExportCreateMock.mock.calls[0];
    expect(createCall).toBeDefined();
    if (!createCall) {
      throw new Error("Expected prisma.reportExport.create to be called.");
    }

    const { data } = createCall[0] as { data: Record<string, unknown> };
    // Matches OPENAI_MODEL default — avoid importing investor-memo here (breaks vi.mock hoisting).
    expect(data.generatedBy).toBe("gpt-4.1");
    expect(data.clientName).toBe("Hearst Connect");
    expect(data.methodologyVersion).toBe("v1.0");
    expect(data.scenariosIncluded).toBe("[]");
    expect(data.backtestsIncluded).toBe("[]");
    expect(typeof data.content).toBe("string");
    const parsedContent = JSON.parse(data.content as string) as InvestorMemoOutput;
    expect(parsedContent.executive_summary).toBe(memoOutputFake.executive_summary);
  });
});
