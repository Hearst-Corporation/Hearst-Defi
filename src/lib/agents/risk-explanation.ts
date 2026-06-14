import "server-only";

import {
  RiskExplanationOutputSchema,
  PROVENANCE_SYSTEM_RULE,
  provenanceLabel,
  isDegradedProvenance,
  type RiskExplanationOutput,
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
import {
  assertApyAlwaysRange,
  assertCitesAssumption,
  assertNoForbiddenWords,
} from "@/lib/agents/validators";

/**
 * Default model id for the Risk Explanation Agent.
 *
 * Runs on OpenAI GPT-4.1 (ADR-011) — the single provider.
 * Triggers daily and on every rebalancing event.
 */
export const RISK_EXPLANATION_MODEL = LLM_MODEL;

/**
 * Input for the Risk Explanation Agent.
 *
 * Live data is passed in by the caller — the agent never fetches it.
 * `componentScores` keys correspond to the 5 canonical risk dimensions
 * defined in `/docs/spec/08-risk-framework.mdx`:
 *   market | mining | liquidity | smart_contract | counterparty
 */
export interface RiskExplanationInput {
  /** Global composite risk score (0-100). */
  riskScore: number;
  /**
   * Per-dimension scores (0-100). The agent selects the 1-2 highest
   * as the "most salient" risks to explain.
   */
  componentScores: Record<string, number>;
  /**
   * Current vault mode / scenario key (e.g. "base", "bear", "bull").
   * Used by the agent to contextualise guardrail suggestions.
   */
  mode: string;
  /**
   * Provenance of the risk scores (CLAUDE.md non-negotiable #2). Optional for
   * back-compat. `risk-daily.ts` maps the framework loader's
   * `source: 'db' | 'partial' | 'fallback'` onto this so the agent qualifies
   * the scores it explains: `attested` when every input came from real rows,
   * `estimated` when some dimensions fell back to a proxy, `fallback` when the
   * snapshot itself was missing and canned anchors were used. When absent the
   * agent defaults to `attested`.
   */
  provenance?: ProvenanceTag;
}

export interface RunRiskExplanationOptions {
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
   * Methodology version cited by the agent. Defaults to `v1.0` (rule-based
   * risk scores). Pass `"v2.0"` when the risk snapshot comes from a Monte
   * Carlo run so the cited source matches the upstream computation.
   */
  methodologyVersion?: MethodologyVersion;
}

function buildSystemInstructions(version: MethodologyVersion): string {
  return `You are the Risk Explanation Agent for Hearst Connect.

You receive a snapshot of vault risk scores (one global score + per-dimension component scores) and the current vault mode. You identify the 1 or 2 most salient risk dimensions (the ones with the highest component scores) and return a structured explanation for the operations and risk team.

The 5 canonical risk dimensions and their score thresholds (from the Risk Framework):
- market:          green <40 / amber 40-65 / red >65   (weight 30%)
- mining:          green <30 / amber 30-60 / red >60   (weight 25%)
- liquidity:       green <35 / amber 35-55 / red >55   (weight 15%)
- smart_contract:  green <40 / amber 40-60 / red >60   (weight 20%)
- counterparty:    green <30 / amber 30-55 / red >55   (weight 10%)

Rules:
- Output STRICT JSON only. No prose outside JSON.
- Never use the words: guarantee, promise, certain, will deliver, risk-free, no risk. Never imply yields are assured.
- Select exactly 1 or 2 risks: choose the dimension(s) with the highest componentScore. If two are essentially tied within 3 points, include both; otherwise return only the top one.
- Each \`risk_id\` must be the dimension key as provided in componentScores (e.g. "market", "mining").
- Each \`explanation\` MUST reference at least one assumption (e.g. "Under the assumption that BTC price stays within the current range...").
- Each \`suggested_guardrail\` proposes a mitigation (e.g. "Consider reducing mining allocation per Rule RISK-02"). It must cite a rationale or rule reference; it must NOT claim the vault will execute automatically.
- The \`overall_summary\` must reference at least one assumption and provide an aggregate view of vault risk posture.
- ${PROVENANCE_SYSTEM_RULE}
- Tone: institutional, factual, concise. No marketing. No emojis.
- Methodology version: ${version}.

Disclaimers (templated; never rewrite, never paraphrase):
${DISCLAIMER_NOT_GUARANTEED}
${DISCLAIMER_PROJECTION}

Methodology (immutable, do not contradict):
${getMethodologyMd(version)}`;
}

function buildUserPrompt(input: RiskExplanationInput): string {
  const tag: ProvenanceTag = input.provenance ?? "attested";
  const provLine = isDegradedProvenance(tag)
    ? `Risk-score provenance: ${provenanceLabel(tag)} — these scores are NOT fully attested. Flag this in-line in both the explanations and the overall_summary; do not present the scores as settled fact.`
    : `Risk-score provenance: ${provenanceLabel(tag)} — every score is sourced from measured rows.`;
  return [
    "Produce a Risk Explanation for the following vault risk snapshot.",
    "",
    `Global risk score: ${input.riskScore}`,
    `Current mode: ${input.mode}`,
    provLine,
    "",
    "Component scores (JSON):",
    JSON.stringify(input.componentScores, null, 2),
    "",
    "Return ONLY a JSON object with this exact shape (no extra keys, no markdown fences):",
    JSON.stringify(
      {
        top_risks: [
          {
            risk_id: "string (dimension key, e.g. 'market')",
            name: "string (human-readable label, e.g. 'Market Risk')",
            explanation: "string (explains why this dimension is elevated, cites ≥1 assumption)",
            suggested_guardrail: "string (proposes mitigation, cites a rule or rationale, never auto-executes)",
          },
        ],
        overall_summary: "string (aggregate risk posture, cites ≥1 assumption)",
      },
      null,
      2,
    ),
    "",
    "Constraints:",
    "- top_risks must have 1 or 2 entries: the dimension(s) with the highest score(s).",
    "- Each explanation must explicitly cite at least one assumption.",
    "- overall_summary must explicitly cite at least one assumption.",
    "- suggested_guardrail must propose, not decide. Use phrasing like 'consider', 'suggest', 'review'.",
  ].join("\n");
}

/**
 * Extracts the JSON object from a model response. The system prompt asks for
 * pure JSON, but we strip an accidental ```json fence defensively.
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

export async function runRiskExplanation(
  input: RiskExplanationInput,
  opts: RunRiskExplanationOptions = {},
): Promise<RiskExplanationOutput> {
  const model = opts.model ?? RISK_EXPLANATION_MODEL;
  const methodologyVersion: MethodologyVersion = opts.methodologyVersion ?? METHODOLOGY_VERSION;

  const { response } = await callLlm(
    "risk-explanation",
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
    throw new Error("Risk Explanation agent returned no text block.");
  }

  const parsed = extractJson(textBlock.text);
  const result = RiskExplanationOutputSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Risk Explanation agent output failed schema validation: ${JSON.stringify(
        result.error.issues,
      )}`,
    );
  }
  const validated = result.data;

  // Post-validation: forbidden-words linter on all text fields.
  // Each risk explanation must also cite >=1 assumption (spec/09-agents.mdx:
  // "Each explanation MUST reference at least one assumption").
  for (const risk of validated.top_risks) {
    assertNoForbiddenWords(risk.explanation);
    assertNoForbiddenWords(risk.suggested_guardrail);
    assertApyAlwaysRange(risk.explanation);
    assertApyAlwaysRange(risk.suggested_guardrail);
    assertCitesAssumption(risk.explanation);
  }
  assertNoForbiddenWords(validated.overall_summary);
  assertApyAlwaysRange(validated.overall_summary);

  // Every summary must cite at least one assumption
  assertCitesAssumption(validated.overall_summary);

  return validated;
}
