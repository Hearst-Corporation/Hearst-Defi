import "server-only";

import {
  MiningHealthOutputSchema,
  PROVENANCE_SYSTEM_RULE,
  renderProvenanceLine,
  type MiningHealthOutput,
  type ProvenanceTag,
} from "@/lib/agents/schemas";
import { type LlmClientLike } from "@/lib/llm/client";
import { LLM_MODEL } from "@/lib/llm/openai";
import {
  METHODOLOGY_VERSION,
  getMethodologyMd,
  type MethodologyVersion,
} from "@/lib/agents/system-prompts/methodology";
import {
  DISCLAIMER_NOT_GUARANTEED,
  DISCLAIMER_PROJECTION,
} from "@/lib/agents/system-prompts/disclaimers";
import {
  assertApyAlwaysRange,
  assertCitesAssumption,
  assertNoForbiddenWords,
} from "@/lib/agents/validators";
import { runAgent } from "@/lib/agents/run-agent";

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
  /**
   * Per-metric provenance (CLAUDE.md non-negotiable #2). Optional for
   * back-compat: when absent the agent defaults every metric to `attested`
   * (the DB rows are seeded as measured/attested). The loader populates it
   * from `is_fallback` / `hashprice.stale` so a fallback snapshot is rendered
   * as `estimated`/`stale` and flagged in-line by the agent, never presented
   * as attested fact (B3).
   */
  provenance?: MiningHealthProvenance;
}

/** Provenance descriptor for each numeric metric the agent narrates. */
export interface MiningHealthProvenance {
  hashprice_usd_per_th: ProvenanceTag;
  difficulty_change_pct: ProvenanceTag;
  margin_pct: ProvenanceTag;
  uptime_pct: ProvenanceTag;
}

/**
 * Default provenance when the caller does not thread one. Seeded DB rows are
 * measured/attested operational metrics, so `attested` is the honest default;
 * the loader overrides this whenever the snapshot is a fallback or the live
 * hashprice is stale.
 */
const DEFAULT_MINING_PROVENANCE: MiningHealthProvenance = {
  hashprice_usd_per_th: "attested",
  difficulty_change_pct: "attested",
  margin_pct: "attested",
  uptime_pct: "attested",
};

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
- ${PROVENANCE_SYSTEM_RULE}
- Tone: operational, factual, concise. No marketing. No emojis.
- Methodology version: ${version}.

Disclaimers (templated; never rewrite, never paraphrase):
${DISCLAIMER_NOT_GUARANTEED}
${DISCLAIMER_PROJECTION}

Methodology (immutable, do not contradict):
${getMethodologyMd(version)}`;
}

function buildUserPrompt(input: MiningHealthInput): string {
  const prov = input.provenance ?? DEFAULT_MINING_PROVENANCE;
  // The metrics JSON is rendered WITHOUT the provenance descriptor so the model
  // reads the qualifiers from the explicit, labelled block below (and so the
  // legacy `JSON.stringify(input)` shape is unchanged for back-compat readers).
  const { provenance: _omit, ...metricsOnly } = input;
  void _omit;
  return [
    "Produce a Mining Health assessment for the following metrics snapshot.",
    "",
    "metrics (JSON):",
    JSON.stringify(metricsOnly, null, 2),
    "",
    "Provenance of each metric (qualify every cited number; flag Estimated/Stale/fallback in-line):",
    renderProvenanceLine("hashprice_usd_per_th", prov.hashprice_usd_per_th),
    renderProvenanceLine("difficulty_change_pct", prov.difficulty_change_pct),
    renderProvenanceLine("margin_pct", prov.margin_pct),
    renderProvenanceLine("uptime_pct", prov.uptime_pct),
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

export async function runMiningHealth(
  input: MiningHealthInput,
  opts: RunMiningHealthOptions = {},
): Promise<MiningHealthOutput> {
  const model = opts.model ?? MINING_HEALTH_MODEL;
  const methodologyVersion: MethodologyVersion = opts.methodologyVersion ?? METHODOLOGY_VERSION;

  const validated = await runAgent("mining-health", {
    model,
    system: buildSystemInstructions(methodologyVersion),
    prompt: buildUserPrompt(input),
    client: opts.client,
    schema: MiningHealthOutputSchema,
  });

  assertNoForbiddenWords(validated.summary);
  assertNoForbiddenWords(validated.recommendation);
  assertApyAlwaysRange(validated.summary);
  assertApyAlwaysRange(validated.recommendation);
  assertCitesAssumption(validated.summary);

  return validated;
}
