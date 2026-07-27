import "server-only";

import {
  InvestorMemoOutputSchema,
  PROVENANCE_SYSTEM_RULE,
  renderProvenanceLine,
  type InvestorMemoOutput,
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
  assertNoForbiddenWords,
  assertCitesAssumption,
} from "@/lib/agents/validators";
import { runAgent, type SystemBlock } from "@/lib/agents/run-agent";
import {
  loadUserAgentProfile,
  loadUserMemory,
  buildUserContextSystemBlock,
} from "@/lib/agents/user-context";
import { logger } from "@/lib/logger";
import type { BacktestOutput, ScenarioOutput } from "@/lib/engine/types";
import { formatApyRange } from "@/lib/format/apy";

/**
 * Default model id for the Investor Memo Agent.
 *
 * All agents run on OpenAI GPT-4.1 (ADR-011) — the single provider. The actual
 * inference model is resolved by `callLlm` from `OPENAI_MODEL`; this constant
 * is the logical id recorded on `LlmRun.model`.
 */
/** Logical model id on `LlmRun` — mirrors `OPENAI_MODEL` env (ADR-011). */
export const INVESTOR_MEMO_MODEL = LLM_MODEL;

/**
 * Per-section provenance for the memo (CLAUDE.md non-negotiable #2). Each tag
 * qualifies the numbers in the corresponding section so the agent flags
 * Estimated / Stale / Pending data in-line and never presents it as attested.
 * Populated by `loadMemoInput` from the live signals the loaders already
 * compute (vault snapshot freshness, coverage view provenance). Optional and
 * back-compat: when absent the agent defaults every section to `attested`.
 */
export interface InvestorMemoProvenance {
  /** Vault state numbers (AUM, APY range, risk score) — snapshot freshness. */
  vault: ProvenanceTag;
  /** Mining / cash-flow numbers (hashrate, margin, uptime). */
  mining: ProvenanceTag;
  /** Distribution-coverage ratio (CoverageView.provenance). */
  coverage: ProvenanceTag;
  /** Scenario projections (rule-based engine output rehydrated from DB). */
  scenarios: ProvenanceTag;
  /** Historical backtest results. */
  backtests: ProvenanceTag;
}

export type InvestorMemoInput = {
  vault: {
    /** Vault id this memo run is bound to (ADR-006 #9). Optional for back-compat. */
    id?: string;
    /** Human label, e.g. "Hearst Bitcoin Reserve Vault — Series 1". Optional for back-compat. */
    name?: string;
    aumUsdc: number;
    apyRange: { low: number; high: number };
    mode: string;
    riskScore: number;
    /** Vault's OWN assumptions cited verbatim by the memo agent. Optional for back-compat. */
    assumptions?: string[];
  };
  scenarios: ScenarioOutput[];
  backtests: BacktestOutput[];
  generatedAt: string;
  /** Per-section provenance descriptor (non-negotiable #2). Optional for back-compat. */
  provenance?: InvestorMemoProvenance;
};

/** Default provenance when the caller does not thread one. */
const DEFAULT_MEMO_PROVENANCE: InvestorMemoProvenance = {
  vault: "attested",
  mining: "attested",
  coverage: "attested",
  scenarios: "attested",
  backtests: "attested",
};

export interface RunInvestorMemoOptions {
  /**
   * Injected LLM client. Tests pass a mock; production callers pass a shared
   * client. If absent, we construct one inside the function (never at module
   * load) so importing this file in a non-server context doesn't trigger SDK
   * init.
   */
  client?: LlmClientLike;
  /** Override the logical model id recorded on `LlmRun`. Default: `OPENAI_MODEL` / `LLM_MODEL`. */
  model?: string;
  /** Timeout in ms for the LLM call. Default: 180_000 (3 min) — the memo is the largest output at 4096 tokens. */
  timeoutMs?: number;
  /**
   * Authenticated user identifier. When provided, the per-user persona
   * profile and recent activity are loaded and injected as a second system
   * block (after the cached methodology block). When absent, behaviour is
   * strictly unchanged.
   */
  userId?: string;
  /**
   * Methodology version cited by the memo. Defaults to `v1.0` (rule-based
   * scenarios + backtests). Pass `"v2.0"` when the memo consumes Monte Carlo
   * outputs alongside the rule-based scenarios so the methodology_note cites
   * the ratified MC source instead of v1.0.
   */
  methodologyVersion?: MethodologyVersion;
}

/** Exported for unit-testing only. Do not call from application code directly. */
export function buildSystemInstructions(version: MethodologyVersion): string {
  return `You are the Investor Memo Agent for Hearst Connect.

You receive full vault state, scenario outputs, and backtest summaries. You produce a structured 8-section Markdown memo for institutional / qualified investors (Cayman SPV structure, $250k minimum ticket, 60-day soft lock-up).

Rules — apply all without exception:
- Output STRICT JSON only. No prose outside JSON.
- Never use the words: guarantee, promise, certain, will deliver, risk-free, no risk. Never imply any return is assured.
- Every section (all 8 fields) must be Markdown. No HTML. No ASCII-art tables. Use Markdown tables (pipe syntax) if tabular data is needed.
- Every section must reference at least one assumption explicitly (e.g. "Under the assumption that hashprice remains within the 30-day range...").
- APY is ALWAYS a range (low-high). Never quote a single-point APY.
- If any input data is missing or ambiguous, state it explicitly in the relevant section. Do not invent numbers.
- Disclaimers are pre-supplied as templates; reproduce them verbatim in the \`disclaimer\` field. Do not paraphrase or shorten.
- Tone: institutional, factual, professional. No marketing superlatives. No emojis.
- PRODUCT THESIS (state it first): Hearst is an institutional BTC-accumulation mining note backed by real Bitcoin mining, structured in three on-chain pockets with a fixed on-chain allocation — B1 Mining Power 40%, B2 BTC Pouch 27%, B3 Reserve USDC 33%. It accumulates BTC over a 24-month term and delivers BTC at maturity: there is NO periodic cash distribution and NO fixed APY. The estimated return is disclosed ONLY as a range, expressed as BTC accumulated over the term — not distributed and not guaranteed.
- PRODUCT MECHANICS: the 40/27/33 allocation is fixed on-chain; outcomes are shaped by three on-chain mechanisms, not by sleeve reallocation — take-profit tiers realise BTC gains on the B2 BTC Pouch, a fixed vending curve depletes the B3 Reserve USDC across the term to fund operations, and the B1 Mining Power pocket is curtailed below a configured pre/post-halving price threshold. Net mining margin accrues to the note as BTC accumulation; the mining pocket's electricity is settled on-chain through the electricity account.
- NARRATIVE ORDER (mandatory): the memo must lead, in this order — (1) product thesis (BTC-accumulation mining note, three pockets, delivered at maturity, no periodic distribution, no fixed APY), (2) the three on-chain pockets and their fixed 40/27/33 allocation, (3) mining economics as the accumulation input (deployed hashrate × hashprice × uptime, minus operating costs), (4) the three mechanisms (take-profit, vending curve, curtailment) and whether net mining margin covers the mining pocket's on-chain electricity cost, (5) the B3 reserve and capital-preservation posture, (6) risk factors (mining revenue first), (7) the estimated-return range expressed as accumulated BTC, (8) scenario outputs. Do NOT open with APY or a single-point return. Do NOT describe a monthly cash distribution or a fixed annual rate. Lead with the accumulation model and its mechanisms.
- ${PROVENANCE_SYSTEM_RULE}
- Methodology version: ${version}.

The 8 sections and their purpose:
1. executive_summary — OPEN with the product thesis (BTC-accumulation mining note backed by real Bitcoin mining; three pockets; BTC delivered at maturity; no periodic distribution, no fixed APY), then the pocket structure and the mining-economics accumulation input; the estimated-return range (expressed as accumulated BTC) comes after, framed as a projected range, never a single point (2-3 paragraphs)
2. vault_structure — Cayman SPV mechanics, the three on-chain pockets and their fixed allocation (B1 Mining Power 40%, B2 BTC Pouch 27%, B3 Reserve USDC 33%), the 24-month term with BTC delivered at maturity, and the contractual $250k minimum ticket + 60-day soft lock-up (applicative, not enforced on-chain) (1-2 paragraphs)
3. scenario_analysis — narrative covering all provided scenarios with their return ranges (expressed as accumulated BTC) and PTAI format where applicable (1 paragraph per scenario)
4. risk_section — the 5 canonical risks ordered by economic materiality: MINING REVENUE first, then counterparty/custody, liquidity, market, smart_contract — with current posture (structured Markdown)
5. mining_section — the ACCUMULATION ENGINE: hashrate, margin, energy, uptime, whether net mining margin covers the mining pocket's on-chain electricity cost, and the assumptions behind the projected BTC accumulation (1-2 paragraphs)
6. performance_section — backtest summary results with drawdown and return context (1 paragraph per backtest)
7. methodology_note — reference to methodology version, data sources, confidence scoring, limitations (1 paragraph)
8. disclaimer — the exact disclaimer text as provided below, reproduced verbatim

Disclaimers (reproduce verbatim in the disclaimer field — do not modify, do not summarise):
${DISCLAIMER_NOT_GUARANTEED}

${DISCLAIMER_PROJECTION}

Methodology (immutable, do not contradict):
${getMethodologyMd(version)}`;
}

function buildBacktestBlock(bt: BacktestOutput, idx: number): string {
  const assumptionLines = bt.assumptions.map((a) => `    - ${a}`).join("\n");
  return [
    `Backtest #${idx + 1} — key=${bt.key}, window=${bt.startDate} → ${bt.endDate}`,
    `  initialCapital: ${bt.initialCapital} USDC`,
    `  endingValue: ${bt.endingValue} USDC`,
    `  totalReturnPct: ${bt.totalReturnPct.toFixed(2)}%`,
    `  maxDrawdownPct: ${bt.maxDrawdownPct.toFixed(2)}%`,
    `  worstMonthPct: ${bt.worstMonthPct.toFixed(2)}%`,
    `  numRebalances: ${bt.numRebalances}`,
    `  hearstRulesMode: ${bt.hearstRulesMode}`,
    `  assumptions:`,
    assumptionLines,
  ].join("\n");
}

function buildUserPrompt(
  input: InvestorMemoInput,
  methodologyVersion: MethodologyVersion,
): string {
  const backtestBlocks = input.backtests
    .map((bt, idx) => buildBacktestBlock(bt, idx))
    .join("\n\n");
  const prov = input.provenance ?? DEFAULT_MEMO_PROVENANCE;
  // Fallback matches the preset canon — the retired "Yield Vault" name must
  // not resurface in the memo when a caller omits the label.
  const vaultName = input.vault.name ?? "Hearst Bitcoin Reserve Vault — Series 1";
  const vaultId = input.vault.id ?? "yield";
  const vaultAssumptions = input.vault.assumptions ?? [];
  const vaultAssumptionLines =
    vaultAssumptions.length > 0
      ? vaultAssumptions.map((a) => `    - ${a}`).join("\n")
      : `    (none provided — fall back to the methodology ${methodologyVersion} defaults)`;

  return [
    `Produce an Investor Memo for the ${vaultName} (vault id=${vaultId}). Use ONLY this vault's name and assumptions throughout — do not silently substitute another vault's posture or projections.`,
    "",
    "Vault state:",
    `  id: ${vaultId}`,
    `  name: ${vaultName}`,
    `  aumUsdc: ${input.vault.aumUsdc}`,
    `  apyRange (use verbatim when quoting headline APY): ${formatApyRange(input.vault.apyRange, 2)}`,
    `  mode: ${input.vault.mode}`,
    `  riskScore: ${input.vault.riskScore}`,
    `  vault_assumptions (cite at least one verbatim in vault_structure):`,
    vaultAssumptionLines,
    "",
    // Scenario engine retired: the memo no longer receives a scenario
    // projection to narrate. `input.scenarios` is always empty; do NOT invent a
    // scenario. The section must state plainly that no scenario model is
    // attached to this memo rather than fabricate one.
    "Scenarios: none. The scenario projection model is not part of this memo; state this plainly in scenario_analysis and do not invent scenarios or return figures.",
    "",
    `Backtests (${input.backtests.length}):`,
    backtestBlocks || "  (none provided — state this explicitly in performance_section)",
    "",
    "Provenance per data domain (qualify every cited number; flag Estimated/Stale/Pending/Manual in-line, never as attested):",
    renderProvenanceLine("vault state (AUM, APY range, risk score)", prov.vault),
    renderProvenanceLine("mining / cash-flow (hashrate, margin, uptime)", prov.mining),
    renderProvenanceLine("distribution coverage ratio", prov.coverage),
    renderProvenanceLine("scenario projections", prov.scenarios),
    renderProvenanceLine("backtest results", prov.backtests),
    "",
    `Generated at: ${input.generatedAt}`,
    "",
    "Return ONLY a JSON object with this exact shape (no extra keys, no markdown fences):",
    JSON.stringify(
      {
        executive_summary: "string (Markdown, 2-3 paragraphs, cites >=1 assumption)",
        vault_structure: "string (Markdown, 1-2 paragraphs, describes Cayman SPV + allocation buckets + lock-up)",
        scenario_analysis: "string (Markdown, 1 paragraph per scenario, uses APY ranges, references assumptions)",
        risk_section: "string (Markdown, covers all 5 risk dimensions: market, mining, liquidity, smart_contract, counterparty)",
        mining_section: "string (Markdown, 1-2 paragraphs, hashrate/margin/energy/uptime context)",
        performance_section: "string (Markdown, 1 paragraph per backtest, cites drawdown and total return)",
        methodology_note: "string (Markdown, 1 paragraph, references methodology version and limitations)",
        disclaimer: "string (verbatim disclaimer text, no paraphrasing)",
      },
      null,
      2,
    ),
    "",
    "Constraints:",
    "- All 8 fields must be non-empty Markdown strings.",
    "- No HTML tags anywhere in the output.",
    "- No ASCII-art tables. Use Markdown pipe tables if tabular data is needed.",
    "- APY must always be stated as a range (e.g. '8.20-11.40%'), never as a single point.",
    "- The disclaimer field must reproduce the disclaimer templates verbatim.",
    "- Every section must explicitly cite at least one assumption.",
    "- Performance section must reference totalReturnPct and maxDrawdownPct per backtest.",
  ].join("\n");
}

export async function runInvestorMemo(
  input: InvestorMemoInput,
  opts: RunInvestorMemoOptions = {},
): Promise<InvestorMemoOutput> {
  const model = opts.model ?? INVESTOR_MEMO_MODEL;
  const methodologyVersion: MethodologyVersion = opts.methodologyVersion ?? METHODOLOGY_VERSION;

  // Build system blocks: first block is the cached methodology (always present).
  // If a userId is provided, load per-user persona and inject a second block
  // WITHOUT cache_control (user-specific data must not pollute the shared cache).
  const systemBlocks: SystemBlock[] = [
    {
      type: "text",
      text: buildSystemInstructions(methodologyVersion),
      cache_control: { type: "ephemeral" },
    },
  ];

  // P1 — best-effort enrichment: if the personalisation layer throws (DB down,
  // forbidden word in customInstructions, etc.) we log a warning and continue
  // with the single methodology block so the memo is never silently blocked.
  if (opts.userId !== undefined) {
    try {
      const [profile, memory] = await Promise.all([
        loadUserAgentProfile(opts.userId, "investor-memo"),
        loadUserMemory(opts.userId, "investor-memo"),
      ]);
      const ctxBlock = buildUserContextSystemBlock({ profile, memory });
      if (ctxBlock !== null) {
        systemBlocks.push(ctxBlock);
      }
    } catch (enrichErr) {
      logger.warn(
        "investor-memo: per-user enrichment failed — continuing with base methodology block",
        { userId: opts.userId },
        enrichErr instanceof Error ? enrichErr : undefined,
      );
    }
  }

  const validated = await runAgent("investor-memo", {
    model,
    system: systemBlocks,
    prompt: buildUserPrompt(input, methodologyVersion),
    client: opts.client,
    schema: InvestorMemoOutputSchema,
    maxTokens: 4096,
    timeoutMs: opts.timeoutMs ?? 180_000,
  });

  assertNoForbiddenWords(validated.executive_summary);
  assertNoForbiddenWords(validated.vault_structure);
  assertNoForbiddenWords(validated.scenario_analysis);
  assertNoForbiddenWords(validated.risk_section);
  assertNoForbiddenWords(validated.mining_section);
  assertNoForbiddenWords(validated.performance_section);
  assertNoForbiddenWords(validated.methodology_note);
  assertNoForbiddenWords(validated.disclaimer);

  // Non-negotiable #1: no section may quote a single-point APY (the disclaimer
  // is a verbatim legal template with no APY figure, so it is exempt — same as
  // the assumption check below).
  assertApyAlwaysRange(validated.executive_summary);
  assertApyAlwaysRange(validated.vault_structure);
  assertApyAlwaysRange(validated.scenario_analysis);
  assertApyAlwaysRange(validated.risk_section);
  assertApyAlwaysRange(validated.mining_section);
  assertApyAlwaysRange(validated.performance_section);
  assertApyAlwaysRange(validated.methodology_note);

  // Assumption citation checks: every narrative section must cite >=1
  // assumption (spec/09-agents.mdx: "Every section must reference at least
  // one assumption explicitly"). `disclaimer` is EXEMPTED because it is a
  // verbatim legal template (DISCLAIMER_NOT_GUARANTEED + DISCLAIMER_PROJECTION),
  // appended unchanged and not generated — it must not be rewritten to inject
  // an assumption.
  assertCitesAssumption(validated.executive_summary);
  assertCitesAssumption(validated.vault_structure);
  assertCitesAssumption(validated.scenario_analysis);
  assertCitesAssumption(validated.risk_section);
  assertCitesAssumption(validated.mining_section);
  assertCitesAssumption(validated.performance_section);
  assertCitesAssumption(validated.methodology_note);

  return validated;
}
