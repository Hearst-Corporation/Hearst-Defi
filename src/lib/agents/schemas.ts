import { z } from "zod";

/**
 * Zod schemas + inferred TypeScript types for every Hearst Connect agent.
 *
 * Rules of the road:
 * - Every agent returns a STRUCTURED JSON object that conforms to one of
 *   these schemas. No free-form text.
 * - `confidence: "low"` must be addressed explicitly in the narrative
 *   (enforced separately by validators / prompts, not the schema).
 * - We use `.strict()` so unknown keys from the model trigger a Zod failure.
 */

/* -------------------------------------------------------------------------- */
/* Data provenance (CLAUDE.md non-negotiable #2)                              */
/* -------------------------------------------------------------------------- */

/**
 * Canonical provenance vocabulary threaded into every agent Input so the
 * LP-facing artifacts can QUALIFY each cited number — non-negotiable #2
 * ("every metric has a provenance badge: Live / Oracle / Attested / Estimated /
 * Manual / Stale").
 *
 * The loaders already compute this signal (mining `is_fallback`/`hashprice.stale`,
 * coverage `live|estimated|pending|invalid`, risk `db|partial|fallback`); this
 * type is the lossless wire format that carries it across the agent boundary
 * instead of being stripped. The agents render it per number in the prompt and
 * are instructed to flag anything Estimated/Stale/fallback in-line.
 *
 * Mapping from upstream signals (done in the loaders, never recomputed here):
 *   - attested  : measured row + verified mining_attestation Proof (no manual input)
 *   - live      : freshly fetched/derived datapoint, not stale (e.g. live hashprice)
 *   - oracle    : value sourced from an on-chain / external oracle feed
 *   - manual    : env / config bridge value (e.g. MINING_REVENUE_SHARE_BPS)
 *   - estimated : derived/proxy value, or present-but-not-attested (coverage Estimated)
 *   - stale     : datapoint older than its freshness SLO (hashprice.stale === true)
 *   - fallback  : canned default used because the DB / feed had no data (is_fallback)
 *   - pending   : a mandatory input is missing — number is NOT yet computable
 */
export const PROVENANCE_TAGS = [
  "attested",
  "live",
  "oracle",
  "manual",
  "estimated",
  "stale",
  "fallback",
  "pending",
] as const;

export const ProvenanceTagSchema = z.enum(PROVENANCE_TAGS);

export type ProvenanceTag = z.infer<typeof ProvenanceTagSchema>;

/**
 * Human-facing label for a provenance tag, used verbatim when the agent
 * renders the qualifier next to a number (e.g. "(Estimated)", "(Stale)").
 * Mirrors the badge vocabulary in CLAUDE.md #2 and `src/lib/llm/prompts.ts`.
 */
export function provenanceLabel(tag: ProvenanceTag): string {
  switch (tag) {
    case "attested":
      return "Attested";
    case "live":
      return "Live";
    case "oracle":
      return "Oracle";
    case "manual":
      return "Manual";
    case "estimated":
      return "Estimated";
    case "stale":
      return "Stale";
    case "fallback":
      return "Estimated (fallback)";
    case "pending":
      return "Pending";
  }
}

/**
 * Tags that MUST be flagged in-line and never presented as attested fact.
 * The agents are instructed to caveat these; tests assert the qualifier is
 * threaded into the prompt for these cases.
 */
export function isDegradedProvenance(tag: ProvenanceTag): boolean {
  return (
    tag === "estimated" ||
    tag === "stale" ||
    tag === "fallback" ||
    tag === "manual" ||
    tag === "pending"
  );
}

/**
 * Renders the provenance qualifier for a single labelled metric, used verbatim
 * inside the agent user prompts so every cited number carries its badge. E.g.
 *   renderProvenanceLine("hashprice_usd_per_th", "live")
 *   → "- hashprice_usd_per_th provenance: Live"
 * Degraded tags get an explicit FLAG marker so the model cannot miss them.
 */
export function renderProvenanceLine(metric: string, tag: ProvenanceTag): string {
  const flag = isDegradedProvenance(tag) ? " — FLAG IN-LINE, do not present as attested" : "";
  return `- ${metric} provenance: ${provenanceLabel(tag)}${flag}`;
}

/**
 * The shared system-prompt clause that pins non-negotiable #2 into every
 * structured agent. Wording mirrors `src/lib/llm/prompts.ts` (cockpit chat
 * rule #2) so the LP-facing surface and the agents speak the same provenance
 * language. Every agent injects this verbatim into its system instructions.
 */
export const PROVENANCE_SYSTEM_RULE = [
  "PROVENANCE (non-negotiable #2): every figure you cite must be qualifiable as one of",
  "Live / Oracle / Attested / Estimated / Manual / Stale. The user message tags each input",
  "metric with its provenance. You MUST flag Estimated / Stale / fallback / Manual / Pending",
  "data IN-LINE (e.g. \"margin 18% (Estimated)\") and never present it as Attested or as a",
  "settled fact. If a number's provenance is Pending, state explicitly that it is not yet",
  "available rather than inventing a value.",
].join(" ");

/* -------------------------------------------------------------------------- */
/* Scenario Narrative Agent (OpenAI GPT-4.1 — ADR-011)                      */
/* -------------------------------------------------------------------------- */

/**
 * PTAI sub-schema — enforces the Projection / Trigger / Action / Impact
 * format mandated by CLAUDE.md non-negotiable #3. Every rebalancing /
 * projection narrative MUST surface the 4 strings explicitly so the UI
 * `<Ptai>` component can render them without parsing the free-form
 * `narrative_md` blob. Strings are bounded to keep PDF layouts predictable.
 */
export const PtaiSchema = z
  .object({
    projection: z.string().min(1).max(500),
    trigger: z.string().min(1).max(500),
    action: z.string().min(1).max(500),
    impact: z.string().min(1).max(500),
  })
  .strict();

export type Ptai = z.infer<typeof PtaiSchema>;

export const ScenarioNarrativeOutputSchema = z
  .object({
    narrative_md: z.string().min(1).max(2000),
    risk_warning: z.string().min(1).max(500),
    confidence: z.enum(["low", "medium", "high"]),
    key_drivers: z.array(z.string().min(1).max(200)).min(1).max(5),
    /**
     * Structured PTAI tuple — single source of truth for any UI surface
     * that needs to render the 4-line format (Investor Memo PDF, Governance
     * proposal detail; the Scenario Lab route was retired). Required as of audit
     * coherence-2026-05-26 / 08-ptai-format (P1.4).
     */
    ptai: PtaiSchema,
  })
  .strict();

export type ScenarioNarrativeOutput = z.infer<typeof ScenarioNarrativeOutputSchema>;

/* -------------------------------------------------------------------------- */
/* Mining Health Agent (OpenAI GPT-4.1 — ADR-011)                           */
/* -------------------------------------------------------------------------- */

export const MiningHealthOutputSchema = z
  .object({
    alert_level: z.enum(["green", "amber", "red"]),
    summary: z.string().min(1).max(1000),
    recommendation: z.string().min(1).max(500),
  })
  .strict();

export type MiningHealthOutput = z.infer<typeof MiningHealthOutputSchema>;

/* -------------------------------------------------------------------------- */
/* Risk Explanation Agent (OpenAI GPT-4.1 — ADR-011)                        */
/* -------------------------------------------------------------------------- */

export const RiskExplanationOutputSchema = z
  .object({
    top_risks: z
      .array(
        z
          .object({
            risk_id: z.enum(["market", "mining", "liquidity", "smart_contract", "counterparty"]),
            name: z.string().min(1),
            explanation: z.string().min(1),
            suggested_guardrail: z.string().min(1),
          })
          .strict(),
      )
      .min(1)
      .max(2),
    overall_summary: z.string().min(1),
  })
  .strict();

export type RiskExplanationOutput = z.infer<typeof RiskExplanationOutputSchema>;

/* -------------------------------------------------------------------------- */
/* Investor Memo Agent (OpenAI GPT-4.1 — ADR-011)                           */
/* -------------------------------------------------------------------------- */

export const InvestorMemoOutputSchema = z
  .object({
    executive_summary: z.string().min(1),
    vault_structure: z.string().min(1),
    scenario_analysis: z.string().min(1),
    risk_section: z.string().min(1),
    mining_section: z.string().min(1),
    performance_section: z.string().min(1),
    methodology_note: z.string().min(1),
    disclaimer: z.string().min(1),
  })
  .strict();

export type InvestorMemoOutput = z.infer<typeof InvestorMemoOutputSchema>;
