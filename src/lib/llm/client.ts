import "server-only";

import { createHash } from "node:crypto";

import { CircuitBreaker } from "@/lib/circuit-breaker";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
export { LLM_MODEL } from "@/lib/llm/openai";
import { openai, LLM_MODEL } from "@/lib/llm/openai";
import { getRequestContext } from "@/lib/request-context";

/**
 * OpenAI list pricing (USD per 1M tokens) for the active model gpt-4o-mini.
 * Update here if OPENAI_MODEL changes or OpenAI changes the published rate;
 * `LlmRun.costUsd` is computed from these. (gpt-4.1 was 2.0 / 8.0.)
 */
const OPENAI_INPUT_PER_MTOK = 0.15;
const OPENAI_OUTPUT_PER_MTOK = 0.6;
/**
 * Cost of an OpenAI turn from its token usage, at the active model's list
 * pricing. Exported so the streaming chat path can persist the same `costUsd`
 * as the batch path instead of duplicating the rate constants.
 */
export function estimateOpenAiCostUsd(usage: {
  prompt_tokens: number;
  completion_tokens: number;
}): number {
  return (
    (usage.prompt_tokens / 1_000_000) * OPENAI_INPUT_PER_MTOK +
    (usage.completion_tokens / 1_000_000) * OPENAI_OUTPUT_PER_MTOK
  );
}

/**
 * Thin, auditable wrapper around the single LLM provider: OpenAI GPT-4.1
 * (via the `openai` SDK). ADR-011.
 *
 * Features:
 * - Configurable timeout (default 30 s)
 * - Exponential-backoff retry for 429 / 5xx
 * - Circuit breaker (opens after 5 failures, 60s cooldown)
 * - Automatic persistence to `LlmRun` for cost, latency and error tracing
 * - Request ID propagation from async context to LlmRun logs
 *
 * Agents are provider-agnostic: they build `LlmParams` (a small Anthropic-style
 * shape — system blocks + messages) and call `callLlm`. The wrapper flattens
 * that into an OpenAI chat-completion request.
 *
 * Tests inject a `client` shaped like `{ messages: { create: ... } }` so they
 * never hit the real API.
 */

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;

/** Shared circuit breaker for primary OpenAI model calls. */
const primaryBreaker = new CircuitBreaker({
  name: "openai-primary",
  failureThreshold: 5,
  cooldownMs: 60_000,
});

/** Shared circuit breaker for fallback-model calls (OPENAI_FALLBACK_MODEL). */
const fallbackBreaker = new CircuitBreaker({
  name: "openai-fallback",
  failureThreshold: 5,
  cooldownMs: 60_000,
});

/** Resolved at module load. When `null`, no fallback model is configured and
 *  callLlm runs single-provider (OpenAI primary only). Set OPENAI_FALLBACK_MODEL
 *  (e.g. "gpt-4o") to retry on a secondary OpenAI model when the primary fails
 *  all retries OR the circuit breaker opens. */
const FALLBACK_MODEL: string | null =
  env.OPENAI_FALLBACK_MODEL && env.OPENAI_FALLBACK_MODEL.trim().length > 0
    ? env.OPENAI_FALLBACK_MODEL.trim()
    : null;

/* --------------------------------------------------------------------------
 * Minimal LLM types (provider-agnostic, Anthropic-style).
 * Agents author prompts as system blocks + messages; we keep that shape and
 * adapt to the OpenAI chat-completions API internally.
 * ------------------------------------------------------------------------ */

/** A single text block in a system prompt. `cache_control` is accepted for
 *  forward-compatibility; OpenAI applies automatic prompt caching >1024 tokens. */
export interface SystemTextBlock {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
}

export type LlmSystem = string | SystemTextBlock[];

export interface LlmTextBlock {
  type: "text";
  text: string;
}

export interface LlmMessage {
  role: "user" | "assistant";
  content: string | LlmTextBlock[];
}

export interface LlmParams {
  /** Logical model id recorded on `LlmRun.model`. Inference uses the resolved
   *  provider model (`LLM_MODEL` primary, or `OPENAI_FALLBACK_MODEL`). */
  model: string;
  max_tokens: number;
  system?: LlmSystem;
  messages: LlmMessage[];
}

export interface LlmUsage {
  input_tokens: number;
  output_tokens: number;
}

/** Normalised response — only the fields callers actually read. */
export interface LlmResponse {
  id: string;
  model: string;
  content: LlmTextBlock[];
  usage: LlmUsage;
}

/** Subset of the client surface we need. Tests inject a mock matching this. */
export interface LlmClientLike {
  messages: {
    create: (
      body: LlmParams,
      options?: { timeout?: number },
    ) => Promise<LlmResponse>;
  };
}

export interface LlmCallResult {
  response: LlmResponse;
  latencyMs: number;
  runId: string;
}

/**
 * Calls the LLM (OpenAI GPT-4.1) with retry, timeout, circuit breaker and observability.
 *
 * @param agentName   Logical name for the run (e.g. "investor-memo")
 * @param params      Provider-agnostic message-create parameters
 * @param opts        Optional injected client, timeout or retry count
 */
export async function callLlm(
  agentName: string,
  params: LlmParams,
  opts?: {
    client?: LlmClientLike;
    timeoutMs?: number;
    maxRetries?: number;
  },
): Promise<LlmCallResult> {
  // Tests inject a fully-formed `client`; in that mode we bypass the fallback
  // path so test setups stay deterministic (one mock = one path).
  const primaryClient: LlmClientLike =
    opts?.client ?? openaiAsClient(LLM_MODEL);
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = opts?.maxRetries ?? DEFAULT_MAX_RETRIES;

  const promptHash = createHash("sha256")
    .update(JSON.stringify(params.messages))
    .digest("hex")
    .slice(0, 16);

  const systemPromptHash = hashSystemPrompt(params.system);

  const userId = getRequestContext()?.userId ?? null;

  const run = await prisma.llmRun.create({
    data: {
      agentName,
      model: params.model,
      promptHash,
      systemPromptHash,
      status: "queued",
      userId,
    },
  });

  const start = performance.now();

  const primaryOutcome = await tryProvider({
    client: primaryClient,
    params,
    timeoutMs,
    maxRetries,
    breaker: primaryBreaker,
  });

  if (primaryOutcome.kind === "success") {
    return await persistSuccessAndReturn(run.id, start, primaryOutcome.response);
  }

  if (FALLBACK_MODEL && opts?.client === undefined) {
    const fallbackOutcome = await tryProvider({
      client: openaiAsClient(FALLBACK_MODEL),
      params,
      timeoutMs,
      maxRetries,
      breaker: fallbackBreaker,
    });

    if (fallbackOutcome.kind === "success") {
      return await persistSuccessAndReturn(
        run.id,
        start,
        fallbackOutcome.response,
        { fallbackTriggered: true, fallbackModel: FALLBACK_MODEL },
      );
    }

    return await persistFailureAndThrow(run.id, start, fallbackOutcome.error);
  }

  return await persistFailureAndThrow(run.id, start, primaryOutcome.error);
}

// ────────────────────────────────────────────────────────────────────────────
// Provider attempt orchestration
// ────────────────────────────────────────────────────────────────────────────

type ProviderOutcome =
  | { kind: "success"; response: LlmResponse }
  | { kind: "failure"; error: unknown };

interface TryProviderArgs {
  client: LlmClientLike;
  params: LlmParams;
  timeoutMs: number;
  maxRetries: number;
  breaker: CircuitBreaker;
}

async function tryProvider(args: TryProviderArgs): Promise<ProviderOutcome> {
  let lastError: unknown;
  try {
    const response = await args.breaker.run(async () => {
      for (let attempt = 0; attempt < args.maxRetries; attempt++) {
        try {
          return await args.client.messages.create(args.params, {
            timeout: args.timeoutMs,
          });
        } catch (err) {
          lastError = err;
          if (!isRetryable(err) || attempt === args.maxRetries - 1) {
            break;
          }
          await sleep(Math.pow(2, attempt) * 1000);
        }
      }
      throw lastError;
    });
    return { kind: "success", response };
  } catch (err) {
    return { kind: "failure", error: lastError ?? err };
  }
}

async function persistSuccessAndReturn(
  runId: string,
  start: number,
  response: LlmResponse,
  meta?: { fallbackTriggered: true; fallbackModel: string },
): Promise<LlmCallResult> {
  const latency = Math.round(performance.now() - start);
  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;
  const costUsd = estimateOpenAiCostUsd({
    prompt_tokens: inputTokens,
    completion_tokens: outputTokens,
  });

  await prisma.llmRun.update({
    where: { id: runId },
    data: {
      status: "success",
      latencyMs: latency,
      inputTokens,
      outputTokens,
      costUsd,
      model: response.model,
      ...(meta?.fallbackTriggered
        ? { errorType: `fallback:${meta.fallbackModel}` }
        : {}),
    },
  });

  return { response, latencyMs: latency, runId };
}

async function persistFailureAndThrow(
  runId: string,
  start: number,
  error: unknown,
): Promise<never> {
  const latency = Math.round(performance.now() - start);
  const errorMessage =
    error instanceof Error ? error.message : String(error);
  const isTimeout =
    error instanceof Error &&
    error.constructor.name === "APIConnectionTimeoutError";

  await prisma.llmRun.update({
    where: { id: runId },
    data: {
      status: isTimeout ? "timeout" : "failed",
      latencyMs: latency,
      errorType: errorType(error),
      errorMessage: errorMessage.slice(0, 1000),
    },
  });

  throw error;
}

/** A retryable error is a timeout or a 429/500/503 from the OpenAI SDK. */
function isRetryable(err: unknown): boolean {
  if (
    err instanceof Error &&
    err.constructor.name === "APIConnectionTimeoutError"
  ) {
    return true;
  }
  const status = httpStatus(err);
  return status === 429 || status === 500 || status === 503;
}

/** Extracts an HTTP status from an OpenAI SDK error without importing its type. */
function httpStatus(err: unknown): number | null {
  if (err !== null && typeof err === "object" && "status" in err) {
    const s = (err as { status: unknown }).status;
    return typeof s === "number" ? s : null;
  }
  return null;
}

function errorType(err: unknown): string {
  if (
    err instanceof Error &&
    err.constructor.name === "APIConnectionTimeoutError"
  ) {
    return "timeout";
  }
  const status = httpStatus(err);
  return status !== null ? String(status) : "unknown";
}

function flattenSystem(system: LlmSystem | undefined): string {
  if (system === undefined) return "";
  if (typeof system === "string") return system;
  return system
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("\n\n");
}

function flattenContent(content: LlmMessage["content"]): string {
  if (typeof content === "string") return content;
  return content
    .map((block) => (block.type === "text" ? block.text : ""))
    .filter((s) => s.length > 0)
    .join("\n\n");
}

/** Wraps an OpenAI model id as an `LlmClientLike` for `callLlm`. */
function openaiAsClient(model: string): LlmClientLike {
  return {
    messages: {
      create: (body, options) =>
        callOpenAi(model, body, options?.timeout ?? DEFAULT_TIMEOUT_MS),
    },
  };
}

/** Calls OpenAI chat-completions and normalises into `LlmResponse`. */
async function callOpenAi(
  model: string,
  params: LlmParams,
  timeoutMs: number,
): Promise<LlmResponse> {
  const systemText = flattenSystem(params.system);
  const chatMessages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }> = [];
  if (systemText.length > 0) {
    chatMessages.push({ role: "system", content: systemText });
  }
  for (const m of params.messages) {
    chatMessages.push({
      role: m.role,
      content: flattenContent(m.content),
    });
  }

  const completion = await openai.chat.completions.create(
    {
      model,
      max_tokens: params.max_tokens,
      messages: chatMessages,
    },
    { timeout: timeoutMs },
  );

  const text = completion.choices[0]?.message?.content ?? "";
  return {
    id: completion.id,
    model,
    content: [{ type: "text", text }],
    usage: {
      input_tokens: completion.usage?.prompt_tokens ?? 0,
      output_tokens: completion.usage?.completion_tokens ?? 0,
    },
  };
}

function hashSystemPrompt(system: LlmSystem | undefined): string | null {
  if (system === undefined) return null;
  const text =
    typeof system === "string"
      ? system
      : system
          .map((block) => (block.type === "text" ? block.text : ""))
          .join("\n\n");
  if (text.length === 0) return null;
  return createHash("sha256").update(text).digest("hex");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
