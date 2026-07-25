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
 * There are NO silent placeholder fallbacks for the API key — but a missing
 * value must never break module LOADING. Importing this module always
 * succeeds; a missing `OPENAI_API_KEY` throws on first USE (the first property
 * access on the exported client), the same deferral contract already used by
 * `@/lib/hubspot/client`, `@/lib/apollo/client` and `@/lib/email/send`.
 *
 * Why it matters: 14 modules import this one, including `client.ts` (pulled in
 * by 12 agents), `/api/cockpit-chat` and `/api/admin/review-document`. An
 * eager throw at import turned a missing key into a 500 on every one of those
 * routes before any handler could run — including routes that never touch the
 * LLM. The client is therefore built lazily, once, on first use.
 */

const IS_BUILD_PHASE = env.NEXT_PHASE === "phase-production-build";

function createOpenAIClient(): OpenAI {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    // Never throw here at import time — `openai` below defers this call to the
    // first property access, so this error surfaces at USE, with context.
    throw new Error(
      "OPENAI_API_KEY is not configured. Set it in the environment to use LLM features.",
    );
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

/**
 * Memoized real client. Built at most once, on the first property access of
 * the exported `openai` Proxy — never at module load.
 */
let resolvedClient: OpenAI | null = null;

function resolveClient(): OpenAI {
  if (resolvedClient === null) {
    resolvedClient = withTracing(createOpenAIClient());
  }
  return resolvedClient;
}

/**
 * The OpenAI GPT-4.1 client (ADR-011) — single provider for all agents + chat.
 *
 * A lazy Proxy, not a bare instance: importing this module must never throw on
 * a missing key (see the header note). Every trap forwards to the real client,
 * built on demand, so the public shape is unchanged for callers — they keep
 * doing `openai.chat.completions.create(...)`, passing `openai` as a dependency
 * (`kimi: openai` in the review-document route) or casting it to a narrower
 * structural type. Methods are bound to the underlying client so `this` stays
 * correct once destructured off the proxy.
 *
 * During `next build` (NEXT_PHASE === "phase-production-build") the key is not
 * expected to be present: route static analysis only imports the module, and
 * that no longer touches any property, so nothing throws.
 */
export const openai: OpenAI = new Proxy({} as OpenAI, {
  get(_target, prop, receiver): unknown {
    const client = resolveClient();
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
  set(_target, prop, value): boolean {
    return Reflect.set(resolveClient() as object, prop, value);
  },
  has(_target, prop): boolean {
    return Reflect.has(resolveClient() as object, prop);
  },
  getPrototypeOf(): object | null {
    return Reflect.getPrototypeOf(resolveClient() as object);
  },
  ownKeys(): ArrayLike<string | symbol> {
    return Reflect.ownKeys(resolveClient() as object);
  },
  getOwnPropertyDescriptor(_target, prop): PropertyDescriptor | undefined {
    const descriptor = Reflect.getOwnPropertyDescriptor(
      resolveClient() as object,
      prop,
    );
    // A proxy may only report an own property as non-configurable if the
    // target actually has it; the target here is a permanently empty object.
    return descriptor === undefined
      ? undefined
      : { ...descriptor, configurable: true };
  },
});

/** Canonical model id — `OPENAI_MODEL` env (default `gpt-4.1`). ADR-011. */
export const LLM_MODEL: string = env.OPENAI_MODEL;
