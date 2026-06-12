import "server-only";

import {
  ScenarioNarrativeOutputSchema,
  PROVENANCE_SYSTEM_RULE,
  renderProvenanceLine,
  type ScenarioNarrativeOutput,
  type ProvenanceTag,
} from "@/lib/agents/schemas";
import { callLlm, type LlmClientLike } from "@/lib/llm/client";
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
import { assertCitesAssumption, assertNoForbiddenWords } from "@/lib/agents/validators";
import {
  loadUserAgentProfile,
  loadUserMemory,
  buildUserContextSystemBlock,
} from "@/lib/agents/user-context";
import { logger } from "@/lib/logger";
import type { ScenarioOutput } from "@/lib/engine/types";
import { formatApyRange } from "@/lib/format/apy";

/**
 * Default model id for the Scenario Narrative Agent.
 *
 * Runs on OpenAI GPT-4.1 (ADR-011) — the single provider. Override via
 * `opts.model` only for evaluation / canary work; production callers should
 * leave the default.
 */
export const SCENARIO_NARRATIVE_MODEL = LLM_MODEL;

export interface ScenarioNarrativeInput {
  /** Scenario identifier (e.g. "base", "bear", "bull", or custom id). */
  scenario_id: string;
  /** The pure-function engine output we want to narrate. */
  scenario_output: ScenarioOutput;
  /**
   * Provenance of the data behind the scenario (CLAUDE.md non-negotiable #2).
   * Optional for back-compat. `projection` qualifies the engine output itself
   * (a deterministic, reproducible artifact → typically `estimated` because a
   * scenario is a conditional projection, not attested fact); `coverage`
   * carries the distribution-coverage view's resolved provenance when the
   * caller has it. When absent, the agent defaults the projection to
   * `estimated` (a scenario is never attested) so it is always flagged.
   */
  provenance?: ScenarioNarrativeProvenance;
}

/** Provenance descriptor for the scenario narrative inputs. */
export interface ScenarioNarrativeProvenance {
  /** Provenance of the scenario projection (engine output). */
  projection: ProvenanceTag;
  /** Provenance of the distribution-coverage figure, when threaded. */
  coverage?: ProvenanceTag;
}

/**
 * Default provenance: a scenario is a conditional projection, never attested
 * fact, so the headline tag is `estimated` and always flagged in-line.
 */
const DEFAULT_SCENARIO_PROVENANCE: ScenarioNarrativeProvenance = {
  projection: "estimated",
};

export interface RunScenarioNarrativeOptions {
  /**
   * Injected LLM client. Tests pass a mock; production callers pass a shared
   * client. If absent, we construct one inside the function (never at module
   * load) so importing this file in a non-server context doesn't trigger SDK
   * init.
   */
  client?: LlmClientLike;
  /** Override the default model. Default: `OPENAI_MODEL` / `LLM_MODEL`. */
  model?: string;
  /**
   * Authenticated user identifier. When provided, the per-user persona
   * profile and recent activity are loaded and injected as a second system
   * block (after the cached methodology block). When absent, behaviour is
   * strictly unchanged.
   */
  userId?: string;
  /**
   * Methodology version cited by the agent. Defaults to `v1.0` because the
   * rule-based `ScenarioOutput` is produced under v1.0. Callers narrating a
   * Monte Carlo output (`runMonteCarlo`) must pass `"v2.0"` so the system
   * prompt inlines the correct source and the agent does not assert v1.0 on
   * a probabilistic result.
   */
  methodologyVersion?: MethodologyVersion;
}

function buildSystemInstructions(version: MethodologyVersion): string {
  return `You are the Scenario Narrative Agent for Hearst Connect.

Your job is to convert a single scenario run (computed by a deterministic, pure-function engine) into a short narrative for institutional / professional investors.

Rules:
- Output STRICT JSON conforming to the schema described in the user message. No prose outside JSON.
- Never use the words: guarantee, promise, certain, will deliver, risk-free, no risk. Never imply any return is assured.
- Every narrative MUST explicitly reference at least one assumption from the input \`key_assumptions\`.
- If confidence is "low", the narrative MUST open with an explicit low-confidence note (e.g. "Note: this projection has low confidence because...").
- APY is always a RANGE, never a single point. When you quote APY, use the provided range verbatim.
- Tone: institutional, factual, concise. No marketing. No emojis.
- ${PROVENANCE_SYSTEM_RULE}
- Methodology version: ${version}. Reference it implicitly via the methodology you were given; do not invent metrics.
- PTAI format is MANDATORY. You MUST return a \`ptai\` object with four short strings — \`projection\` (expected outcome / APY range / posture), \`trigger\` (the rule or condition that fires; cite the btc_tactical rule id when one is armed), \`action\` (what the vault does as a result), \`impact\` (numerical impact: APY delta, risk score shift, exposure change). Each PTAI string is a single sentence, ≤500 chars, never empty, must avoid the forbidden words above.

Disclaimers (templated; never rewrite, never paraphrase):
${DISCLAIMER_NOT_GUARANTEED}
${DISCLAIMER_PROJECTION}

Methodology (immutable, do not contradict):
${getMethodologyMd(version)}`;
}

function buildUserPrompt(input: ScenarioNarrativeInput): string {
  const out = input.scenario_output;
  const prov = input.provenance ?? DEFAULT_SCENARIO_PROVENANCE;
  const provLines = [
    renderProvenanceLine("scenario projection (apy_range / stressed_apy)", prov.projection),
    ...(prov.coverage !== undefined
      ? [renderProvenanceLine("distribution coverage ratio", prov.coverage)]
      : []),
  ];
  return [
    "Produce a Scenario Narrative for the following scenario run.",
    "",
    `scenario_id: ${input.scenario_id}`,
    "",
    "Provenance (qualify every cited number; a scenario is a conditional projection, flag it in-line):",
    ...provLines,
    "",
    "scenario_output (engine, JSON):",
    JSON.stringify(out, null, 2),
    "",
    "Pre-computed fields for convenience (use these verbatim where applicable):",
    `- apy_range (formatted, use verbatim when quoting APY): ${formatApyRange(out.apy_range, 2)}`,
    `- stressed_apy: ${out.stressed_apy.toFixed(2)}%`,
    `- risk_score: ${out.risk_score}`,
    `- mining_margin_score: ${out.mining_margin_score}`,
    `- mode: ${out.mode}`,
    `- confidence (engine-provided, narrate accordingly): ${out.confidence}`,
    "",
    "Allocations (bucket / pct / yield_contribution_bps):",
    ...out.allocations.map(
      (a) => `- ${a.bucket}: ${a.pct}% (yield_contribution=${a.yield_contribution_bps}bps)`,
    ),
    "",
    "Engine assumptions (cite at least one of these verbatim or by clear paraphrase):",
    ...out.assumptions.map((a) => `- ${a}`),
    "",
    "Return ONLY a JSON object with this exact shape (no extra keys, no markdown fences):",
    JSON.stringify(
      {
        narrative_md: "string (markdown, <= 2000 chars)",
        risk_warning: "string (<= 500 chars)",
        confidence: '"low" | "medium" | "high"',
        key_drivers: ["string", "string", "string (1-5 items)"],
        ptai: {
          projection: "string (<= 500 chars, expected outcome / APY range / posture)",
          trigger: "string (<= 500 chars, rule id + condition that fires)",
          action: "string (<= 500 chars, what the vault does)",
          impact: "string (<= 500 chars, quantified APY/risk/exposure impact)",
        },
      },
      null,
      2,
    ),
    "",
    "Constraints:",
    "- narrative_md MUST cite at least one of the engine assumptions verbatim or by clear paraphrase.",
    "- When quoting APY, use the formatted apy_range above (range, never single point).",
    "- If confidence is low, narrative_md MUST begin with an explicit low-confidence note.",
    "- key_drivers are the 1-5 short bullet drivers behind the projected outcome.",
    "- The confidence field in your output SHOULD generally match the engine confidence; deviate only if the narrative reveals a stronger or weaker signal and state the reason in narrative_md.",
    "- ptai is MANDATORY. Derive `trigger` from the first armed btc_tactical trigger (use its `id` and `condition`); if none is armed, state \"No active rule triggered — holding current posture.\". Derive `action` from the same trigger's `action` field plus a one-line allocation posture summary. `projection` MUST quote the formatted apy_range above. `impact` MUST cite the stressed_apy and risk_score.",
  ].join("\n");
}

/**
 * Extracts the JSON object from a model response. The system prompt asks for
 * pure JSON, but we strip an accidental ```json fence defensively rather than
 * failing the whole pipeline on a stray triple-backtick.
 */
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

export async function runScenarioNarrative(
  input: ScenarioNarrativeInput,
  opts: RunScenarioNarrativeOptions = {},
): Promise<ScenarioNarrativeOutput> {
  const model = opts.model ?? SCENARIO_NARRATIVE_MODEL;
  const methodologyVersion: MethodologyVersion = opts.methodologyVersion ?? METHODOLOGY_VERSION;

  // Build system blocks: first block is the cached methodology (always present).
  // If a userId is provided, load per-user persona and inject a second block
  // WITHOUT cache_control (user-specific data must not pollute the shared cache).
  type SystemBlock =
    | { type: "text"; text: string; cache_control: { type: "ephemeral" } }
    | { type: "text"; text: string };

  const systemBlocks: SystemBlock[] = [
    {
      type: "text",
      text: buildSystemInstructions(methodologyVersion),
      cache_control: { type: "ephemeral" },
    },
  ];

  // P1 — best-effort enrichment (defence-in-depth / symmetry with investor-memo):
  // if the personalisation layer throws we log and continue with 1 block only.
  if (opts.userId !== undefined) {
    try {
      const [profile, memory] = await Promise.all([
        loadUserAgentProfile(opts.userId, "scenario-narrative"),
        loadUserMemory(opts.userId, "scenario-narrative"),
      ]);
      const ctxBlock = buildUserContextSystemBlock({ profile, memory });
      if (ctxBlock !== null) {
        systemBlocks.push(ctxBlock);
      }
    } catch (enrichErr) {
      logger.warn(
        "scenario-narrative: per-user enrichment failed — continuing with base methodology block",
        { userId: opts.userId },
        enrichErr instanceof Error ? enrichErr : undefined,
      );
    }
  }

  const { response } = await callLlm(
    "scenario-narrative",
    {
      model,
      max_tokens: 1024,
      system: systemBlocks,
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
    throw new Error("Scenario Narrative agent returned no text block.");
  }

  const parsed = extractJson(textBlock.text);
  const result = ScenarioNarrativeOutputSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Scenario Narrative agent output failed schema validation: ${JSON.stringify(
        result.error.issues,
      )}`,
    );
  }
  const validated = result.data;

  assertNoForbiddenWords(validated.narrative_md);
  assertNoForbiddenWords(validated.risk_warning);
  // PTAI strings ship directly to the UI <Ptai> primitive and the Investor
  // Memo PDF — apply the same forbidden-words lint as the narrative body.
  assertNoForbiddenWords(validated.ptai.projection);
  assertNoForbiddenWords(validated.ptai.trigger);
  assertNoForbiddenWords(validated.ptai.action);
  assertNoForbiddenWords(validated.ptai.impact);
  assertCitesAssumption(validated.narrative_md);

  if (validated.confidence === "low" && !/low confidence/i.test(validated.narrative_md)) {
    throw new Error(
      'Scenario Narrative has confidence "low" but narrative_md does not state ' +
        '"low confidence" explicitly. Rewrite the opening sentence.',
    );
  }

  return validated;
}
