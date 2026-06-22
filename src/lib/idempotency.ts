import "server-only";

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Idempotency guard for cron jobs and long-running operations.
 *
 * Prevents duplicate execution when a function is retried or replayed.
 * Uses the database as the single source of truth.
 *
 * Pattern:
 *   if (await isDuplicate(jobId, date, { llmAgentName })) { return skipped; }
 *   const result = await run(...); // callLlm persists LlmRun when applicable
 *   await markComplete(jobId, date); // non-LLM jobs only
 */

const IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface IdempotencyOptions {
  /**
   * For LLM-backed crons, pass the `callLlm` agent name (e.g. `mining-health`).
   * Skips duplicate detection via the real `LlmRun` row — do not also call
   * `markComplete` for those jobs (avoids synthetic `model: "n/a"` rows).
   */
  llmAgentName?: string;
}

function buildKeyPrefix(jobId: string, date: Date): string {
  const d = date.toISOString().slice(0, 10); // YYYY-MM-DD
  return `${jobId}:${d}`;
}

/**
 * Checks whether this job already succeeded within the idempotency window.
 * Non-LLM jobs use `jobId` as `LlmRun.agentName`; LLM crons pass
 * `llmAgentName` so detection aligns with `callLlm` telemetry.
 */
export async function isDuplicate(
  jobId: string,
  date: Date,
  opts?: IdempotencyOptions,
): Promise<boolean> {
  const key = buildKeyPrefix(jobId, date);
  const agentName = opts?.llmAgentName ?? jobId;
  const existing = await prisma.llmRun.findFirst({
    where: {
      agentName,
      status: "success",
      createdAt: {
        gte: new Date(date.getTime() - IDEMPOTENCY_WINDOW_MS),
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    logger.info("idempotency: skipping duplicate job", {
      jobId,
      agentName,
      key,
      previousRunId: existing.id,
    });
    return true;
  }

  return false;
}

/**
 * Records completion of a **non-LLM** idempotent operation.
 * LLM-backed crons should rely on `callLlm`'s `LlmRun` row instead.
 */
export async function markComplete(
  jobId: string,
  date: Date,
  meta?: { latencyMs?: number; costUsd?: number },
): Promise<void> {
  const key = buildKeyPrefix(jobId, date);
  await prisma.llmRun.create({
    data: {
      agentName: jobId,
      model: "n/a",
      status: "success",
      latencyMs: meta?.latencyMs ?? 0,
      costUsd: meta?.costUsd ?? 0,
    },
  });
  logger.info("idempotency: marked complete", { jobId, key });
}
