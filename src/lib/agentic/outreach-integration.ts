/**
 * Outreach Master Agent — Integration into cockpit-chat route.
 *
 * Cette couche d'intégration connecte l'Outreach Master Agent au flux existant
 * du cockpit-chat sans modifier la logique core du routeur.
 *
 * Design:
 * - Appelé APRÈS classifyAgenticIntent (pas de conflit)
 * - Shadow mode HF: log seulement, ne remplace pas la décision regex
 * - Retourne des métadonnées pour action cards Outreach
 * - Pas de navigation LLM-only (respecte les invariants)
 *
 * Safety:
 * - sendAllowed toujours false
 * - requiresUserReview toujours true
 * - Non-admin: navigation seulement
 * - Product workspace nav non affectée
 */

import {
  outreachMasterAgent,
  classifyOutreachIntentSync,
  type OutreachAgentDecision,
  type OutreachIntentContext,
} from "@/lib/agents/outreach-master-agent";
import { classifyOutreachIntentRegex } from "@/lib/agents/outreach-master-regex";
import { classifyOutreachIntentSemantic, isSemanticClassificationAvailable } from "@/lib/agents/outreach-master-semantic";
import { generateSafetyReport, type SafetyReport } from "@/lib/agents/outreach-master-safety";
import type { AgenticIntentDecision } from "./intent-router-types";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Résultat de l'intégration Outreach — enrichi la réponse chat.
 */
export interface OutreachIntegrationResult {
  /** Décision Outreach (null si pas d'intent outreach détecté) */
  outreachDecision: OutreachAgentDecision | null;

  /** Rapport de sécurité (null si pas de décision) */
  safetyReport: SafetyReport | null;

  /** Mode HF actif */
  semanticAvailable: boolean;

  /** Diagnostics pour calibration (shadow mode) */
  diagnostics: {
    regexDecision: OutreachAgentDecision | null;
    semanticDecision: OutreachAgentDecision | null;
    semanticScore?: number;
    latencyMs: number;
  };
}

/**
 * Contexte pour l'intégration (étend le contexte existant).
 */
export interface OutreachIntegrationContext {
  message: string;
  isAdmin: boolean;
  userId: string;
  chatId?: string;
  /** Décision existante du router (pour éviter conflits) */
  existingDecision?: AgenticIntentDecision;
}

// ============================================================================
// SHADOW MODE / CALIBRATION
// ============================================================================

/**
 * Mode shadow: calcule HF pour calibration mais utilise regex comme source de vérité.
 *
 * Si regex a déjà une décision positive → on la garde, HF est shadow only.
 * Si regex retourne null → on permet à HF de proposer (si score >= 0.85).
 * Si HF aussi null → no_action.
 */
async function classifyWithShadowMode(
  ctx: OutreachIntentContext,
): Promise<{
  final: OutreachAgentDecision | null;
  regex: OutreachAgentDecision | null;
  semantic: OutreachAgentDecision | null;
  semanticScore?: number;
  latencyMs: number;
}> {
  const start = performance.now();

  // 1. Regex toujours first
  const regexDecision = classifyOutreachIntentRegex(ctx);

  // 2. HF semantic si disponible (pour shadow/calibration)
  let semanticDecision: OutreachAgentDecision | null = null;
  let semanticScore: number | undefined;

  if (isSemanticClassificationAvailable()) {
    try {
      const semantic = await classifyOutreachIntentSemantic(ctx);
      if (semantic) {
        semanticDecision = semantic;
        semanticScore = semantic.semanticScore;
      }
    } catch {
      // Fail-open: erreur HF n'empêche pas le regex de fonctionner
    }
  }

  const latencyMs = Math.round(performance.now() - start);

  // 3. Décision finale
  // Priorité: regex > semantic (si regex null et semantic confiant)
  // Shadow mode: si les deux ont une opinion, on log la divergence pour calibration
  let final: OutreachAgentDecision | null = null;

  if (regexDecision) {
    // Regex a décidé → c'est la source de vérité
    final = regexDecision;
  } else if (semanticDecision && (semanticScore ?? 0) >= 0.85) {
    // Regex n'a pas match, mais HF est confiant → fallback autorisé
    final = semanticDecision;
  }

  return {
    final,
    regex: regexDecision,
    semantic: semanticDecision,
    semanticScore,
    latencyMs,
  };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Intègre l'Outreach Master Agent dans le flux cockpit-chat.
 *
 * Cette fonction est appelée APRÈS classifyAgenticIntent et ne remplace
 * pas sa décision. Elle enrichi avec des métadonnées Outreach si applicable.
 *
 * @param ctx Contexte d'intégration
 * @returns Résultat enrichi (ou null si pas d'intent Outreach)
 */
export async function integrateOutreachAgent(
  ctx: OutreachIntegrationContext,
): Promise<OutreachIntegrationResult> {
  const { message, isAdmin, existingDecision } = ctx;

  // Éviter les conflits avec les décisions existantes fortes
  // Si le router a déjà décidé d'une action non-nav, on ne l'override pas
  if (existingDecision) {
    const conflictingKinds = [
      "deploy_request",
      "send_request",
      "source_request",
      "outreach_draft",
      "outreach_setup",
      "product_draft",
    ];
    if (
      conflictingKinds.includes(existingDecision.kind) &&
      existingDecision.confidence >= 0.8
    ) {
      // Le router a déjà une décision forte, on ne la remplace pas
      return {
        outreachDecision: null,
        safetyReport: null,
        semanticAvailable: isSemanticClassificationAvailable(),
        diagnostics: {
          regexDecision: null,
          semanticDecision: null,
          latencyMs: 0,
        },
      };
    }
  }

  // Construire le contexte Outreach
  const outreachCtx: OutreachIntentContext = {
    message,
    isAdmin,
  };

  // Classification avec shadow mode
  const classification = await classifyWithShadowMode(outreachCtx);

  // Si aucune décision Outreach → retourner null
  if (!classification.final) {
    return {
      outreachDecision: null,
      safetyReport: null,
      semanticAvailable: isSemanticClassificationAvailable(),
      diagnostics: {
        regexDecision: classification.regex,
        semanticDecision: classification.semantic,
        semanticScore: classification.semanticScore,
        latencyMs: classification.latencyMs,
      },
    };
  }

  // Générer le rapport de sécurité
  const safetyReport = generateSafetyReport(classification.final, {
    isAdmin,
  });

  return {
    outreachDecision: classification.final,
    safetyReport,
    semanticAvailable: isSemanticClassificationAvailable(),
    diagnostics: {
      regexDecision: classification.regex,
      semanticDecision: classification.semantic,
      semanticScore: classification.semanticScore,
      latencyMs: classification.latencyMs,
    },
  };
}

/**
 * Version synchrone pour les cas où l'async n'est pas possible.
 * Utilise UNIQUEMENT le regex (pas de HF).
 */
export function integrateOutreachAgentSync(
  ctx: OutreachIntegrationContext,
): OutreachIntegrationResult {
  const { message, isAdmin, existingDecision } = ctx;

  // Éviter les conflits
  if (existingDecision) {
    const conflictingKinds = [
      "deploy_request",
      "send_request",
      "source_request",
    ];
    if (
      conflictingKinds.includes(existingDecision.kind) &&
      existingDecision.confidence >= 0.8
    ) {
      return {
        outreachDecision: null,
        safetyReport: null,
        semanticAvailable: false,
        diagnostics: {
          regexDecision: null,
          semanticDecision: null,
          latencyMs: 0,
        },
      };
    }
  }

  const start = performance.now();

  const outreachCtx: OutreachIntentContext = {
    message,
    isAdmin,
  };

  // Regex only (sync)
  const regexDecision = classifyOutreachIntentSync(outreachCtx);
  const latencyMs = Math.round(performance.now() - start);

  // Si regex retourne un intent Outreach positif
  if (regexDecision.intent !== "no_action") {
    const safetyReport = generateSafetyReport(regexDecision, { isAdmin });
    return {
      outreachDecision: regexDecision,
      safetyReport,
      semanticAvailable: false,
      diagnostics: {
        regexDecision,
        semanticDecision: null,
        latencyMs,
      },
    };
  }

  // Pas d'intent Outreach détecté
  return {
    outreachDecision: null,
    safetyReport: null,
    semanticAvailable: false,
    diagnostics: {
      regexDecision,
      semanticDecision: null,
      latencyMs,
    },
  };
}

// ============================================================================
// NAVIGATION HELPERS
// ============================================================================

/**
 * Détermine si l'intent Outreach doit déclencher une navigation.
 */
export function shouldNavigateOutreach(
  decision: OutreachAgentDecision | null,
): boolean {
  if (!decision) return false;
  return decision.intent === "open_outreach" && decision.action === "navigate";
}

/**
 * Détermine si l'intent Outreach doit ouvrir un canvas.
 */
export function shouldOpenOutreachCanvas(
  decision: OutreachAgentDecision | null,
): boolean {
  if (!decision) return false;
  return decision.action === "open_canvas" || decision.action === "draft";
}

/**
 * Détermine si l'intent Outreach nécessite une action HITL.
 */
export function shouldStageOutreachAction(
  decision: OutreachAgentDecision | null,
): boolean {
  if (!decision) return false;
  return decision.action === "stage_action";
}

// ============================================================================
// DIAGNOSTICS
// ============================================================================

/**
 * Extrait les métriques de diagnostics pour logging/observabilité.
 */
export function extractOutreachDiagnostics(
  result: OutreachIntegrationResult,
): Record<string, unknown> {
  return {
    outreachIntent: result.outreachDecision?.intent ?? null,
    outreachAction: result.outreachDecision?.action ?? null,
    outreachSource: result.outreachDecision?.source ?? null,
    outreachConfidence: result.outreachDecision?.confidence ?? null,
    semanticAvailable: result.semanticAvailable,
    semanticUsed: result.diagnostics.semanticDecision !== null,
    semanticScore: result.diagnostics.semanticScore ?? null,
    latencyMs: result.diagnostics.latencyMs,
    safetyCanProceed: result.safetyReport?.canProceed ?? null,
    safetyChecksCount: result.safetyReport?.checks.length ?? 0,
  };
}
