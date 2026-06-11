import OpenAI from "openai";

import { env } from "@/lib/env";

/**
 * Primary LLM client: OpenAI GPT-4.1 (ADR-011, supersedes ADR-007 which used
 * Kimi K2.6 via Hypercli — retired for latency + a thinking-model integration
 * trap that returned empty `content`).
 *
 * NOTE — historical export names: the client is still exported as `kimi` and
 * the model id as `KIMI_MODEL` to avoid churn across import sites; both now
 * resolve to OpenAI GPT-4.1. Treat the names as legacy aliases.
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

function createKimi(): OpenAI {
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

/** Historical name — now the OpenAI GPT-4.1 client (ADR-011). */
export const kimi: OpenAI = createKimi();

/** Canonical model id — `OPENAI_MODEL` env (default `gpt-4.1`). ADR-011. */
export const LLM_MODEL: string = env.OPENAI_MODEL;

/** @deprecated Legacy alias for `LLM_MODEL` — kept to avoid import churn. */
export const KIMI_MODEL: string = LLM_MODEL;
