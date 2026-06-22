import "server-only";

import { inngest } from "@/lib/inngest/client";
import { runMiningHealth } from "@/lib/agents/mining-health";
import { loadLatestMiningMetrics } from "@/lib/agents/loaders/mining";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { isDuplicate } from "@/lib/idempotency";

/**
 * Mining Health Agent — daily cron (08:00 UTC).
 *
 * Pipeline:
 *   1. load-metrics  → most recent `MiningMetric` row, projected onto the
 *                       agent's input shape (see loaders/mining.ts).
 *   2. run-agent     → call Mining Health Agent (OpenAI GPT-4.1, ADR-011).
 *   3. persist       → write agent output to a new `MiningMetric` row,
 *                       copying the raw metrics from the latest snapshot.
 */
export const MINING_HEALTH_DAILY_ID = "mining-health-daily" as const;
export const MINING_HEALTH_DAILY_CRON = "0 8 * * *" as const;

/**
 * Minimal `step` surface the handler needs. Lets unit tests drive the
 * handler with a no-op shim without depending on Inngest internals.
 */
export interface MiningHealthDailyStep {
  run<T>(name: string, fn: () => T | Promise<T>): Promise<T>;
}

export async function miningHealthDailyHandler({
  step,
}: {
  step: MiningHealthDailyStep;
}): Promise<
  { alert_level: "green" | "amber" | "red" } | { skipped: true; reason: string }
> {
  const today = new Date();

  if (await isDuplicate(MINING_HEALTH_DAILY_ID, today, { llmAgentName: "mining-health" })) {
    return { skipped: true, reason: "already_run_today" };
  }

  // `loadLatestMiningMetrics` now carries per-metric provenance (CLAUDE.md #2)
  // on the returned object; we forward `metrics` whole so the agent qualifies
  // every cited number (attested vs stale) rather than stripping the signal.
  const metrics = await step.run("load-metrics", () =>
    loadLatestMiningMetrics(),
  );
  const result = await step.run("run-agent", () => runMiningHealth(metrics));

  await step.run("persist", async () => {
    // Idempotency guard: if we already created an agent-generated row today, skip
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const existingAgentRow = await prisma.miningMetric.findFirst({
      where: {
        takenAt: { gte: startOfToday },
        summary: { not: null }, // agent-generated rows always have a summary
        alertLevel: { not: null },
      },
      orderBy: { takenAt: "desc" },
    });
    if (existingAgentRow) {
      logger.info("[mining-health-daily] agent row already exists for today, skipping persist");
      return;
    }

    try {
      const latestRow = await prisma.miningMetric.findFirst({
        orderBy: { takenAt: "desc" },
      });

      if (!latestRow) {
        logger.error(
          "[mining-health-daily] No MiningMetric row found to copy raw metrics from.",
        );
        throw new Error("No MiningMetric row found");
      }

      await prisma.miningMetric.create({
        data: {
          hashprice: latestRow.hashprice,
          difficulty: latestRow.difficulty,
          btcPrice: latestRow.btcPrice,
          energyCost: latestRow.energyCost,
          uptimePct: latestRow.uptimePct,
          deployedHashrate: latestRow.deployedHashrate,
          miningMarginScore: latestRow.miningMarginScore,
          hashpriceTrendPct: latestRow.hashpriceTrendPct,
          operationalConfidence: latestRow.operationalConfidence,
          alertLevel: result.alert_level,
          summary: result.summary,
          recommendation: result.recommendation,
        },
      });

      logger.info("[mining-health-daily] persisted alert=%s", {
        alertLevel: result.alert_level,
      });
    } catch (err) {
      logger.error(
        "[mining-health-daily] DB persist failed",
        {},
        err instanceof Error ? err : new Error(String(err)),
      );
      throw err; // Let Inngest retry
    }
  });

  return { alert_level: result.alert_level };
}

export const miningHealthDaily = inngest.createFunction(
  {
    id: MINING_HEALTH_DAILY_ID,
    concurrency: { limit: 1 },
    triggers: [{ cron: MINING_HEALTH_DAILY_CRON }],
  },
  miningHealthDailyHandler,
);
