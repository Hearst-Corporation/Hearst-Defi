import "server-only";

import {
  MiningHealthOutputSchema,
  type MiningHealthOutput,
} from "@/lib/agents/schemas";
import { callLlm, type LlmClientLike } from "@/lib/llm/client";
import { LLM_MODEL } from "@/lib/llm/kimi";
import {
  METHODOLOGY_VERSION,
  getMethodologyMd,
  type MethodologyVersion,
} from "@/lib/agents/system-prompts/methodology";
import {
  DISCLAIMER_NOT_GUARANTEED,
  DISCLAIMER_PROJECTION,
} from "@/lib/agents/system-prompts/disclaimers";
import { assertCitesAssumption, assertNoForbiddenWords } from "@/lib/agents/validators";

/**
 * Default model id for the Mining Health Agent.
 *
 * Runs on OpenAI GPT-4.1 (ADR-011) — the single provider. Daily cron 08:00 UTC.
 */
const MINING_HEALTH_MODEL = LLM_MODEL;

/**
 * Local input type. Re-declared here for the same reason as
 * `ScenarioOutputLike` in scenario-narrative.ts — we don't depend on the
 * engine or the DB layer; live data is passed in by the caller.
 *
 * Exported so the data loader layer (`src/lib/agents/loaders/mining.ts`) can
 * type its return value without re-declaring the contract.
 */
export interface MiningHealthInput {
  /** Hashprice in USD per terahash per day, rolling 30d average. */
  hashprice_usd_per_th: number;
  /** Network difficulty change in percent over the period. Positive = harder. */
  difficulty_change_pct: number;
  /** Net mining margin in percent (revenue - energy - hosting) / revenue. */
  margin_pct: number;
  /** Fleet uptime in percent (attested). */
  uptime_pct: number;
  /** Period covered by the metrics, in days. */
  period_days: number;
}

export interface RunMiningHealthOptions {
  client?: LlmClientLike;
  /** Override the default model. Default: `OPENAI_MODEL` / `LLM_MODEL`. */
  model?: string;
  /**
   * Methodology version cited by the agent. Defaults to `v1.0` (rule-based
   * mining metrics, unchanged in v2.0). Pass `"v2.0"` when narrating mining
   * health alongside a Monte Carlo run so the cited source stays consistent.
   */
  methodologyVersion?: MethodologyVersion;
}

function buildSystemInstructions(version: MethodologyVersion): string {
  return `You are the Mining Health Agent for Hearst Connect.

You receive a snapshot of mining operations metrics (hashprice, difficulty change, margin, uptime, period) and return a short health assessment for the operations team.

Rules:
- Output STRICT JSON only. No prose outside JSON.
- Never use the words: guarantee, promise, certain, will deliver, risk-free, no risk. Never imply yields are assured.
- The \`summary\` MUST reference at least one assumption (e.g. "assumes hashprice stays within X..."). State the assumption explicitly.
- The \`recommendation\` is a suggestion to the operations manager; it MUST NOT claim to execute or auto-rebalance. Use phrasing such as "consider", "suggest", "review".
- Alert level rubric (apply consistently):
  - red:   margin_pct < 5 OR uptime_pct < 95 OR difficulty_change_pct > 10
  - amber: margin_pct < 15 OR uptime_pct < 97 OR difficulty_change_pct > 5
  - green: otherwise
- Tone: operational, factual, concise. No marketing. No emojis.
- Methodology version: ${version}.

Disclaimers (templated; never rewrite, never paraphrase):
${DISCLAIMER_NOT_GUARANTEED}
${DISCLAIMER_PROJECTION}

Methodology (immutable, do not contradict):
${getMethodologyMd(version)}`;
}

function buildUserPrompt(input: MiningHealthInput): string {
  return [
    "Produce a Mining Health assessment for the following metrics snapshot.",
    "",
    "metrics (JSON):",
    JSON.stringify(input, null, 2),
    "",
    "Return ONLY a JSON object with this exact shape (no extra keys, no markdown fences):",
    JSON.stringify(
      {
        alert_level: '"green" | "amber" | "red"',
        summary: "string (<= 1000 chars, cites at least one assumption and at least one numeric metric)",
        recommendation: "string (<= 500 chars, suggests; never executes)",
      },
      null,
      2,
    ),
  ].join("\n");
}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const candidate = fenced && fenced[1] !== undefined ? fenced[1] : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    throw new Error(`Invalid JSON in model response: ${candidate.slice(0, 200)}`);
  }
}

export async function runMiningHealth(
  input: MiningHealthInput,
  opts: RunMiningHealthOptions = {},
): Promise<MiningHealthOutput> {
  const model = opts.model ?? MINING_HEALTH_MODEL;
  const methodologyVersion: MethodologyVersion = opts.methodologyVersion ?? METHODOLOGY_VERSION;

  const { response } = await callLlm(
    "mining-health",
    {
      model,
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: buildSystemInstructions(methodologyVersion),
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: buildUserPrompt(input),
        },
      ],
    },
    { client: opts.client },
  );

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Mining Health agent returned no text block.");
  }

  const parsed = extractJson(textBlock.text);
  const result = MiningHealthOutputSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Mining Health agent output failed schema validation: ${JSON.stringify(
        result.error.issues,
      )}`,
    );
  }
  const validated = result.data;

  assertNoForbiddenWords(validated.summary);
  assertNoForbiddenWords(validated.recommendation);
  assertCitesAssumption(validated.summary);

  return validated;
}
