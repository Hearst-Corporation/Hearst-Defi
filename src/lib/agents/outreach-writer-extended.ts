/**
 * Outreach Writer Extended — WhatsApp and LinkedIn templates.
 *
 * Extension of outreach-writer.ts for short-form channels (WhatsApp, LinkedIn).
 * Same safety constraints: forbidden words, estimated target return as a range,
 * no guarantees, no periodic cash distribution / fixed APY (the product is a
 * BTC-accumulation mining note — see outreach-writer.ts BRAND_BLOCK).
 *
 * These drafts are SHORT by design (WhatsApp: ≤400 chars, LinkedIn: ≤1200 chars)
 * to respect channel norms and avoid TL;DR.
 */

import "server-only";

import { z } from "zod";
import { assertSendCopyCompliant } from "@/lib/outreach/send-compliance";
import { parseLlmJsonObject } from "@/lib/agents/parse-llm-json";
import { callLlm, type LlmClientLike } from "@/lib/llm/client";
import { LLM_MODEL } from "@/lib/llm/openai";
import { ensureCtaInBody } from "@/lib/outreach/cta-url";
import type { OutreachLanguage, OutreachAudience, ColdEmailProspect } from "./outreach-writer";

// Re-export for convenience
export type { OutreachLanguage, OutreachAudience, ColdEmailProspect };

const OUTREACH_WRITER_MODEL = LLM_MODEL;
const DEFAULT_TIMEOUT_MS = 45_000; // Shorter for short-form
/** Brand-anchored estimated-return range, always a fourchette (#1). */
const APY_RANGE_LABEL = "8-15%";

// ============================================================================
// WHATSAPP
// ============================================================================

/** WhatsApp draft is very short, no subject line. */
export const WhatsAppDraftSchema = z.object({
  body: z.string().trim().min(10).max(400, "WhatsApp must be concise"),
});

export type WhatsAppDraft = z.infer<typeof WhatsAppDraftSchema>;

export interface DraftWhatsAppInput {
  prospect: ColdEmailProspect;
  brief?: string | null;
  typeformUrl: string;
  language?: OutreachLanguage;
  audience?: OutreachAudience;
  /** If true, this is a follow-up to an earlier message */
  isFollowUp?: boolean;
}

export interface OutreachWriterOptions {
  client?: LlmClientLike;
  model?: string;
  timeoutMs?: number;
}

const BRAND_BLOCK_WHATSAPP = `About Hearst Connect:
- Single-vault institutional DeFi built around a mining note.
- A BTC-accumulation note backed by real bitcoin mining, three pouches: Mining Power 40% / BTC Pouch 27% / USDC Reserve 33%.
- It accumulates BTC over a 24-month term with rule-based take-profit; no periodic cash distribution, no fixed APY.
- Estimated target return is a RANGE of ${APY_RANGE_LABEL} — never a single point — in BTC accumulated, not distributed; an estimate, capital at risk.
- Structure: Cayman SPV, $250k minimum (contractual), 60-day soft lock (contractual, not on-chain). Audience: institutional/qualified.`;

const GUARDRAIL_BLOCK_WHATSAPP = `Hard rules:
- Output STRICT JSON only: {"body":"..."}
- NEVER use: guarantee, promise, certain, will deliver, risk-free, garanti, promesse, sans risque.
- Never describe a periodic cash distribution or a fixed/annual APY. BTC is accumulated over a 24-month term with rule-based take-profit, delivered at maturity.
- Estimated target return always as a range (e.g., "${APY_RANGE_LABEL}"). Never quote a single-point figure.
- Tone: warm, concise, institutional. No hype, no superlatives, no emojis.
- Keep it under 320 characters ideally (hard max 400).
- The CTA should be a single, short sentence with the link.`;

function buildWhatsAppSystem(
  language: OutreachLanguage,
  typeformUrl: string,
  audience: OutreachAudience,
  isFollowUp: boolean,
): string {
  const langRule =
    language === "fr"
      ? "Write in French. Professional but warm vouvoiement."
      : "Write in English. Professional, warm register.";

  const objective = isFollowUp
    ? `Objective: brief, polite follow-up to a prior outreach. Acknowledge they may be busy. Re-state the core value in ONE sentence. End with a soft CTA.`
    : `Objective: brief intro to the Hearst mining note. Open with context-appropriate greeting. One sentence on value. One sentence on structure (estimated target range, BTC accumulated over a 24-month term). Soft CTA with link.`;

  const cta = `The message MUST end with a clear CTA linking this short form: ${typeformUrl}`;

  return [
    "You are the WhatsApp Outreach Agent for Hearst Connect.",
    "",
    BRAND_BLOCK_WHATSAPP,
    "",
    langRule,
    "",
    objective,
    "",
    cta,
    "",
    GUARDRAIL_BLOCK_WHATSAPP,
    "",
    'Return ONLY: {"body":"..."}',
  ].join("\n");
}

function buildWhatsAppUserPrompt(input: DraftWhatsAppInput): string {
  const { prospect } = input;
  const brief = (input.brief ?? "").trim();
  const audience = input.audience ?? "subscriber";
  const isFollowUp = input.isFollowUp ?? false;

  const name =
    [prospect.firstName, prospect.lastName]
      .filter((p) => (p ?? "").trim().length > 0)
      .join(" ") || "Prospect";

  return [
    isFollowUp ? "Follow-up WhatsApp for:" : "New WhatsApp intro for:",
    `  Name: ${name}`,
    `  Company: ${(prospect.company ?? "").trim() || "(not provided)"}`,
    `  Title: ${(prospect.title ?? "").trim() || "(not provided)"}`,
    `  Audience type: ${audience}`,
    "",
    "Angle / brief (may be empty):",
    brief.length > 0 ? brief : "  (none — use standard institutional pitch)",
    "",
    `Link to include: ${input.typeformUrl}`,
    "",
    "Keep it under 320 chars. Return only JSON.",
  ].join("\n");
}

function parseAndGuardWhatsApp(text: string): WhatsAppDraft {
  const parsed = parseLlmJsonObject(text, "WhatsApp agent");
  const result = WhatsAppDraftSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`WhatsApp agent invalid: ${JSON.stringify(result.error.issues)}`);
  }
  const draft = result.data;
  // Forbidden words (#5) + APY always a range (#1) — shared send-copy gate.
  assertSendCopyCompliant(draft.body);
  // Ensure CTA link is present
  return { body: ensureCtaInBody(draft.body, "[CTA link]") };
}

// ============================================================================
// LINKEDIN
// ============================================================================

/** LinkedIn draft: short professional note, no subject. */
export const LinkedInDraftSchema = z.object({
  body: z.string().trim().min(20).max(1200, "LinkedIn note should be concise"),
});

export type LinkedInDraft = z.infer<typeof LinkedInDraftSchema>;

export interface DraftLinkedInInput {
  prospect: ColdEmailProspect;
  brief?: string | null;
  typeformUrl: string;
  language?: OutreachLanguage;
  audience?: OutreachAudience;
  /** If true, connection request style; if false, InMail/message style */
  isConnectionRequest?: boolean;
}

const BRAND_BLOCK_LINKEDIN = `About Hearst Connect:
- Institutional DeFi platform built around a mining note.
- A BTC-accumulation note backed by real bitcoin mining, three pouches: Mining Power 40% / BTC Pouch 27% / USDC Reserve 33%.
- Accumulates BTC over a 24-month term with rule-based take-profit; no periodic cash distribution, no fixed APY.
- Estimated target return: ${APY_RANGE_LABEL} (always a range, never a point), in BTC accumulated, not distributed; an estimate, capital at risk.
- Cayman SPV, $250k min (contractual), 60-day soft lock (contractual, not on-chain). Audience: institutional/qualified investors.`;

const GUARDRAIL_BLOCK_LINKEDIN = `Hard rules:
- Output STRICT JSON only: {"body":"..."}
- NEVER use: guarantee, promise, certain, will deliver, risk-free, garanti, promesse, sans risque.
- Never describe a periodic cash distribution or a fixed/annual APY. BTC is accumulated over a 24-month term with rule-based take-profit, delivered at maturity.
- Estimated target return always as a range. Never single-point.
- Tone: professional, institutional, warm but not salesy. No emojis.
- Keep under 1000 characters ideally (hard max 1200).
- End with one clear CTA sentence containing the link.`;

function buildLinkedInSystem(
  language: OutreachLanguage,
  typeformUrl: string,
  audience: OutreachAudience,
  isConnectionRequest: boolean,
): string {
  const langRule =
    language === "fr"
      ? "Write in French. Professional, warm vouvoiement."
      : "Write in English. Professional, warm register.";

  const objective = isConnectionRequest
    ? `Objective: short connection request note. 2-3 sentences max. Mention why connecting (shared interest in institutional BTC-accumulation / mining-backed products). Soft CTA with link. Keep under 300 chars.`
    : `Objective: brief LinkedIn InMail/message. Paragraph 1: context/why reaching out. Paragraph 2: one-line value prop (estimated target range, mining note structure). Paragraph 3: soft CTA with link.`;

  const cta = `The message MUST end with a CTA linking this form: ${typeformUrl}`;

  return [
    "You are the LinkedIn Outreach Agent for Hearst Connect.",
    "",
    BRAND_BLOCK_LINKEDIN,
    "",
    langRule,
    "",
    objective,
    "",
    cta,
    "",
    GUARDRAIL_BLOCK_LINKEDIN,
    "",
    'Return ONLY: {"body":"..."}',
  ].join("\n");
}

function buildLinkedInUserPrompt(input: DraftLinkedInInput): string {
  const { prospect } = input;
  const brief = (input.brief ?? "").trim();
  const audience = input.audience ?? "subscriber";
  const isConnectionRequest = input.isConnectionRequest ?? false;

  const name =
    [prospect.firstName, prospect.lastName]
      .filter((p) => (p ?? "").trim().length > 0)
      .join(" ") || "Prospect";

  return [
    isConnectionRequest ? "LinkedIn connection request note for:" : "LinkedIn message for:",
    `  Name: ${name}`,
    `  Company: ${(prospect.company ?? "").trim() || "(not provided)"}`,
    `  Title: ${(prospect.title ?? "").trim() || "(not provided)"}`,
    `  Audience type: ${audience}`,
    "",
    "Angle / brief (may be empty):",
    brief.length > 0 ? brief : "  (none — use standard pitch)",
    "",
    `Link to include: ${input.typeformUrl}`,
    "",
    isConnectionRequest ? "Keep under 300 chars. Return only JSON." : "Keep under 1000 chars. Return only JSON.",
  ].join("\n");
}

function parseAndGuardLinkedIn(text: string): LinkedInDraft {
  const parsed = parseLlmJsonObject(text, "LinkedIn agent");
  const result = LinkedInDraftSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`LinkedIn agent invalid: ${JSON.stringify(result.error.issues)}`);
  }
  const draft = result.data;
  // Forbidden words (#5) + APY always a range (#1) — shared send-copy gate.
  assertSendCopyCompliant(draft.body);
  return { body: ensureCtaInBody(draft.body, "[CTA link]") };
}

// ============================================================================
// FOLLOW-UP TEMPLATES (Deterministic, no LLM)
// ============================================================================

/**
 * Deterministic follow-up templates for email.
 * These are safe, fast, and require no LLM call.
 */
export function buildEmailFollowUpTemplate(
  prospectName: string,
  originalSubject: string,
  daysSince: number,
  language: OutreachLanguage = "en",
): { subject: string; body: string } {
  if (language === "fr") {
    return {
      subject: `RE: ${originalSubject}`,
      body:
        daysSince < 3
          ? `Bonjour ${prospectName},\n\nJe me permets de relancer suite à mon précédent message concernant le Hearst Yield Vault.\n\nJe sais que votre temps est précieux — pourriez-vous m'indiquer si cette note de mining (rendement cible estimé ${APY_RANGE_LABEL} en BTC accumulé sur un terme de 24 mois, non distribué ; estimation, capital à risque) correspond à votre recherche actuelle ?\n\nBien cordialement,\nHearst Connect`
          : `Bonjour ${prospectName},\n\nJe reviens vers vous concernant le Hearst Yield Vault.\n\nNous travaillons avec des family offices et gestionnaires de patrimoine sur des produits DeFi institutionnels structurés. Notre note de mining accumule du BTC sur un terme de 24 mois avec des prises de profit déclenchées par règles, pour une fourchette de rendement cible estimé ${APY_RANGE_LABEL} (en BTC accumulé, non distribué ; estimation, capital à risque).\n\nSeriez-vous ouvert à un bref échange pour voir si cela pourrait intéresser certains de vos clients ?\n\nCordialement,\nHearst Connect`,
    };
  }

  return {
    subject: `RE: ${originalSubject}`,
    body:
      daysSince < 3
        ? `Hi ${prospectName},\n\nQuick follow-up on my previous note about the Hearst Yield Vault.\n\nI know your time is valuable — could you let me know if this structured mining note (estimated target ${APY_RANGE_LABEL} in BTC accumulated over a 24-month term, not distributed; an estimate, capital at risk) aligns with what you're currently looking for?\n\nBest,\nHearst Connect`
        : `Hi ${prospectName},\n\nFollowing up on the Hearst Yield Vault.\n\nWe work with family offices and wealth managers on institutional DeFi structured products. Our mining-backed note accumulates BTC over a 24-month term with rule-based take-profit, with an estimated target return range of ${APY_RANGE_LABEL} (in BTC accumulated, not distributed; an estimate, capital at risk).\n\nWould you be open to a brief call to explore whether this might fit some of your clients?\n\nBest regards,\nHearst Connect`,
  };
}

/**
 * Deterministic WhatsApp follow-up templates.
 */
export function buildWhatsAppFollowUpTemplate(
  prospectName: string,
  daysSince: number,
  language: OutreachLanguage = "en",
): string {
  if (language === "fr") {
    return daysSince < 3
      ? `Bonjour ${prospectName}, petit relance sur le Hearst Yield Vault (rendement cible estimé ${APY_RANGE_LABEL}, BTC accumulé, capital à risque). Ça vous parle ? Le formulaire est ici si vous voulez voir les détails.`
      : `Bonjour ${prospectName}, je reviens vers vous sur le Hearst Yield Vault (rendement cible estimé ${APY_RANGE_LABEL}). Note de mining : accumulation de BTC sur 24 mois, prises de profit par règles. Intéressé pour en discuter ?`;
  }

  return daysSince < 3
    ? `Hi ${prospectName}, quick follow-up on Hearst Yield Vault (estimated target ${APY_RANGE_LABEL}, BTC accumulated over 24 months, capital at risk). Does this resonate? Link here if you want details.`
    : `Hi ${prospectName}, following up on Hearst Yield Vault (estimated target ${APY_RANGE_LABEL}, in BTC accumulated). Mining note: BTC accumulation over a 24-month term, rule-based take-profit. Interested to discuss?`;
}

/**
 * Campaign brief template (deterministic, for canvas display).
 */
export function buildCampaignBriefTemplate(
  campaignName: string,
  channel: "email" | "whatsapp" | "linkedin",
  recipientCount: number,
  language: OutreachLanguage = "en",
): string {
  const channelLabel =
    channel === "email" ? "Email campaign" : channel === "whatsapp" ? "WhatsApp outreach" : "LinkedIn outreach";

  if (language === "fr") {
    return `${channelLabel}: "${campaignName}"\nCible: ${recipientCount} prospects institutionnels\nRendement cible estimé: ${APY_RANGE_LABEL} (BTC accumulé, non distribué)\nStructure: note de mining, terme 24 mois, prises de profit par règles\nPoches: Mining 40% / BTC 27% / Réserve USDC 33%\nTicket min: $250k (contractuel)\n\nÉtapes:\n1. Review destinataires\n2. Validation des drafts\n3. Envoi en HITL (pas d'envoi auto)`;
  }

  return `${channelLabel}: "${campaignName}"\nTarget: ${recipientCount} institutional prospects\nEstimated target return: ${APY_RANGE_LABEL} (BTC accumulated, not distributed)\nStructure: mining note, 24-month term, rule-based take-profit\nPouches: Mining 40% / BTC 27% / USDC Reserve 33%\nMin ticket: $250k (contractual)\n\nSteps:\n1. Review recipients\n2. Draft validation\n3. HITL send (no auto-send)`;
}
