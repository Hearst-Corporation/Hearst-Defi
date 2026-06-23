import "server-only";

import type { CanvasId } from "@/lib/canvas/contract";
import { logger } from "@/lib/logger";

/**
 * Minimal structural client (subset of the OpenAI SDK) for LLM classifiers
 * that make small, non-streaming JSON calls. Injected by callers so classifiers
 * are testable with a fake (no real API spend in unit tests).
 *
 * Formerly in classify-product-intent.ts (deleted when the LLM classifier was
 * replaced by the deterministic classifyProductWorkspaceIntent). Kept here as
 * the shared type for classifyCanvasIntentLlm + extractOutreachFieldsLlm.
 */
export interface ClassifyClient {
  chat: {
    completions: {
      create(
        params: {
          model: string;
          messages: Array<{ role: string; content: string }>;
          max_tokens?: number;
          response_format?: { type: "json_object" };
        },
        options?: { timeout?: number },
      ): Promise<{ choices?: Array<{ message?: { content?: string | null } }> }>;
    };
  };
}

/**
 * LLM-based canvas-intent classifier for the admin cockpit chat.
 *
 * The agent-canvas was originally opened ONLY by a hidden marker ([[canvas:id]])
 * emitted by the empty-state preset chips — so a free-typed request ("fais une
 * campagne outreach") never opened the canvas; the agent just answered in the
 * chat and ran the tools inline. This classifier closes that gap: it detects, in
 * any phrasing, whether an admin message wants to OPEN a canvas workshop, and
 * which one — mirroring `classifyProductIntentLlm`.
 *
 * Scope (V1): OUTREACH only. Product/vault creation is already handled by the
 * deterministic regex classifier classifyProductWorkspaceIntent (→ product workspace);
 * routing that to the canvas instead is a separate product decision, so this stays
 * narrow on purpose.
 *
 * FAIL-SAFE: any error / malformed output → null (no canvas). A hiccup must never
 * break the chat — it degrades to a normal answer.
 */

const MAX_OBJECTIVE_LEN = 220;
const CLASSIFY_TIMEOUT_MS = 5_000;
const CLASSIFY_MAX_TOKENS = 120;
// Tiny JSON classification — fastest model, internal (not the route allowlist),
// fail-safe (any error → null).
const CLASSIFY_MODEL = "gpt-4.1-nano";

export interface CanvasIntentClassification {
  canvasId: CanvasId;
  objective?: string;
}

const SYSTEM_PROMPT = [
  "Tu es un classificateur d'intention pour la console admin de Hearst Connect (plateforme DeFi institutionnelle).",
  "On te donne UN message admin. Décide s'il exprime l'intention d'OUVRIR un atelier 'outreach' (prospection / campagne de leads distributeurs / sourcing / envoi d'emails de prospection), quelle que soit la formulation, même indirecte.",
  "",
  "Réponds STRICTEMENT en JSON, ce schéma exact:",
  '{ "isOutreachIntent": boolean, "objective": string }',
  "",
  "Règles:",
  "- isOutreachIntent=true si le message veut: lancer/préparer une campagne outreach, sourcer des leads/prospects distributeurs, rédiger ou envoyer des emails de prospection, gérer une campagne. Sinon false.",
  "- Une simple QUESTION sur l'outreach (ex: 'combien de prospects on a ?') N'EST PAS une intention d'atelier → false. (La lecture passe par les outils de lecture.)",
  "- objective: reformule l'objectif en une courte phrase (max 200 caractères). Si isOutreachIntent=false, objective=\"\".",
  "- Ne mets RIEN d'autre que le JSON.",
].join("\n");

function parse(raw: string): CanvasIntentClassification | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  if (o.isOutreachIntent !== true) return null;
  const objectiveRaw = typeof o.objective === "string" ? o.objective.trim() : "";
  const objective =
    objectiveRaw.length > 0 ? objectiveRaw.slice(0, MAX_OBJECTIVE_LEN) : undefined;
  return { canvasId: "outreach", ...(objective ? { objective } : {}) };
}

// ---------------------------------------------------------------------------
// Field extraction — when the operator dictates campaign values in chat
// ("appelle-la Distributeurs Q3, en cold"), pull them so the canvas fills.
// ---------------------------------------------------------------------------

const EXTRACT_SYSTEM_PROMPT = [
  "Tu extrais les paramètres d'une campagne outreach depuis UN message admin.",
  "Réponds STRICTEMENT en JSON, ce schéma exact:",
  '{ "name": string, "kind": "cold" | "newsletter" }',
  "Règles:",
  "- name: le nom de campagne si l'opérateur en donne un (ex: « appelle-la Distributeurs Q3 » → name=\"Distributeurs Q3\"), sinon \"\".",
  "- kind: \"newsletter\" si l'opérateur le précise, sinon \"cold\".",
  "- N'invente RIEN. Si aucun nom n'est donné, name=\"\".",
  "- Ne mets RIEN d'autre que le JSON.",
].join("\n");

export interface OutreachFieldValues {
  name?: string;
  kind?: "cold" | "newsletter";
}

/**
 * Extract outreach campaign field values from an admin message. Never throws —
 * any failure → {} (no fill). Only the fields actually present are returned.
 */
export async function extractOutreachFieldsLlm(
  client: ClassifyClient,
  _model: string,
  message: string,
): Promise<OutreachFieldValues> {
  const trimmed = message.trim();
  if (trimmed.length === 0) return {};
  try {
    const completion = await client.chat.completions.create(
      {
        model: CLASSIFY_MODEL,
        max_tokens: 80,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: EXTRACT_SYSTEM_PROMPT },
          { role: "user", content: trimmed },
        ],
      },
      { timeout: CLASSIFY_TIMEOUT_MS },
    );
    const content = completion.choices?.[0]?.message?.content ?? "";
    if (content.trim().length === 0) return {};
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const out: OutreachFieldValues = {};
    if (typeof parsed.name === "string" && parsed.name.trim().length > 0) {
      out.name = parsed.name.trim().slice(0, 160);
    }
    if (parsed.kind === "newsletter") out.kind = "newsletter";
    else if (parsed.kind === "cold") out.kind = "cold";
    return out;
  } catch {
    return {};
  }
}

/**
 * Classify whether an admin message wants to open a canvas workshop. Never
 * throws — on any failure returns null (no canvas), the safe default.
 */
export async function classifyCanvasIntentLlm(
  client: ClassifyClient,
  _model: string,
  message: string,
): Promise<CanvasIntentClassification | null> {
  const trimmed = message.trim();
  if (trimmed.length === 0) return null;
  try {
    const completion = await client.chat.completions.create(
      {
        model: CLASSIFY_MODEL,
        max_tokens: CLASSIFY_MAX_TOKENS,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: trimmed },
        ],
      },
      { timeout: CLASSIFY_TIMEOUT_MS },
    );
    const content = completion.choices?.[0]?.message?.content ?? "";
    if (content.trim().length === 0) return null;
    return parse(content);
  } catch (err) {
    logger.warn(
      "canvas-intent classification failed — defaulting to no-canvas",
      {},
      err instanceof Error ? err : undefined,
    );
    return null;
  }
}
