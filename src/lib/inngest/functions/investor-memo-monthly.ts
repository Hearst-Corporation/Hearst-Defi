import "server-only";

import { inngest } from "@/lib/inngest/client";
import {
  runInvestorMemo,
  type InvestorMemoInput,
  INVESTOR_MEMO_MODEL,
} from "@/lib/agents/investor-memo";
import { loadMemoInput } from "@/lib/agents/loaders/vault";
import type { InvestorMemoOutput } from "@/lib/agents/schemas";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { isDuplicate, markComplete } from "@/lib/idempotency";
import { METHODOLOGY_VERSION } from "@/lib/agents/system-prompts/methodology";

/**
 * Investor Memo Agent — monthly cron (1st of month at 09:00 UTC).
 *
 * Pipeline:
 *   1. load-memo-input → single Prisma read pulling vault snapshot, recent
 *                          persisted scenarios, and recent backtests.
 *   2. run-agent       → call Investor Memo Agent (OpenAI GPT-4.1, ADR-011).
 *   3. persist         → write structured memo to `ReportExport`.
 */
export const INVESTOR_MEMO_MONTHLY_ID = "investor-memo-monthly" as const;
export const INVESTOR_MEMO_MONTHLY_CRON = "0 9 1 * *" as const;

export interface InvestorMemoMonthlyStep {
  run<T>(name: string, fn: () => T | Promise<T>): Promise<T>;
}

export async function investorMemoMonthlyHandler({
  step,
}: {
  step: InvestorMemoMonthlyStep;
}): Promise<InvestorMemoOutput | { skipped: true; reason: string }> {
  const today = new Date();

  if (await isDuplicate(INVESTOR_MEMO_MONTHLY_ID, today)) {
    return { skipped: true, reason: "already_run_today" };
  }

  const input: InvestorMemoInput = await step.run("load-memo-input", () =>
    loadMemoInput(),
  );

  const result = await step.run("run-agent", () => runInvestorMemo(input));

  await step.run("persist", async () => {
    try {
      await prisma.reportExport.create({
        data: {
          generatedBy: INVESTOR_MEMO_MODEL,
          clientName: "Hearst Connect",
          scenariosIncluded: JSON.stringify(
            input.scenarios.map((s) => s.mode),
          ),
          backtestsIncluded: JSON.stringify(
            input.backtests.map((b) => b.key),
          ),
          methodologyVersion: METHODOLOGY_VERSION,
          content: JSON.stringify(result),
        },
      });
      logger.info("[memo-monthly] persisted to ReportExport");
    } catch (err) {
      logger.error(
        "[memo-monthly] DB persist failed",
        {},
        err instanceof Error ? err : new Error(String(err)),
      );
      throw err; // Let Inngest retry
    }
  });

  await markComplete(INVESTOR_MEMO_MONTHLY_ID, today);
  return result;
}

export const investorMemoMonthly = inngest.createFunction(
  {
    id: INVESTOR_MEMO_MONTHLY_ID,
    triggers: [{ cron: INVESTOR_MEMO_MONTHLY_CRON }],
  },
  investorMemoMonthlyHandler,
);
