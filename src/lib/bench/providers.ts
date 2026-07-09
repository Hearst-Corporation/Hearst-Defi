import "server-only";

import OpenAI from "openai";
import { wrapOpenAI } from "langsmith/wrappers";

import { env } from "@/lib/env";
import { LLM_TRACING_ENABLED } from "@/lib/llm/openai";

/**
 * Model Bench provider registry (admin lab only).
 *
 * ADR-011 keeps the PRODUCT locked to gpt-4.1. This registry powers the
 * /admin/model-bench comparison arena EXCLUSIVELY — never the 4 batch agents,
 * never the cockpit chat. Every provider is OpenAI-compatible, so one SDK
 * drives all of them by swapping baseURL + model.
 *
 * A provider is "available" only when its API key is configured; otherwise the
 * bench greys it out (it never throws for a missing key).
 */

export interface BenchProvider {
  id: string;
  label: string;
  note: string;
  model: string;
  baseURL?: string;
  apiKey: string | undefined;
  /** List price USD per 1M tokens, for a coarse cost estimate. */
  pricing: { in: number; out: number };
}

export const BENCH_PROVIDERS: readonly BenchProvider[] = [
  {
    id: "gpt-4.1",
    label: "OpenAI GPT-4.1",
    note: "Modèle de production (ADR-011)",
    model: "gpt-4.1",
    apiKey: env.OPENAI_API_KEY,
    pricing: { in: 2.0, out: 8.0 },
  },
  {
    id: "gpt-4o",
    label: "OpenAI GPT-4o",
    note: "Moins cher, plus rapide",
    model: "gpt-4o",
    apiKey: env.OPENAI_API_KEY,
    pricing: { in: 2.5, out: 10.0 },
  },
  {
    id: "gpt-4o-mini",
    label: "OpenAI GPT-4o mini",
    note: "Le moins cher OpenAI",
    model: "gpt-4o-mini",
    apiKey: env.OPENAI_API_KEY,
    pricing: { in: 0.15, out: 0.6 },
  },
  {
    id: "deepseek-chat",
    label: "DeepSeek Chat V3",
    note: "Alternative très économique",
    model: "deepseek-chat",
    baseURL: env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1",
    apiKey: env.DEEPSEEK_API_KEY,
    pricing: { in: 0.27, out: 1.1 },
  },
  {
    id: "deepseek-reasoner",
    label: "DeepSeek Reasoner (R1)",
    note: "Raisonnement étendu",
    model: "deepseek-reasoner",
    baseURL: env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1",
    apiKey: env.DEEPSEEK_API_KEY,
    pricing: { in: 0.55, out: 2.19 },
  },
  {
    id: "kimi-k2.6",
    label: "Kimi K2.6 (Hypercli)",
    note: "Thinking model, self-host GPU",
    model: "kimi-k2.6",
    baseURL: env.HYPERCLI_BASE_URL ?? "https://api.hypercli.com/v1",
    apiKey: env.HYPERCLI_API_KEY,
    pricing: { in: 0, out: 0 },
  },
];

export function benchProviderById(id: string): BenchProvider | undefined {
  return BENCH_PROVIDERS.find((p) => p.id === id);
}

/** Public (client-safe) view: no keys, just availability + metadata. */
export interface BenchProviderInfo {
  id: string;
  label: string;
  note: string;
  model: string;
  available: boolean;
}

export function benchProviderInfos(): BenchProviderInfo[] {
  return BENCH_PROVIDERS.map((p) => ({
    id: p.id,
    label: p.label,
    note: p.note,
    model: p.model,
    available: Boolean(p.apiKey && p.apiKey.trim().length > 0),
  }));
}

const clientCache = new Map<string, OpenAI>();

/** Lazily builds (and caches) a traced client for a provider. */
export function benchClient(p: BenchProvider): OpenAI | null {
  if (!p.apiKey) return null;
  const cached = clientCache.get(p.id);
  if (cached) return cached;
  const raw = new OpenAI({
    apiKey: p.apiKey,
    ...(p.baseURL ? { baseURL: p.baseURL } : {}),
  });
  // Trace each bench call under `bench:<id>` so LangSmith groups them and they
  // stay filterable, separate from the named product agents.
  const client = LLM_TRACING_ENABLED
    ? wrapOpenAI(raw, { name: `bench:${p.id}` })
    : raw;
  clientCache.set(p.id, client);
  return client;
}

export function estimateBenchCost(
  p: BenchProvider,
  usage: { prompt_tokens?: number; completion_tokens?: number } | null,
): number | null {
  if (!usage) return null;
  const inTok = usage.prompt_tokens ?? 0;
  const outTok = usage.completion_tokens ?? 0;
  return (inTok / 1e6) * p.pricing.in + (outTok / 1e6) * p.pricing.out;
}
