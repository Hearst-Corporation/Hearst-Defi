/**
 * Master Outreach Agent — Orchestrateur unifié.
 *
 * Combine les trois couches de classification:
 * 1. Regex déterministe (haute confiance, rapide, déterministe)
 * 2. HuggingFace semantic (fallback pour intents ambigus)
 * 3. Unknown → no_action (jamais de navigation LLM-only)
 *
 * Contraintes absolues (non-négociables):
 * - sendAllowed est TOUJOURS false
 * - requiresUserReview est TOUJOURS true
 * - Unknown intent = no_action (pas de navigation)
 * - Regex a priorité sur HF
 * - HF ne bypass jamais les permissions
 *
 * Usage:
 *   const decision = await outreachMasterAgent.classify({ message, isAdmin });
 *   if (decision.action === "navigate") navigate(decision.route);
 *   if (decision.action === "open_canvas") openCanvas(decision.canvasKey);
 */

import type {
  OutreachAgentDecision,
  OutreachIntentContext,
  OutreachIntentClassifier,
} from "./outreach-master-types";
import { classifyOutreachIntentRegex } from "./outreach-master-regex";
import { classifyOutreachIntentSemantic, isSemanticClassificationAvailable } from "./outreach-master-semantic";
import { runOutreachSwarmIfNeeded } from "./swarms";

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Mode de l'agent: comment gérer les cas ambigus. */
type AgentMode = "deterministic_only" | "semantic_fallback" | "ask_clarification";

const AGENT_MODE: AgentMode = process.env.OUTREACH_MASTER_MODE as AgentMode || "semantic_fallback";

// ============================================================================
// MASTER AGENT CLASS
// ============================================================================

class OutreachMasterAgent implements OutreachIntentClassifier {
  /**
   * Classifie l'intent utilisateur selon la chaîne:
   * 1. Regex déterministe
   * 2. HF semantic (si mode l'autorise)
   * 3. Unknown → no_action
   * 4. Swarm orchestration (si intent = campaign/draft/follow-up)
   */
  async classify(ctx: OutreachIntentContext): Promise<OutreachAgentDecision> {
    const { message, isAdmin } = ctx;

    // --- ÉTAPE 0: Validation ---
    if (!message?.trim()) {
      return this.buildUnknownDecision("Message vide", "");
    }

    // --- ÉTAPE 1: Regex déterministe ---
    const regexDecision = classifyOutreachIntentRegex(ctx);
    if (regexDecision) {
      // Regex a matché (positif ou négatif)
      // Si c'est une action complexe, on peut enrichir avec le swarm
      return this.maybeEnrichWithSwarm(regexDecision, ctx);
    }

    // --- ÉTAPE 2: Semantic HF (si activé et disponible) ---
    if (AGENT_MODE === "semantic_fallback" && isSemanticClassificationAvailable()) {
      const semanticDecision = await classifyOutreachIntentSemantic(ctx);
      if (semanticDecision) {
        // HF a trouvé un intent avec bonne confiance
        return this.maybeEnrichWithSwarm(semanticDecision, ctx);
      }
    }

    // --- ÉTAPE 3: Mode ask_clarification → réponse demandant clarification ---
    if (AGENT_MODE === "ask_clarification") {
      return this.buildClarificationDecision(ctx);
    }

    // --- ÉTAPE 4: Default → no_action ---
    return this.buildUnknownDecision(
      "Intent Outreach non reconnu — aucune action entreprise",
      message,
    );
  }

  /**
   * Enrichit la décision avec le swarm si applicable.
   * Les swarms ne tournent que pour les intents complexes (campaign/draft/etc),
   * pas pour la simple navigation.
   */
  private maybeEnrichWithSwarm(
    decision: OutreachAgentDecision,
    ctx: OutreachIntentContext,
  ): OutreachAgentDecision {
    // Simple navigation doesn't need swarm
    if (decision.action === "navigate" || decision.intent === "open_outreach") {
      return decision;
    }

    // No-action doesn't need swarm
    if (decision.intent === "no_action") {
      return decision;
    }

    // Run swarm if this is a complex intent requiring preparation
    const swarmRun = runOutreachSwarmIfNeeded({
      message: ctx.message,
      intent: decision.intent,
      isAdmin: ctx.isAdmin,
      userId: "master-agent",
      recipientScope: decision.recipientsScope,
      campaignName: decision.entities?.campaignName,
      preferredChannel: decision.channel as "email" | "whatsapp" | "linkedin" | undefined,
    });

    if (swarmRun) {
      // Create summary version for decision (avoid deep circular deps)
      const swarmSummary = {
        runId: swarmRun.runId,
        status: swarmRun.status,
        specialistCount: swarmRun.outputs.length,
        safetyOk: swarmRun.safety.blockedReasons.length === 0,
      };

      return {
        ...decision,
        swarmRun: swarmSummary,
        // If swarm blocked, reflect that in the decision
        ...(swarmRun.status === "blocked"
          ? {
              safetyWarnings: [
                ...(decision.safetyWarnings || []),
                `Swarm blocked: ${swarmRun.safety.blockedReasons.join("; ")}`,
              ],
            }
          : {}),
      };
    }

    return decision;
  }

  /**
   * Version synchrone (pour les cas où on sait que c'est regex-only).
   * Lance une exception si un async serait nécessaire.
   */
  classifySync(ctx: OutreachIntentContext): OutreachAgentDecision {
    const { message } = ctx;

    if (!message?.trim()) {
      return this.buildUnknownDecision("Message vide", "");
    }

    const regexDecision = classifyOutreachIntentRegex(ctx);
    if (regexDecision) {
      return regexDecision;
    }

    // Si on arrive ici et que HF serait nécessaire, on retourne unknown
    return this.buildUnknownDecision(
      "Intent ambigu — classification semantic requise (utiliser classify() async)",
      message,
    );
  }

  // ============================================================================
  // BUILDERS
  // ============================================================================

  private buildUnknownDecision(reason: string, message: string): OutreachAgentDecision {
    const normalized = message
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return {
      intent: "no_action",
      source: "unknown",
      confidence: "low",
      action: "no_action",
      sendAllowed: false,
      requiresUserReview: true,
      reason,
      safetyWarnings: ["Intent inconnu — aucune action automatique"],
      normalizedInput: normalized,
    };
  }

  private buildClarificationDecision(ctx: OutreachIntentContext): OutreachAgentDecision {
    const normalized = ctx.message
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const isFrench = /\b(ouvre|va|créer|rédiger|campagn)\b/i.test(ctx.message);

    return {
      intent: "no_action",
      source: "unknown",
      confidence: "low",
      action: "answer_only",
      sendAllowed: false,
      requiresUserReview: true,
      reason: isFrench
        ? "Je ne suis pas sûr de comprendre ce que vous voulez faire. Voulez-vous: ouvrir l'espace outreach, créer une campagne, rédiger un email, ou relancer des prospects?"
        : "I'm not sure what you'd like to do. Would you like to: open the outreach workspace, create a campaign, draft an email, or follow up with leads?",
      safetyWarnings: ["Clarification demandée — intent ambigu"],
      normalizedInput: normalized,
    };
  }

  // ============================================================================
  // INTROSPECTION / DIAGNOSTICS
  // ============================================================================

  /**
   * Retourne la configuration de l'agent.
   */
  getConfig(): {
    mode: AgentMode;
    semanticAvailable: boolean;
    version: string;
  } {
    return {
      mode: AGENT_MODE,
      semanticAvailable: isSemanticClassificationAvailable(),
      version: "1.0.0",
    };
  }

  /**
   * Diagnostic: teste un message contre toutes les couches.
   */
  async diagnose(message: string, isAdmin: boolean): Promise<{
    regex: OutreachAgentDecision | null;
    semantic: OutreachAgentDecision | null;
    final: OutreachAgentDecision;
    latencyMs: number;
  }> {
    const start = performance.now();

    const ctx: OutreachIntentContext = { message, isAdmin };

    // Test regex
    const regex = classifyOutreachIntentRegex(ctx);

    // Test semantic
    let semantic: OutreachAgentDecision | null = null;
    if (isSemanticClassificationAvailable()) {
      semantic = await classifyOutreachIntentSemantic(ctx);
    }

    // Final decision
    const final = await this.classify(ctx);

    const latencyMs = Math.round(performance.now() - start);

    return { regex, semantic, final, latencyMs };
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const outreachMasterAgent = new OutreachMasterAgent();

/**
 * Convenience: classify a message (async).
 */
export async function classifyOutreachIntent(
  ctx: OutreachIntentContext,
): Promise<OutreachAgentDecision> {
  return outreachMasterAgent.classify(ctx);
}

/**
 * Convenience: classify a message (sync, regex-only).
 */
export function classifyOutreachIntentSync(
  ctx: OutreachIntentContext,
): OutreachAgentDecision {
  return outreachMasterAgent.classifySync(ctx);
}

/**
 * Re-export des types.
 */
export type {
  OutreachAgentDecision,
  OutreachIntentContext,
  OutreachIntent,
  OutreachActionType,
  OutreachChannel,
  OutreachConfidence,
  OutreachDecisionSource,
  OutreachEntityExtraction,
} from "./outreach-master-types";
