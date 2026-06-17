import "server-only";

import type { ProductWorkspaceIntentKind } from "@/lib/llm/product-workspace-intent";
import { logger } from "@/lib/logger";

/**
 * LLM-based product-intent classifier for the admin cockpit chat.
 *
 * Replaces the rigid keyword regex (classifyProductWorkspaceIntent) on the chat
 * path: instead of a ~25-word dictionary, a small model call decides whether an
 * admin message expresses an intent to CREATE or FRAME a product/vault — in any
 * phrasing, including indirect ones ("monte-moi un truc défensif", "j'aimerais
 * un nouveau véhicule BTC") — and extracts a normalized objective.
 *
 * Design:
 * - Single, cheap, NON-streaming JSON call (response_format json_object).
 * - FAIL-SAFE: any error / malformed output → { isProductIntent: false }. A
 *   classifier hiccup must never break the chat — it just falls back to a normal
 *   conversational answer (no workspace divert), which is the safe default.
 * - Client is a minimal structural type so tests inject a fake (no real spend).
 */

export interface ProductIntentClassification {
  isProductIntent: boolean;
  /** Creation vs framing vs mixed-with-simulation; "none" when not a product intent. */
  kind: ProductWorkspaceIntentKind;
  /** Normalized objective to seed the workspace, or undefined. */
  objective?: string;
  /** True when the message also asks to simulate/stress-test. */
  wantsSimulation: boolean;
}

const NOT_PRODUCT: ProductIntentClassification = {
  isProductIntent: false,
  kind: "none",
  wantsSimulation: false,
};

const MAX_OBJECTIVE_LEN = 220;
const CLASSIFY_TIMEOUT_MS = 8_000;
const CLASSIFY_MAX_TOKENS = 200;

const SYSTEM_PROMPT = [
  "Tu es un classificateur d'intention pour la console admin de Hearst Connect (plateforme DeFi institutionnelle, vaults USDC adossés au mining BTC).",
  "On te donne UN message admin. Décide s'il exprime l'intention de CRÉER ou de CADRER un produit/vault (un véhicule d'investissement), quelle que soit la formulation, même indirecte ou familière.",
  "",
  "Réponds STRICTEMENT en JSON, ce schéma exact:",
  '{ "isProductIntent": boolean, "kind": "product_creation" | "product_framing" | "explicit_simulation" | "mixed_product_creation_simulation" | "mixed_product_framing_simulation" | "none", "objective": string, "wantsSimulation": boolean }',
  "",
  "Règles:",
  "- isProductIntent=true si le message veut créer/lancer un nouveau produit/vault/offre, OU cadrer/modéliser/définir la thèse d'un produit. Sinon false.",
  "- kind: product_creation (créer/lancer), product_framing (cadrer/thèse/stratégie), explicit_simulation (UNIQUEMENT simuler/stresser, sans création), mixed_* si création/cadrage ET simulation, none si pas d'intention produit.",
  "- wantsSimulation=true si le message demande aussi de simuler / stress-tester / backtester.",
  "- objective: reformule l'objectif produit en une courte phrase (max 200 caractères). Si isProductIntent=false, objective=\"\".",
  "- Une simple question produit (ex: 'c'est quoi le vault Yield ?') N'EST PAS une intention de création → isProductIntent=false, kind=none.",
  "- Ne mets RIEN d'autre que le JSON.",
].join("\n");

/** Minimal structural client (subset of the OpenAI SDK) so tests inject a fake. */
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

function parseClassification(raw: string): ProductIntentClassification {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NOT_PRODUCT;
  }
  if (parsed === null || typeof parsed !== "object") return NOT_PRODUCT;
  const o = parsed as Record<string, unknown>;
  if (o.isProductIntent !== true) return NOT_PRODUCT;

  const kind =
    o.kind === "product_creation" ||
    o.kind === "product_framing" ||
    o.kind === "explicit_simulation" ||
    o.kind === "mixed_product_creation_simulation" ||
    o.kind === "mixed_product_framing_simulation"
      ? (o.kind as ProductWorkspaceIntentKind)
      : "product_creation";
  // A pure simulation is not a workspace (product) intent — guard against the
  // model mislabeling it as a product creation.
  if (kind === "explicit_simulation") return NOT_PRODUCT;

  const objectiveRaw = typeof o.objective === "string" ? o.objective.trim() : "";
  const objective =
    objectiveRaw.length > 0 ? objectiveRaw.slice(0, MAX_OBJECTIVE_LEN) : undefined;

  return {
    isProductIntent: true,
    kind,
    ...(objective ? { objective } : {}),
    wantsSimulation:
      o.wantsSimulation === true ||
      kind === "mixed_product_creation_simulation" ||
      kind === "mixed_product_framing_simulation",
  };
}

/**
 * Classify whether an admin message is a product creation/framing intent.
 * Never throws — on any failure it returns the safe "not a product intent"
 * result so the chat degrades to a normal conversational answer.
 */
export async function classifyProductIntentLlm(
  client: ClassifyClient,
  model: string,
  message: string,
): Promise<ProductIntentClassification> {
  const trimmed = message.trim();
  if (trimmed.length === 0) return NOT_PRODUCT;
  try {
    const completion = await client.chat.completions.create(
      {
        model,
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
    if (content.trim().length === 0) return NOT_PRODUCT;
    return parseClassification(content);
  } catch (err) {
    logger.warn(
      "product-intent classification failed — defaulting to not-a-product-intent",
      {},
      err instanceof Error ? err : undefined,
    );
    return NOT_PRODUCT;
  }
}
