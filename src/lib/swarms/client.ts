import "server-only";

import { chatOutputViolation } from "@/lib/llm/output-guard";

import {
  ENGINE_TIMEOUT_MS,
  ENGINE_TOKEN,
  ENGINE_URL,
  SWARMS_ENABLED,
} from "./config";
import {
  isTerminal,
  type SwarmKickoffBody,
  SwarmKickoffBodySchema,
  SwarmKickoffResponseSchema,
  type SwarmRun,
  SwarmRunSchema,
} from "./schemas";

/**
 * Server-side client for the external MySwarms / crewai-engine.
 *
 * Recoded from scratch for this repo (no cross-project import — CLAUDE.md #11);
 * it mirrors the engine's real HTTP contract surfaced during recon:
 *   POST /v1/swarms/{id}/kickoff?owner_id=…  → 202 { run_id, swarm_id, status }
 *   GET  /v1/swarms/{id}/status/{run_id}?owner_id=…  → SwarmRun  (poll to finish)
 *   POST /v1/swarms/architect/generate?owner_id=…    → a generated swarm spec
 *
 * Auth is a shared Bearer token. The result is NEVER pushed — callers poll
 * `getSwarmRun` (or use `runSwarmToCompletion`) until a terminal status.
 *
 * IMPORTANT — where to call the poll loop: `runSwarmToCompletion` blocks until
 * the run ends (up to minutes). Call it from an Inngest job/step or a background
 * worker, NOT from an interactive request handler (serverless time limits).
 */

/** Typed transport error. `status` is the HTTP status (0 = network/timeout). */
export class EngineError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    message: string,
  ) {
    super(`[crewai-engine ${status}] ${path}: ${message}`);
    this.name = "EngineError";
  }
}

/** Raised before any network call when the engine is not switched on. Lets
 *  callers degrade gracefully (fall back to the in-repo agent) instead of
 *  hitting an unconfigured backend. */
export class SwarmsDisabledError extends Error {
  constructor() {
    super(
      "MySwarms engine is disabled (SWARMS_ENGINE != 1) or unprovisioned " +
        "(CREWAI_ENGINE_AUTH_TOKEN missing).",
    );
    this.name = "SwarmsDisabledError";
  }
}

const RETRYABLE = new Set([502, 503, 504]);
const RETRY_BACKOFF_MS = [500, 1500, 4500] as const;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function withOwnerId(path: string, ownerId: string): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}owner_id=${encodeURIComponent(ownerId)}`;
}

/**
 * Authenticated fetch against the engine with bounded retries on cold-start
 * 5xx (Railway). Throws `EngineError` on a non-OK terminal response or after
 * exhausting retries; the error message is truncated so a Python stack never
 * leaks to a caller.
 */
async function authedFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  if (!SWARMS_ENABLED || !ENGINE_TOKEN) throw new SwarmsDisabledError();

  const url = `${ENGINE_URL}${path}`;
  let lastErr: EngineError | null = null;

  for (let attempt = 0; attempt <= RETRY_BACKOFF_MS.length; attempt += 1) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${ENGINE_TOKEN}`,
          ...(init.headers ?? {}),
        },
        cache: "no-store",
        signal: AbortSignal.timeout(ENGINE_TIMEOUT_MS),
      });

      if (res.ok) return res;

      // Retry transient cold-start 5xx; surface everything else immediately.
      if (RETRYABLE.has(res.status) && attempt < RETRY_BACKOFF_MS.length) {
        lastErr = new EngineError(res.status, path, "transient upstream error");
        await sleep(RETRY_BACKOFF_MS[attempt] ?? 0);
        continue;
      }
      const body = (await res.text().catch(() => "")).slice(0, 200);
      throw new EngineError(res.status, path, body || res.statusText);
    } catch (err) {
      if (err instanceof EngineError) {
        if (RETRYABLE.has(err.status) && attempt < RETRY_BACKOFF_MS.length) {
          lastErr = err;
          continue;
        }
        throw err;
      }
      // Network error / AbortSignal timeout.
      lastErr = new EngineError(
        0,
        path,
        err instanceof Error ? err.message : "network error",
      );
      if (attempt < RETRY_BACKOFF_MS.length) {
        await sleep(RETRY_BACKOFF_MS[attempt] ?? 0);
        continue;
      }
      throw lastErr;
    }
  }
  throw lastErr ?? new EngineError(0, path, "request failed");
}

/** Fire a swarm run. Returns immediately with the run id (status "running"). */
export async function kickoffSwarm(
  swarmId: string,
  body: SwarmKickoffBody,
  ownerId: string,
): Promise<{ runId: string; swarmId: string }> {
  const parsedBody = SwarmKickoffBodySchema.parse(body);
  const path = withOwnerId(`/v1/swarms/${swarmId}/kickoff`, ownerId);
  const res = await authedFetch(path, {
    method: "POST",
    body: JSON.stringify(parsedBody),
  });
  const json = SwarmKickoffResponseSchema.parse(await res.json());
  return { runId: json.run_id, swarmId: json.swarm_id };
}

/** Read the current run record. */
export async function getSwarmRun(
  swarmId: string,
  runId: string,
  ownerId: string,
): Promise<SwarmRun> {
  const path = withOwnerId(
    `/v1/swarms/${swarmId}/status/${runId}`,
    ownerId,
  );
  const res = await authedFetch(path, { method: "GET" });
  return SwarmRunSchema.parse(await res.json());
}

/**
 * Kickoff + poll to a terminal status. Run this in an Inngest step / background
 * worker, never in a request handler. `paused_hitl` is treated as terminal for
 * the poll — the caller resumes it via a separate decision flow.
 */
export async function runSwarmToCompletion(
  swarmId: string,
  body: SwarmKickoffBody,
  ownerId: string,
  opts: { pollIntervalMs?: number; maxWaitMs?: number } = {},
): Promise<SwarmRun> {
  const pollIntervalMs = opts.pollIntervalMs ?? 3000;
  const maxWaitMs = opts.maxWaitMs ?? 5 * 60_000;

  const { runId } = await kickoffSwarm(swarmId, body, ownerId);

  const deadline = Date.now() + maxWaitMs;
  for (;;) {
    await sleep(pollIntervalMs);
    const run = await getSwarmRun(swarmId, runId, ownerId);
    if (isTerminal(run.status) || run.status === "paused_hitl") return run;
    if (Date.now() > deadline) {
      throw new EngineError(
        0,
        `/v1/swarms/${swarmId}/status/${runId}`,
        `run did not finish within ${maxWaitMs}ms (last status: ${run.status})`,
      );
    }
  }
}

/**
 * Compliance gate for any engine-produced text before it reaches a human
 * surface. Reuses the canonical FR∪EN forbidden-vocabulary + APY-range check
 * shared with the in-repo agents/chat — so MySwarms output is held to the SAME
 * rule. Throws on a violation; returns the text unchanged when compliant.
 */
export function guardSwarmText(text: string): string {
  const violation = chatOutputViolation(text, true);
  if (violation) {
    throw new EngineError(
      0,
      "guardSwarmText",
      `engine output failed compliance guard: ${violation}`,
    );
  }
  return text;
}

/** Convenience: run a swarm and return its compliance-guarded result text. */
export async function runSwarmForText(
  swarmId: string,
  body: SwarmKickoffBody,
  ownerId: string,
  opts?: { pollIntervalMs?: number; maxWaitMs?: number },
): Promise<{ text: string; run: SwarmRun }> {
  const run = await runSwarmToCompletion(swarmId, body, ownerId, opts);
  if (run.status !== "completed" || !run.result_text) {
    throw new EngineError(
      0,
      `/v1/swarms/${swarmId}`,
      `run ended ${run.status} with no result_text`,
    );
  }
  return { text: guardSwarmText(run.result_text), run };
}
