import "server-only";

import { z } from "zod";

import { renderAgentMemoryBlock } from "@/lib/agents/memory";
import { assertNoForbiddenWords } from "@/lib/agents/validators";
import { parseLlmJsonObject } from "@/lib/agents/parse-llm-json";
import { callLlm, type LlmClientLike } from "@/lib/llm/client";
import { LLM_MODEL } from "@/lib/llm/openai";

/**
 * Email-outreach agent — drafts cold prospecting emails and personalised
 * newsletters for Hearst Connect. Runs on OpenAI GPT-4.1 (ADR-011), the single
 * provider used across every agent.
 *
 * Both entry points return a `{ subject, body }` draft. Hard guardrails apply
 * to every generated string before it is returned to the caller:
 *  - STRICT JSON-only contract in the system prompt (defensive fence-stripping
 *    parse on the way out).
 *  - `assertNoForbiddenWords` on subject + body (CLAUDE.md non-negotiable #5).
 *  - APY is only ever surfaced as a range, never a single point (#1); the
 *    prompt forbids fabricated numbers entirely.
 */

/** Logical model id recorded on `LlmRun.model` — mirrors `OPENAI_MODEL` (ADR-011). */
export const OUTREACH_WRITER_MODEL = LLM_MODEL;

/** Default timeout for an outreach draft. Short copy; 60s is generous. */
const DEFAULT_TIMEOUT_MS = 60_000;

/** Brand-anchored APY range, always expressed as a fourchette (#1). */
const APY_RANGE_LABEL = "8-15%";

/** Validated shape of a drafted email. Exported for callers + tests. */
export const OutreachDraftSchema = z.object({
  subject: z.string().trim().min(1, "subject must not be empty"),
  body: z.string().trim().min(1, "body must not be empty"),
});

export type OutreachDraft = z.infer<typeof OutreachDraftSchema>;

export type OutreachLanguage = "fr" | "en";

/**
 * Who the cold email addresses, which flips the whole pitch:
 *  - `subscriber` — a qualified investor who would invest in the vault directly.
 *  - `distributor` — a wealth manager / RIA / family office / IFA / platform who
 *    would DISTRIBUTE the vault to THEIR OWN clients. The angle is a distribution
 *    partnership (economics of placing a structured-yield product for their book),
 *    never "invest your own money". Default: `subscriber` (back-compatible).
 */
export type OutreachAudience = "subscriber" | "distributor";

export interface ColdEmailProspect {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  title?: string | null;
}

export interface DraftColdEmailInput {
  prospect: ColdEmailProspect;
  brief?: string | null;
  typeformUrl: string;
  language?: OutreachLanguage;
  /** Pitch framing. Default `subscriber` keeps the original behaviour. */
  audience?: OutreachAudience;
}

export interface DraftNewsletterInput {
  userId: string;
  brief?: string | null;
  language?: OutreachLanguage;
}

/** Optional injected dependencies — tests pass a mock LLM client. */
export interface OutreachWriterOptions {
  /** Injected LLM client (test mock). When absent, the real OpenAI client is used. */
  client?: LlmClientLike;
  /** Override the logical model id recorded on `LlmRun`. Default: `LLM_MODEL`. */
  model?: string;
  /** Timeout in ms for the LLM call. Default: 60_000. */
  timeoutMs?: number;
}

/* --------------------------------------------------------------------------
 * Shared brand + guardrail rules injected into every system prompt.
 * ------------------------------------------------------------------------ */

function languageRule(language: OutreachLanguage): string {
  return language === "fr"
    ? "Write ALL output (subject and body) in French. Use a vouvoiement, institutional register."
    : "Write ALL output (subject and body) in English. Use an institutional, professional register.";
}

const BRAND_BLOCK = `About Hearst Connect (use this framing, do not embellish):
- Hearst Connect is a single-vault institutional DeFi platform: the Hearst Yield Vault.
- It offers mining-backed structured yield with monthly USDC distributions.
- Target APY is a RANGE of ${APY_RANGE_LABEL} — always written as a range, never a single point.
- Structure: Cayman SPV, $250k minimum ticket, 60-day soft lock-up. Audience: institutional / qualified investors.`;

const GUARDRAIL_BLOCK = `Hard rules — apply all, without exception:
- Output STRICT JSON only. No prose, no markdown fences, no commentary outside the JSON object.
- The JSON object has EXACTLY two string keys: "subject" and "body". No other keys.
- NEVER use the words (or their inflections / French equivalents): guarantee, promise, certain, will deliver, risk-free, no risk, garanti, promesse, certain, sans risque. Never imply any return is assured.
- APY is ALWAYS a range (e.g. "${APY_RANGE_LABEL}"). NEVER quote a single-point APY.
- Do NOT fabricate numbers, figures, performance, client names, or statistics. Only use facts given to you. When in doubt, stay qualitative.
- Tone: warm but concise, institutional, factual. No hype, no superlatives, no emojis.
- Keep the body tight: a short greeting, 2-3 short paragraphs, then the call to action.`;

/**
 * Audience-specific objective block. `subscriber` keeps the original "invite the
 * prospect to qualify themselves" framing; `distributor` reframes the entire
 * email as a distribution-partnership opener (the recipient places the vault for
 * THEIR clients) — no "invest your own money", the form qualifies a partnership.
 */
function coldEmailObjective(
  audience: OutreachAudience,
  typeformUrl: string,
): string {
  if (audience === "distributor") {
    return `Recipient is a DISTRIBUTOR — a wealth manager, RIA, family office, IFA, or platform who could offer the Hearst Yield Vault to THEIR OWN clients. This is a partnership opener, NOT a request for them to invest personally.

Objective: open a credible first contact about a distribution partnership. Frame the value for THEIR book of business: a structured, mining-backed monthly-USDC-yield product they can offer qualified clients, with institutional structure (Cayman SPV) and a clear minimum. Acknowledge they vet products carefully; position this as worth a look for their mandate, not a hard sell. Do NOT imply they invest their own capital. The email MUST end with a single clear call to action linking to this short partnership-qualification form: ${typeformUrl}
- Embed the URL verbatim (do not shorten, wrap, or alter it).
- The CTA frames the form as a quick way to explore whether a distribution fit exists.`;
  }
  return `Recipient is a qualified INSTITUTIONAL INVESTOR who could allocate to the vault directly.

Objective: open a warm, credible first contact and invite the prospect to qualify themselves via a short form. The email MUST end with a single clear call to action linking to this qualification form: ${typeformUrl}
- Embed the URL verbatim (do not shorten, wrap, or alter it).
- The CTA should frame the form as a quick way to see whether the vault fits their mandate — not a hard sell.`;
}

function buildColdEmailSystem(
  language: OutreachLanguage,
  typeformUrl: string,
  audience: OutreachAudience,
): string {
  return `You are the Email Outreach Agent for Hearst Connect. You write a single B2B cold-outreach email to a qualified institutional prospect.

${BRAND_BLOCK}

${languageRule(language)}

${coldEmailObjective(audience, typeformUrl)}

${GUARDRAIL_BLOCK}
- "subject" must be a single concise line (no newlines).
- "body" is plain text with line breaks between paragraphs. End with the CTA containing the form URL.

Return ONLY this JSON object (no fences):
{"subject":"...","body":"..."}`;
}

function buildNewsletterSystem(language: OutreachLanguage): string {
  return `You are the Newsletter Agent for Hearst Connect. You write a short, personalised newsletter to an existing client / logged-in user.

${BRAND_BLOCK}

${languageRule(language)}

Objective: keep the client warm and informed with an on-brand, low-pressure update. The CTA is SOFT: gently encourage the client to log back into their cockpit to review their portfolio and the latest figures. This is NOT a hard sell — do not push a new investment.

${GUARDRAIL_BLOCK}
- "subject" must be a single concise line (no newlines).
- "body" is plain text with line breaks between paragraphs. End with a gentle invitation to log into the cockpit.
- If durable facts about the client are provided, weave them in naturally to personalise the message. If none are provided, write a generic but on-brand newsletter.

Return ONLY this JSON object (no fences):
{"subject":"...","body":"..."}`;
}

/* --------------------------------------------------------------------------
 * User-message builders.
 * ------------------------------------------------------------------------ */

function prospectDisplayName(prospect: ColdEmailProspect): string {
  const parts = [prospect.firstName, prospect.lastName]
    .map((p) => (p ?? "").trim())
    .filter((p) => p.length > 0);
  return parts.length > 0 ? parts.join(" ") : "(unknown — use a neutral salutation)";
}

function buildColdEmailUserPrompt(input: DraftColdEmailInput): string {
  const { prospect } = input;
  const brief = (input.brief ?? "").trim();
  const audience = input.audience ?? "subscriber";
  const audienceLine =
    audience === "distributor"
      ? "Audience: DISTRIBUTOR — pitch a distribution partnership (they place the vault for their clients), never a personal investment."
      : "Audience: direct institutional investor.";
  return [
    "Draft a cold-outreach email for this prospect:",
    `  name: ${prospectDisplayName(prospect)}`,
    `  email: ${prospect.email}`,
    `  company: ${(prospect.company ?? "").trim() || "(not provided)"}`,
    `  title: ${(prospect.title ?? "").trim() || "(not provided)"}`,
    "",
    audienceLine,
    "",
    "Brief / angle to use (may be empty — fall back to the standard Hearst pitch):",
    brief.length > 0 ? brief : "  (none — use the standard institutional Hearst pitch)",
    "",
    `The closing CTA must link the qualification form: ${input.typeformUrl}`,
    "",
    'Return ONLY the JSON object {"subject":"...","body":"..."}.',
  ].join("\n");
}

function buildNewsletterUserPrompt(input: DraftNewsletterInput, memoryBlock: string): string {
  const brief = (input.brief ?? "").trim();
  return [
    "Draft a personalised newsletter for this client.",
    "",
    "Durable facts known about this client (use to personalise; may be empty):",
    memoryBlock.length > 0 ? memoryBlock : "  (none on file — write a generic but on-brand newsletter)",
    "",
    "Editorial brief / theme for this issue (may be empty):",
    brief.length > 0 ? brief : "  (none — write a calm, on-brand check-in)",
    "",
    "The CTA must gently invite the client to log back into their cockpit. Do not hard-sell.",
    "",
    'Return ONLY the JSON object {"subject":"...","body":"..."}.',
  ].join("\n");
}

/* --------------------------------------------------------------------------
 * Defensive JSON parse + guardrail application.
 * ------------------------------------------------------------------------ */

function parseAndGuard(text: string): OutreachDraft {
  const parsed = parseLlmJsonObject(text, "Outreach agent");
  const result = OutreachDraftSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Outreach agent returned invalid output: ${JSON.stringify(result.error.issues)}`,
    );
  }
  const draft = result.data;
  // Non-negotiable #5: forbidden-word linter on every surfaced string.
  assertNoForbiddenWords(draft.subject);
  assertNoForbiddenWords(draft.body);
  return draft;
}

/* --------------------------------------------------------------------------
 * Public API.
 * ------------------------------------------------------------------------ */

/**
 * Drafts a single institutional cold-outreach email for a prospect. The email
 * always closes with a CTA linking the qualification Typeform.
 */
export async function draftColdEmail(
  input: DraftColdEmailInput,
  opts: OutreachWriterOptions = {},
): Promise<OutreachDraft> {
  const language: OutreachLanguage = input.language ?? "en";
  const audience: OutreachAudience = input.audience ?? "subscriber";
  const model = opts.model ?? OUTREACH_WRITER_MODEL;

  const { response } = await callLlm(
    "email-outreach",
    {
      model,
      max_tokens: 1024,
      system: buildColdEmailSystem(language, input.typeformUrl, audience),
      messages: [{ role: "user", content: buildColdEmailUserPrompt(input) }],
    },
    { client: opts.client, timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS },
  );

  const text = response.content.find((b) => b.type === "text")?.text ?? "";
  if (text.length === 0) {
    throw new Error("Outreach agent (cold email) returned no text block.");
  }
  return parseAndGuard(text);
}

/**
 * Drafts a personalised newsletter for an existing client. The client's durable
 * facts (`renderAgentMemoryBlock`) are injected so the copy is personalised;
 * when no facts exist, a generic on-brand newsletter is produced. The CTA only
 * encourages logging back into the cockpit — never a hard sell.
 */
export async function draftNewsletter(
  input: DraftNewsletterInput,
  opts: OutreachWriterOptions = {},
): Promise<OutreachDraft> {
  const language: OutreachLanguage = input.language ?? "en";
  const model = opts.model ?? OUTREACH_WRITER_MODEL;

  const memoryBlock = await renderAgentMemoryBlock(input.userId);

  const { response } = await callLlm(
    "email-outreach",
    {
      model,
      max_tokens: 1024,
      system: buildNewsletterSystem(language),
      messages: [
        { role: "user", content: buildNewsletterUserPrompt(input, memoryBlock) },
      ],
    },
    { client: opts.client, timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS },
  );

  const text = response.content.find((b) => b.type === "text")?.text ?? "";
  if (text.length === 0) {
    throw new Error("Outreach agent (newsletter) returned no text block.");
  }
  return parseAndGuard(text);
}
