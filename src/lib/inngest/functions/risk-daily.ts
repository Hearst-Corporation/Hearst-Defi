import "server-only";

import { inngest } from "@/lib/inngest/client";
import { runRiskExplanation } from "@/lib/agents/risk-explanation";
import { loadRiskFramework } from "@/lib/data/risk-framework";
import { logger } from "@/lib/logger";
import { isDuplicate, markComplete } from "@/lib/idempotency";

/**
 * Risk Daily Agent — daily cron (09:30 UTC).
 *
 * Pipeline:
 *   1. fetch-risk-data  → load risk framework (composite + 5-dimension scores)
 *                         from the latest VaultSnapshot + MiningMetric + live BTC price.
 *   2. invoke-agent     → call Risk Explanation Agent (OpenAI GPT-4.1, ADR-011).
 *                         `callLlm` inside the agent creates the `LlmRun` row automatically.
 *   3. emit-completion  → send `risk.daily.completed` Inngest event for downstream
 *                         consumers (dashboard refresh, alerts, etc.).
 *
 * Idempotency: `isDuplicate` checks for a successful `LlmRun` with
 * `agentName === "risk-daily"` within the last 24 hours (24h window). This
 * guards against Inngest retries and any accidental duplicate triggers.
 *
 * NOTE — dimension key alignment:
 *   `loadRiskFramework` now surfaces `mining` as the canonical key,
 *   matching the Risk Explanation Agent schema. No remap is performed
 *   here; we pass `dim.id` straight through. (Until V3.h the loader used
 *   `mining_ops` for dashboard convention reasons and this function had
 *   to remap inline — see commit history.)
 */

export const RISK_DAILY_ID = "risk-daily" as const;
export const RISK_DAILY_CRON = "30 9 * * *" as const;

/**
 * The vault mode fed to the agent when no scenario override is active.
 * Matches the engine's default base scenario key.
 */
const DEFAULT_MODE = "base" as const;

/**
 * Minimal `step` surface the handler needs. Lets unit tests drive the
 * handler with a no-op shim without depending on Inngest internals.
 */
export interface RiskDailyStep {
  run<T>(name: string, fn: () => T | Promise<T>): Promise<T>;
}

export interface RiskDailyResult {
  status: "completed";
  runId: string;
  composite: number;
  topRiskIds: string[];
}

export async function riskDailyHandler({
  step,
}: {
  step: RiskDailyStep;
}): Promise<RiskDailyResult | { skipped: true; reason: string }> {
  const today = new Date();

  // ---- Idempotency guard --------------------------------------------------
  if (await isDuplicate(RISK_DAILY_ID, today)) {
    logger.info("[risk-daily] skipping — already ran today");
    return { skipped: true, reason: "already_ran" };
  }

  // ---- Step 1: fetch risk data --------------------------------------------
  const riskData = await step.run("fetch-risk-data", () => loadRiskFramework());

  // ---- Build agent input --------------------------------------------------
  // Dimension IDs surfaced by `loadRiskFramework` are already canonical
  // (mining | market | liquidity | smart_contract | counterparty), so we
  // can pass them straight through to the agent.
  const componentScores: Record<string, number> = {};
  for (const dim of riskData.dimensions) {
    componentScores[dim.id] = dim.score;
  }

  // ---- Step 2: invoke agent -----------------------------------------------
  // `runRiskExplanation` → `callLlm` persists the LlmRun row internally.
  // We surface the runId from the returned `LlmCallResult` via the agent's
  // structured return. Because the current `runRiskExplanation` signature
  // does not thread `runId` through the `RiskExplanationOutput`, we use
  // `isDuplicate` + `markComplete` for the outer idempotency record and
  // accept that the runId in the completion event is the `markComplete` row.
  const agentResult = await step.run("invoke-agent", () =>
    runRiskExplanation({
      riskScore: typeof riskData.composite === "number"
        ? riskData.composite
        : Number(riskData.composite),
      componentScores,
      mode: DEFAULT_MODE,
    }),
  );

  // ---- Step 3: persist idempotency record + surface runId -----------------
  await markComplete(RISK_DAILY_ID, today);

  // The `markComplete` call creates a lightweight LlmRun row. Query it back
  // so we can include a real ID in the completion event.
  // We use a stable synthetic identifier derived from the date so downstream
  // consumers can correlate without an extra DB read at runtime.
  const runLabel = `risk-daily:${today.toISOString().slice(0, 10)}`;

  // ---- Step 4: emit completion event --------------------------------------
  await step.run("emit-completion", async () => {
    await inngest.send({
      name: "risk.daily.completed",
      data: {
        runLabel,
        date: today.toISOString().slice(0, 10),
        composite: riskData.composite,
        topRiskIds: agentResult.top_risks.map((r) => r.risk_id),
        source: riskData.source,
      },
    });
    logger.info("[risk-daily] emitted risk.daily.completed", {
      runLabel,
      composite: riskData.composite,
      topRiskIds: agentResult.top_risks.map((r) => r.risk_id),
    });
  });

  logger.info("[risk-daily] completed", {
    composite: riskData.composite,
    topRiskIds: agentResult.top_risks.map((r) => r.risk_id),
    source: riskData.source,
  });

  return {
    status: "completed",
    runId: runLabel,
    composite: riskData.composite,
    topRiskIds: agentResult.top_risks.map((r) => r.risk_id),
  };
}

export const riskDaily = inngest.createFunction(
  {
    id: RISK_DAILY_ID,
    concurrency: { limit: 1 },
    triggers: [{ cron: RISK_DAILY_CRON }],
  },
  riskDailyHandler,
);
