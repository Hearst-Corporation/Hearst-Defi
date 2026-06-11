/**
 * THROWAWAY benchmark harness (not committed, delete after use).
 *
 * A/B des 4 agents structurés Hearst Connect sur Kimi K2.6 (Hypercli) vs
 * GPT-4.1 vs GPT-4o-mini, en rejouant le PIPELINE RÉEL :
 *   extractJson (fence-strip) -> Zod .strict() -> forbidden-words -> assumption-citation
 *
 * Aucune écriture DB, aucun import server-only/prisma. Prompts + schémas + matcher
 * recopiés à l'identique depuis src/lib/agents/*. Méthodo v1.0 lue depuis le disque.
 *
 * Run:
 *   OPENAI_API_KEY=... pnpm tsx scripts/bench-llm-ab.ts
 * (HYPERCLI_API_KEY / HYPERCLI_BASE_URL lus depuis .env.local s'ils y sont.)
 */
import OpenAI from "openai";
import { z } from "zod";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/* ------------------------------------------------------------------ env ---- */
function loadEnvLocal(): void {
  const p = join(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1]!;
    let val = m[2]!.trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvLocal();

const HYPERCLI_API_KEY = process.env.HYPERCLI_API_KEY ?? "";
const HYPERCLI_BASE_URL = process.env.HYPERCLI_BASE_URL ?? "https://api.hypercli.com/v1";
const KIMI_MODEL = process.env.HYPERCLI_DEFAULT_MODEL ?? "kimi-k2.6";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";

console.log("Keys present:", {
  HYPERCLI_API_KEY: HYPERCLI_API_KEY.length > 0,
  HYPERCLI_BASE_URL: HYPERCLI_BASE_URL.length > 0,
  OPENAI_API_KEY: OPENAI_API_KEY.length > 0,
  KIMI_MODEL,
});
if (!HYPERCLI_API_KEY || !OPENAI_API_KEY) {
  console.error("Missing key(s). Need HYPERCLI_API_KEY (+ base url) and OPENAI_API_KEY.");
  process.exit(1);
}

const kimi = new OpenAI({ apiKey: HYPERCLI_API_KEY, baseURL: HYPERCLI_BASE_URL });
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

/* ------------------------------------------------ forbidden-words (copy) --- */
const FORBIDDEN_WORDS = [
  "guarantee",
  "promise",
  "certain",
  "will deliver",
  "risk-free",
  "no risk",
] as const;
const NEGATION_WORDS = new Set(["not", "no", "never", "without"]);
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const stripPunct = (w: string) => w.toLowerCase().replace(/[^a-z]/g, "");
function isNegated(text: string, needle: string, index: number, len: number): boolean {
  if (/^(not|no|never|without)\b/.test(needle)) return false;
  const before = text.slice(Math.max(0, index - 100), index);
  const after = text.slice(index + len, index + len + 100);
  const beforeWords = before.split(/[\s-]+/).filter(Boolean).slice(-3);
  const afterWords = after.split(/[\s-]+/).slice(0, 3);
  return [...beforeWords, ...afterWords].some((w) => NEGATION_WORDS.has(stripPunct(w)));
}
function containsForbidden(text: string): string[] | null {
  if (!text) return null;
  const hay = text.toLowerCase();
  const found: string[] = [];
  for (const needle of FORBIDDEN_WORDS) {
    const re = new RegExp(`\\b${escapeRegex(needle)}\\w*`, "gi");
    let m: RegExpExecArray | null;
    let hit = false;
    while ((m = re.exec(hay)) !== null) {
      if (isNegated(hay, needle, m.index, m[0].length)) continue;
      hit = true;
      break;
    }
    if (hit) found.push(needle);
  }
  return found.length === 0 ? null : found;
}
const citesAssumption = (t: string) =>
  /assum[ep]|assuming|assumed|assumption|assumes|hypoth[èe]se/i.test(t);

/* ----------------------------------------------------------- disclaimers --- */
const DISCLAIMER_NOT_GUARANTEED =
  "Projections are conditional on the stated assumptions. " +
  "Past performance does not indicate future results and outcomes are not guaranteed. " +
  "Hearst Yield Vault is offered exclusively to professional and qualified investors " +
  "via a Cayman Exempted Limited Partnership, subject to minimum subscription, " +
  "soft lock-up, and jurisdictional restrictions. " +
  "This material is not an offer or solicitation where prohibited.";
const DISCLAIMER_PROJECTION =
  "This is a forward-looking projection based on the stated assumptions and " +
  "the Hearst methodology version referenced in the output. " +
  "Actual results will differ. Range outputs (APY low / high) reflect modelled " +
  "uncertainty and are not maxima or minima. " +
  "No outcome is guaranteed and nothing in this projection should be read as " +
  "investment advice or as a representation that any specific result will be achieved.";

/* ----------------------------------------------------------- methodology --- */
const METHODOLOGY_V1 = readFileSync(
  join(process.cwd(), "docs", "methodology", "v1.0.md"),
  "utf8",
);
const fmtApy = (r: { low: number; high: number }) =>
  `${r.low.toFixed(2)}-${r.high.toFixed(2)}%`;

/* --------------------------------------------------------------- schemas --- */
const PtaiSchema = z
  .object({
    projection: z.string().min(1).max(500),
    trigger: z.string().min(1).max(500),
    action: z.string().min(1).max(500),
    impact: z.string().min(1).max(500),
  })
  .strict();
const ScenarioNarrativeOutputSchema = z
  .object({
    narrative_md: z.string().min(1).max(2000),
    risk_warning: z.string().min(1).max(500),
    confidence: z.enum(["low", "medium", "high"]),
    key_drivers: z.array(z.string().min(1).max(200)).min(1).max(5),
    ptai: PtaiSchema,
  })
  .strict();
const MiningHealthOutputSchema = z
  .object({
    alert_level: z.enum(["green", "amber", "red"]),
    summary: z.string().min(1).max(1000),
    recommendation: z.string().min(1).max(500),
  })
  .strict();
const RiskExplanationOutputSchema = z
  .object({
    top_risks: z
      .array(
        z
          .object({
            risk_id: z.enum([
              "market",
              "mining",
              "liquidity",
              "smart_contract",
              "counterparty",
            ]),
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
const InvestorMemoOutputSchema = z
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

function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const candidate = fenced && fenced[1] !== undefined ? fenced[1] : trimmed;
  return JSON.parse(candidate);
}

/* ------------------------------------------------------------- fixtures ---- */
const scenarioOutput = {
  mode: "balanced",
  confidence: "medium",
  apy_range: { low: 8.4, high: 12.6 },
  stressed_apy: 5.1,
  risk_score: 54,
  mining_margin_score: 61,
  allocations: [
    { bucket: "mining", pct: 35, yield_contribution_bps: 620 },
    { bucket: "usdc_base", pct: 45, yield_contribution_bps: 480 },
    { bucket: "btc_tactical", pct: 12, yield_contribution_bps: 90 },
    { bucket: "reserve", pct: 8, yield_contribution_bps: 45 },
  ],
  assumptions: [
    "Hashprice stays within the 30-day range of $0.048-0.058 / TH / day",
    "USDC base yield from tokenised T-bills + lending averages 4.8%",
    "BTC price remains within -20%/+20% of the current spot over the horizon",
  ],
  btc_tactical: {
    triggers: [
      {
        id: "BTC-TAC-02",
        condition: "perp funding 7d-avg > 12% annualised",
        action: "Open delta-neutral basis position, cap sleeve at 15%",
        armed: true,
      },
    ],
  },
};

/* --------------------------------------------------------------- agents ---- */
type Agent = {
  name: string;
  maxTokens: number;
  system: string;
  user: string;
  schema: z.ZodTypeAny;
  /** returns list of human findings ("" entries dropped) given the validated obj */
  lint: (o: unknown) => string[];
};

function lintForbidden(label: string, text: string): string {
  const f = containsForbidden(text);
  return f ? `forbidden(${label}): ${f.join(",")}` : "";
}
function lintAssumption(label: string, text: string): string {
  return citesAssumption(text) ? "" : `no-assumption(${label})`;
}

const AGENTS: Agent[] = [
  // 1. Risk Explanation
  {
    name: "risk-explanation",
    maxTokens: 1024,
    system: `You are the Risk Explanation Agent for Hearst Connect.

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
- Tone: institutional, factual, concise. No marketing. No emojis.
- Methodology version: v1.0.

Disclaimers (templated; never rewrite, never paraphrase):
${DISCLAIMER_NOT_GUARANTEED}
${DISCLAIMER_PROJECTION}

Methodology (immutable, do not contradict):
${METHODOLOGY_V1}`,
    user: [
      "Produce a Risk Explanation for the following vault risk snapshot.",
      "",
      "Global risk score: 58",
      "Current mode: balanced",
      "",
      "Component scores (JSON):",
      JSON.stringify(
        { market: 62, mining: 48, liquidity: 30, smart_contract: 45, counterparty: 25 },
        null,
        2,
      ),
      "",
      "Return ONLY a JSON object with this exact shape (no extra keys, no markdown fences):",
      JSON.stringify(
        {
          top_risks: [
            {
              risk_id: "string (dimension key, e.g. 'market')",
              name: "string",
              explanation: "string (cites >=1 assumption)",
              suggested_guardrail: "string (proposes, never auto-executes)",
            },
          ],
          overall_summary: "string (cites >=1 assumption)",
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
    ].join("\n"),
    schema: RiskExplanationOutputSchema,
    lint: (o) => {
      const v = o as z.infer<typeof RiskExplanationOutputSchema>;
      const out: string[] = [];
      for (const r of v.top_risks) {
        out.push(lintForbidden("explanation", r.explanation));
        out.push(lintForbidden("guardrail", r.suggested_guardrail));
        out.push(lintAssumption("explanation", r.explanation));
      }
      out.push(lintForbidden("summary", v.overall_summary));
      out.push(lintAssumption("summary", v.overall_summary));
      return out.filter(Boolean);
    },
  },
  // 2. Mining Health
  {
    name: "mining-health",
    maxTokens: 1024,
    system: `You are the Mining Health Agent for Hearst Connect.

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
- Methodology version: v1.0.

Disclaimers (templated; never rewrite, never paraphrase):
${DISCLAIMER_NOT_GUARANTEED}
${DISCLAIMER_PROJECTION}

Methodology (immutable, do not contradict):
${METHODOLOGY_V1}`,
    user: [
      "Produce a Mining Health assessment for the following metrics snapshot.",
      "",
      "metrics (JSON):",
      JSON.stringify(
        {
          hashprice_usd_per_th: 0.052,
          difficulty_change_pct: 6.2,
          margin_pct: 12.5,
          uptime_pct: 96.4,
          period_days: 30,
        },
        null,
        2,
      ),
      "",
      "Return ONLY a JSON object with this exact shape (no extra keys, no markdown fences):",
      JSON.stringify(
        {
          alert_level: '"green" | "amber" | "red"',
          summary: "string (cites at least one assumption and at least one numeric metric)",
          recommendation: "string (suggests; never executes)",
        },
        null,
        2,
      ),
    ].join("\n"),
    schema: MiningHealthOutputSchema,
    lint: (o) => {
      const v = o as z.infer<typeof MiningHealthOutputSchema>;
      return [
        lintForbidden("summary", v.summary),
        lintForbidden("reco", v.recommendation),
        lintAssumption("summary", v.summary),
      ].filter(Boolean);
    },
  },
  // 3. Scenario Narrative (PTAI)
  {
    name: "scenario-narrative",
    maxTokens: 1024,
    system: `You are the Scenario Narrative Agent for Hearst Connect.

Your job is to convert a single scenario run (computed by a deterministic, pure-function engine) into a short narrative for institutional / professional investors.

Rules:
- Output STRICT JSON conforming to the schema described in the user message. No prose outside JSON.
- Never use the words: guarantee, promise, certain, will deliver, risk-free, no risk. Never imply any return is assured.
- Every narrative MUST explicitly reference at least one assumption from the input \`key_assumptions\`.
- If confidence is "low", the narrative MUST open with an explicit low-confidence note (e.g. "Note: this projection has low confidence because...").
- APY is always a RANGE, never a single point. When you quote APY, use the provided range verbatim.
- Tone: institutional, factual, concise. No marketing. No emojis.
- Methodology version: v1.0. Reference it implicitly via the methodology you were given; do not invent metrics.
- PTAI format is MANDATORY. You MUST return a \`ptai\` object with four short strings — \`projection\`, \`trigger\` (cite the btc_tactical rule id when one is armed), \`action\`, \`impact\` (numerical). Each PTAI string is a single sentence, <=500 chars, never empty, must avoid the forbidden words above.

Disclaimers (templated; never rewrite, never paraphrase):
${DISCLAIMER_NOT_GUARANTEED}
${DISCLAIMER_PROJECTION}

Methodology (immutable, do not contradict):
${METHODOLOGY_V1}`,
    user: [
      "Produce a Scenario Narrative for the following scenario run.",
      "",
      "scenario_id: base-2026Q2",
      "",
      "scenario_output (engine, JSON):",
      JSON.stringify(scenarioOutput, null, 2),
      "",
      "Pre-computed fields for convenience (use these verbatim where applicable):",
      `- apy_range (formatted, use verbatim when quoting APY): ${fmtApy(scenarioOutput.apy_range)}`,
      `- stressed_apy: ${scenarioOutput.stressed_apy.toFixed(2)}%`,
      `- risk_score: ${scenarioOutput.risk_score}`,
      `- mining_margin_score: ${scenarioOutput.mining_margin_score}`,
      `- mode: ${scenarioOutput.mode}`,
      `- confidence (engine-provided, narrate accordingly): ${scenarioOutput.confidence}`,
      "",
      "Engine assumptions (cite at least one of these verbatim or by clear paraphrase):",
      ...scenarioOutput.assumptions.map((a) => `- ${a}`),
      "",
      "Return ONLY a JSON object with this exact shape (no extra keys, no markdown fences):",
      JSON.stringify(
        {
          narrative_md: "string (markdown, <= 2000 chars)",
          risk_warning: "string (<= 500 chars)",
          confidence: '"low" | "medium" | "high"',
          key_drivers: ["string", "string", "string (1-5 items)"],
          ptai: {
            projection: "string (<= 500 chars)",
            trigger: "string (<= 500 chars, rule id + condition)",
            action: "string (<= 500 chars)",
            impact: "string (<= 500 chars, quantified)",
          },
        },
        null,
        2,
      ),
      "",
      "Constraints:",
      "- narrative_md MUST cite at least one of the engine assumptions verbatim or by clear paraphrase.",
      "- When quoting APY, use the formatted apy_range above (range, never single point).",
      "- key_drivers are the 1-5 short bullet drivers behind the projected outcome.",
      "- ptai is MANDATORY. Derive `trigger` from the first armed btc_tactical trigger (use its `id` and `condition`). `projection` MUST quote the formatted apy_range. `impact` MUST cite the stressed_apy and risk_score.",
    ].join("\n"),
    schema: ScenarioNarrativeOutputSchema,
    lint: (o) => {
      const v = o as z.infer<typeof ScenarioNarrativeOutputSchema>;
      return [
        lintForbidden("narrative", v.narrative_md),
        lintForbidden("risk_warning", v.risk_warning),
        lintForbidden("ptai.projection", v.ptai.projection),
        lintForbidden("ptai.trigger", v.ptai.trigger),
        lintForbidden("ptai.action", v.ptai.action),
        lintForbidden("ptai.impact", v.ptai.impact),
        lintAssumption("narrative", v.narrative_md),
      ].filter(Boolean);
    },
  },
  // 4. Investor Memo
  {
    name: "investor-memo",
    maxTokens: 4096,
    system: `You are the Investor Memo Agent for Hearst Connect.

You receive full vault state, scenario outputs, and backtest summaries. You produce a structured 8-section Markdown memo for institutional / qualified investors (Cayman SPV structure, $250k minimum ticket, 60-day soft lock-up).

Rules — apply all without exception:
- Output STRICT JSON only. No prose outside JSON.
- Never use the words: guarantee, promise, certain, will deliver, risk-free, no risk. Never imply any return is assured.
- Every section (all 8 fields) must be Markdown. No HTML. No ASCII-art tables.
- Every section must reference at least one assumption explicitly.
- APY is ALWAYS a range (low-high). Never quote a single-point APY.
- If any input data is missing or ambiguous, state it explicitly. Do not invent numbers.
- Disclaimers are pre-supplied as templates; reproduce them verbatim in the \`disclaimer\` field. Do not paraphrase or shorten.
- Tone: institutional, factual, professional. No marketing superlatives. No emojis.
- PRODUCT THESIS: Hearst is an institutional RWA yield vault backed by Bitcoin mining cash flows. Principal is held in a USDC reserve; the monthly USDC distribution is funded by a mining-revenue-share. BTC is an economic factor and a small capped satellite sleeve — NOT the primary exposure.
- Methodology version: v1.0.

The 8 sections: executive_summary, vault_structure, scenario_analysis, risk_section, mining_section, performance_section, methodology_note, disclaimer (verbatim).

Disclaimers (reproduce verbatim in the disclaimer field — do not modify, do not summarise):
${DISCLAIMER_NOT_GUARANTEED}

${DISCLAIMER_PROJECTION}

Methodology (immutable, do not contradict):
${METHODOLOGY_V1}`,
    user: [
      "Produce an Investor Memo for the Hearst Yield Vault (vault id=yield).",
      "",
      "Vault state:",
      "  id: yield",
      "  name: Hearst Yield Vault",
      "  aumUsdc: 12500000",
      `  apyRange (use verbatim when quoting headline APY): ${fmtApy({ low: 8.4, high: 12.6 })}`,
      "  mode: balanced",
      "  riskScore: 54",
      "  vault_assumptions (cite at least one verbatim in vault_structure):",
      "    - Mining revenue-share payouts settle monthly in USDC via signed attestation",
      "    - Principal is held in a USDC cash reserve, not deployed on-chain",
      "",
      "Scenarios (1):",
      `Scenario #1 — mode=balanced, confidence=medium`,
      `  apy_range: ${fmtApy(scenarioOutput.apy_range)}`,
      `  stressed_apy: ${scenarioOutput.stressed_apy.toFixed(2)}%`,
      `  risk_score: ${scenarioOutput.risk_score}`,
      `  assumptions:`,
      ...scenarioOutput.assumptions.map((a) => `    - ${a}`),
      "",
      "Backtests (1):",
      "Backtest #1 — key=2024-2025-balanced, window=2024-01-01 → 2025-12-31",
      "  initialCapital: 10000000 USDC",
      "  endingValue: 11180000 USDC",
      "  totalReturnPct: 11.80%",
      "  maxDrawdownPct: -4.20%",
      "  worstMonthPct: -1.90%",
      "  numRebalances: 7",
      "  assumptions:",
      "    - Rebalances executed at month-end close with 15bps slippage",
      "",
      "Generated at: 2026-06-11T00:00:00Z",
      "",
      "Return ONLY a JSON object with these exact keys (no extra keys, no markdown fences):",
      JSON.stringify(
        {
          executive_summary: "string",
          vault_structure: "string",
          scenario_analysis: "string",
          risk_section: "string",
          mining_section: "string",
          performance_section: "string",
          methodology_note: "string",
          disclaimer: "string (verbatim)",
        },
        null,
        2,
      ),
      "",
      "Constraints:",
      "- All 8 fields must be non-empty Markdown strings. No HTML.",
      "- APY must always be stated as a range, never a single point.",
      "- The disclaimer field must reproduce the disclaimer templates verbatim.",
      "- Every section except disclaimer must explicitly cite at least one assumption.",
    ].join("\n"),
    schema: InvestorMemoOutputSchema,
    lint: (o) => {
      const v = o as z.infer<typeof InvestorMemoOutputSchema>;
      const fields = [
        "executive_summary",
        "vault_structure",
        "scenario_analysis",
        "risk_section",
        "mining_section",
        "performance_section",
        "methodology_note",
        "disclaimer",
      ] as const;
      const out: string[] = [];
      for (const f of fields) out.push(lintForbidden(f, v[f]));
      for (const f of fields) if (f !== "disclaimer") out.push(lintAssumption(f, v[f]));
      return out.filter(Boolean);
    },
  },
];

/* ---------------------------------------------------------------- models --- */
type ModelCfg = {
  label: string;
  client: OpenAI;
  model: string;
  priceIn: number; // $ / 1M tokens
  priceOut: number;
  approx?: boolean;
  /** Extra tokens added to agent.maxTokens for thinking models that emit
   *  reasoning_content (which shares the completion budget). 0 for plain models. */
  reasoningBudget?: number;
};
const ALL_MODELS: ModelCfg[] = [
  { label: "Kimi K2.6", client: kimi, model: KIMI_MODEL, priceIn: 0.6, priceOut: 2.5, approx: true, reasoningBudget: 6000 },
  { label: "GPT-4.1", client: openai, model: "gpt-4.1", priceIn: 2.0, priceOut: 8.0 },
  { label: "GPT-4o-mini", client: openai, model: "gpt-4o-mini", priceIn: 0.15, priceOut: 0.6 },
];
// Optional filter: BENCH_ONLY="Kimi K2.6" re-runs a single model.
const ONLY = (process.env.BENCH_ONLY ?? "").trim();
const MODELS = ONLY ? ALL_MODELS.filter((m) => m.label === ONLY) : ALL_MODELS;

/* ---------------------------------------------------------------- runner --- */
type Row = {
  agent: string;
  model: string;
  ok: boolean;
  jsonOk: boolean;
  schemaOk: boolean;
  lintFindings: string[];
  latencyMs: number;
  inTok: number;
  outTok: number;
  costUsd: number;
  error?: string;
  schemaIssues?: string;
};
const rows: Row[] = [];
const fullOutputs: Record<string, unknown> = {};

async function runOne(agent: Agent, cfg: ModelCfg): Promise<void> {
  const t0 = Date.now();
  const row: Row = {
    agent: agent.name,
    model: cfg.label,
    ok: false,
    jsonOk: false,
    schemaOk: false,
    lintFindings: [],
    latencyMs: 0,
    inTok: 0,
    outTok: 0,
    costUsd: 0,
  };
  try {
    const completion = await cfg.client.chat.completions.create(
      {
        model: cfg.model,
        max_tokens: agent.maxTokens + (cfg.reasoningBudget ?? 0),
        messages: [
          { role: "system", content: agent.system },
          { role: "user", content: agent.user },
        ],
      },
      { timeout: 180_000 },
    );
    row.latencyMs = Date.now() - t0;
    row.inTok = completion.usage?.prompt_tokens ?? 0;
    row.outTok = completion.usage?.completion_tokens ?? 0;
    row.costUsd =
      (row.inTok / 1e6) * cfg.priceIn + (row.outTok / 1e6) * cfg.priceOut;
    const msg = completion.choices[0]?.message as
      | { content?: string | null; reasoning_content?: string | null }
      | undefined;
    const text = msg?.content ?? "";
    const reasoning = msg?.reasoning_content ?? "";
    fullOutputs[`${agent.name}__${cfg.label}`] = { text, reasoningLen: reasoning.length };
    if (reasoning.length > 0) {
      console.log(`    [reasoning_content: ${reasoning.length} chars, finish=${completion.choices[0]?.finish_reason}]`);
    }

    let parsed: unknown;
    try {
      parsed = extractJson(text);
      row.jsonOk = true;
    } catch (e) {
      row.error = `JSON parse: ${(e as Error).message}`;
      rows.push(row);
      return;
    }
    const res = agent.schema.safeParse(parsed);
    if (!res.success) {
      row.schemaOk = false;
      row.schemaIssues = res.error.issues
        .map((i) => `${i.path.join(".")}:${i.message}`)
        .slice(0, 4)
        .join(" | ");
      rows.push(row);
      return;
    }
    row.schemaOk = true;
    row.lintFindings = agent.lint(res.data);
    row.ok = row.lintFindings.length === 0;
  } catch (e) {
    row.latencyMs = Date.now() - t0;
    row.error = (e as Error).message?.slice(0, 180);
  }
  rows.push(row);
}

async function main(): Promise<void> {
  for (const agent of AGENTS) {
    for (const cfg of MODELS) {
      process.stdout.write(`▶ ${agent.name} × ${cfg.label} … `);
      await runOne(agent, cfg);
      const r = rows[rows.length - 1]!;
      console.log(
        r.error
          ? `ERROR (${r.error})`
          : `${r.ok ? "PASS" : "FAIL"} json=${r.jsonOk} schema=${r.schemaOk} lint=${r.lintFindings.length} ${r.latencyMs}ms ${r.outTok}tok`,
      );
    }
  }

  console.log("\n================== A/B RESULTS ==================\n");
  const pad = (s: string, n: number) => s.padEnd(n).slice(0, n);
  console.log(
    pad("AGENT", 20),
    pad("MODEL", 13),
    pad("VERDICT", 8),
    pad("JSON", 5),
    pad("SCHEMA", 7),
    pad("LINT", 5),
    pad("LAT(ms)", 8),
    pad("OUT_TOK", 8),
    pad("COST$", 9),
  );
  for (const r of rows) {
    console.log(
      pad(r.agent, 20),
      pad(r.model, 13),
      pad(r.error ? "ERROR" : r.ok ? "PASS" : "FAIL", 8),
      pad(r.jsonOk ? "ok" : "—", 5),
      pad(r.schemaOk ? "ok" : "BAD", 7),
      pad(String(r.lintFindings.length), 5),
      pad(String(r.latencyMs), 8),
      pad(String(r.outTok), 8),
      pad((r.costUsd ? r.costUsd.toFixed(5) : "0") + (MODELS.find((m) => m.label === r.model)?.approx ? "~" : ""), 9),
    );
    if (r.schemaIssues) console.log("    schema:", r.schemaIssues);
    if (r.lintFindings.length) console.log("    lint:", r.lintFindings.join(" ; "));
    if (r.error) console.log("    error:", r.error);
  }

  // Per-model aggregate
  console.log("\n--- aggregate (pass / 4 agents) ---");
  for (const cfg of MODELS) {
    const mr = rows.filter((r) => r.model === cfg.label);
    const pass = mr.filter((r) => r.ok).length;
    const schemaOk = mr.filter((r) => r.schemaOk).length;
    const avgLat = Math.round(mr.reduce((a, r) => a + r.latencyMs, 0) / (mr.length || 1));
    const cost = mr.reduce((a, r) => a + r.costUsd, 0);
    console.log(
      `${pad(cfg.label, 13)} pass=${pass}/4  schema_ok=${schemaOk}/4  avg_lat=${avgLat}ms  total_cost=$${cost.toFixed(5)}${cfg.approx ? "~" : ""}`,
    );
  }

  const outPath = "/tmp/bench-llm-ab-outputs.json";
  writeFileSync(outPath, JSON.stringify({ rows, fullOutputs }, null, 2));
  console.log(`\nFull outputs written to ${outPath}`);
}

void main();
