import "server-only";

import OpenAI from "openai";
import { wrapOpenAI } from "langsmith/wrappers";

import { env } from "@/lib/env";

/**
 * Primary (and only) LLM client: OpenAI GPT-4.1 (ADR-011, supersedes ADR-007
 * which used Kimi K2.6 via Hypercli — retired for latency + a thinking-model
 * integration trap that returned empty `content`). No Anthropic SDK either.
 *
 * Configuration is sourced exclusively from the validated env (`@/lib/env`).
 * There are NO silent placeholder fallbacks for the API key — a missing value
 * either throws explicitly at import (normal runtime) or, only during
 * `next build` (NEXT_PHASE === "phase-production-build"), yields a stub that
 * throws on first use so route static analysis still succeeds.
 */

const IS_BUILD_PHASE = process.env.NEXT_PHASE === "phase-production-build";

/**
 * Returns a Proxy-backed OpenAI instance that throws a clear error the first
 * time any property is touched. This lets module import succeed during
 * `next build`, while ensuring any runtime call fails loudly with context.
 */
function buildPlaceholderClient(reason: string): OpenAI {
  const throwStub = (): never => {
    throw new Error(reason);
  };
  const handler: ProxyHandler<object> = {
    get(_target, prop): unknown {
      if (typeof prop === "symbol") return undefined;
      return new Proxy(throwStub, handler);
    },
    apply(): never {
      return throwStub();
    },
  };
  return new Proxy({}, handler) as OpenAI;
}

function createOpenAIClient(): OpenAI {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    const reason =
      "OPENAI_API_KEY is not configured. Set it in the environment to use LLM features.";
    if (IS_BUILD_PHASE) {
      return buildPlaceholderClient(reason);
    }
    throw new Error(reason);
  }

  return new OpenAI({
    apiKey,
    // Default to the real OpenAI endpoint; only override when explicitly set
    // (e.g. Azure OpenAI or a corporate proxy).
    ...(env.OPENAI_BASE_URL ? { baseURL: env.OPENAI_BASE_URL } : {}),
    ...(env.OPENAI_ORG_ID ? { organization: env.OPENAI_ORG_ID } : {}),
  });
}

/**
 * Single switch for LangSmith tracing: ON only when LANGSMITH_TRACING ===
 * "true" AND an API key is configured, never during `next build` and never
 * under NODE_ENV=test (unit tests must not emit network traces). Read by the
 * client wrap below and by the `agent:<name>` parent spans in client.ts.
 */
export const LLM_TRACING_ENABLED: boolean =
  !IS_BUILD_PHASE &&
  process.env.NODE_ENV !== "test" &&
  env.LANGSMITH_TRACING === "true" &&
  Boolean(env.LANGSMITH_API_KEY);

/**
 * LangSmith tracing wrap (observability only). When disabled the bare client
 * is returned untouched (zero overhead, identical behavior). Tracing failures
 * are swallowed by the langsmith SDK (background batching) and can never fail
 * an LLM call.
 */
function withTracing(client: OpenAI): OpenAI {
  if (!LLM_TRACING_ENABLED) return client;
  return wrapOpenAI(client);
}

/** The OpenAI GPT-4.1 client (ADR-011) — single provider for all agents + chat. */
export const openai: OpenAI = withTracing(createOpenAIClient());

/** Canonical model id — `OPENAI_MODEL` env (default `gpt-4.1`). ADR-011. */
export const LLM_MODEL: string = env.OPENAI_MODEL;
