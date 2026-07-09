"use server";

import { z } from "zod";

import {
  benchClient,
  benchProviderById,
  estimateBenchCost,
} from "@/lib/bench/providers";
import { assertNoForbiddenWords } from "@/lib/agents/validators";
import { requireAdmin } from "@/lib/auth/require-admin";
import { logger } from "@/lib/logger";
import { assertRateLimit } from "@/lib/rate-limit";

const DEFAULT_SYSTEM =
  "You are a Hearst Connect assistant. Be concise, factual, institutional. " +
  "APY always as a range, never a single point. No forbidden words " +
  "(guarantee, promise, risk-free, assured). No emojis.";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(20_000),
});

const RunBenchSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(40),
  models: z.array(z.string()).min(1).max(6),
  system: z.string().max(8_000).optional(),
});

export interface BenchResult {
  id: string;
  ok: boolean;
  ms: number;
  text?: string;
  model?: string;
  totalTokens?: number;
  cost?: number | null;
  /** Output-side compliance lint (same forbidden-words rule as the agents). */
  compliant?: boolean;
  error?: string;
}

async function callOne(
  id: string,
  messages: z.infer<typeof MessageSchema>[],
  system: string,
): Promise<BenchResult> {
  const provider = benchProviderById(id);
  if (!provider) return { id, ok: false, ms: 0, error: "provider inconnu" };
  const client = benchClient(provider);
  if (!client) return { id, ok: false, ms: 0, error: "clé API absente" };

  const t0 = Date.now();
  try {
    const full = [{ role: "system" as const, content: system }, ...messages];
    const r = await client.chat.completions.create({
      model: provider.model,
      max_tokens: 900,
      messages: full,
    });
    const ms = Date.now() - t0;
    const msg = r.choices?.[0]?.message as
      | { content?: string | null; reasoning_content?: string }
      | undefined;
    const text =
      msg?.content && msg.content.trim().length > 0
        ? msg.content
        : (msg?.reasoning_content ?? "(réponse vide)");
    // Lint the same way the agents do — surfaces which models slip a banned word.
    let compliant = true;
    try {
      assertNoForbiddenWords(text);
    } catch {
      compliant = false;
    }
    return {
      id,
      ok: true,
      ms,
      text,
      model: provider.model,
      totalTokens: r.usage?.total_tokens,
      cost: estimateBenchCost(provider, r.usage ?? null),
      compliant,
    };
  } catch (err) {
    return {
      id,
      ok: false,
      ms: Date.now() - t0,
      error: (err instanceof Error ? err.message : String(err)).slice(0, 220),
    };
  }
}

/**
 * Runs a single prompt across the selected models in parallel (admin bench).
 *
 * ADR-011: this NEVER changes the product model — it is a comparison lab.
 * Rate limited to 20 fan-outs per minute per admin. Every model call is traced
 * to LangSmith under `bench:<id>`.
 */
export async function runBenchAction(input: unknown): Promise<{ results: BenchResult[] }> {
  const { userId } = await requireAdmin();
  const parsed = RunBenchSchema.parse(input);
  await assertRateLimit(`model-bench:${userId}`, 20, 60_000);

  const system = parsed.system && parsed.system.trim().length > 0 ? parsed.system : DEFAULT_SYSTEM;
  try {
    const results = await Promise.all(
      parsed.models.map((id) => callOne(id, parsed.messages, system)),
    );
    return { results };
  } catch (err) {
    logger.error("runBenchAction failed", { userId }, err);
    throw new Error("Bench run failed");
  }
}
