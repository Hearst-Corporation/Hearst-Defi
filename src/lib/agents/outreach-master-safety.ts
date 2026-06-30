/**
 * Master Outreach Agent — Safety Gates & Validations.
 *
 * Vérifications impérables avant toute action:
 * - Permissions (admin requis pour actions sensibles)
 * - Forbidden words check sur tous les drafts
 * - No send sans confirmation explicite
 * - No bulk sans preview recipients
 * - Audit trail
 *
 * Pure pour les vérifications statiques, async pour les vérifications DB.
 */

import { containsForbidden } from "./forbidden-words";
import { assertNoForbiddenWords } from "./validators";
import type { OutreachAgentDecision, OutreachIntent } from "./outreach-master-types";

// ============================================================================
// TYPES
// ============================================================================

export type SafetySeverity = "BLOCKING" | "WARNING" | "INFO";

export interface SafetyCheck {
  id: string;
  passed: boolean;
  severity: SafetySeverity;
  message: string;
  detail?: unknown;
}

export interface SafetyReport {
  decisionId: string;
  checks: SafetyCheck[];
  canProceed: boolean;
  blockingReasons: string[];
  warnings: string[];
  timestamp: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Intents qui nécessitent le rôle admin. */
const ADMIN_ONLY_INTENTS: readonly OutreachIntent[] = [
  "create_campaign",
  "draft_email",
  "draft_whatsapp",
  "draft_linkedin",
  "follow_up_leads",
  "source_leads",
  "review_campaign",
  "analyze_recipients",
  "segment_investors",
];

/** Intents qui créent du contenu (nécessite forbidden words check). */
const CONTENT_CREATING_ACTIONS: readonly OutreachAgentDecision["action"][] = [
  "draft",
  "stage_action",
];

/** Seuil minimum pour semantic confidence. */
const MIN_SEMANTIC_SCORE = 0.85;

// ============================================================================
// STATIC SAFETY CHECKS (Pure)
// ============================================================================

/**
 * Vérifie que la décision respecte les invariants absolus.
 */
export function validateDecisionInvariants(decision: OutreachAgentDecision): SafetyCheck[] {
  const checks: SafetyCheck[] = [];

  // Invariant: sendAllowed TOUJOURS false
  checks.push({
    id: "invariant.send_blocked",
    passed: decision.sendAllowed === false,
    severity: "BLOCKING",
    message: decision.sendAllowed === false
      ? "sendAllowed is false — OK"
      : "sendAllowed MUST be false — VIOLATION",
    detail: { sendAllowed: decision.sendAllowed },
  });

  // Invariant: requiresUserReview TOUJOURS true
  checks.push({
    id: "invariant.review_required",
    passed: decision.requiresUserReview === true,
    severity: "BLOCKING",
    message: decision.requiresUserReview === true
      ? "requiresUserReview is true — OK"
      : "requiresUserReview MUST be true — VIOLATION",
    detail: { requiresUserReview: decision.requiresUserReview },
  });

  // Invariant: source défini
  checks.push({
    id: "invariant.source_tracked",
    passed: !!decision.source,
    severity: "WARNING",
    message: decision.source
      ? `Source tracked: ${decision.source}`
      : "Source missing — audit trail degraded",
    detail: { source: decision.source },
  });

  // Invariant: intent non-empty
  checks.push({
    id: "invariant.intent_defined",
    passed: !!decision.intent,
    severity: "BLOCKING",
    message: decision.intent
      ? `Intent defined: ${decision.intent}`
      : "Intent undefined — blocking",
    detail: { intent: decision.intent },
  });

  return checks;
}

/**
 * Vérifie les permissions pour le contexte.
 */
export function validatePermissions(
  decision: OutreachAgentDecision,
  isAdmin: boolean,
): SafetyCheck {
  const needsAdmin = ADMIN_ONLY_INTENTS.includes(decision.intent);

  if (needsAdmin && !isAdmin) {
    return {
      id: "permission.admin_required",
      passed: false,
      severity: "BLOCKING",
      message: `Intent '${decision.intent}' requires admin role`,
      detail: { intent: decision.intent, isAdmin },
    };
  }

  return {
    id: "permission.admin_required",
    passed: true,
    severity: "INFO",
    message: needsAdmin
      ? `Intent '${decision.intent}' — admin verified`
      : `Intent '${decision.intent}' — no special permission required`,
    detail: { intent: decision.intent, isAdmin },
  };
}

/**
 * Vérifie que le score semantic est suffisant si applicable.
 */
export function validateSemanticConfidence(decision: OutreachAgentDecision): SafetyCheck {
  if (decision.source !== "semantic_hf") {
    return {
      id: "semantic.score_check",
      passed: true,
      severity: "INFO",
      message: "Not a semantic decision — skipping score check",
    };
  }

  const score = decision.semanticScore ?? 0;
  const passed = score >= MIN_SEMANTIC_SCORE;

  return {
    id: "semantic.score_check",
    passed,
    severity: passed ? "INFO" : "WARNING",
    message: passed
      ? `Semantic score ${(score * 100).toFixed(1)}% >= ${(MIN_SEMANTIC_SCORE * 100).toFixed(0)}%`
      : `Semantic score ${(score * 100).toFixed(1)}% below threshold ${(MIN_SEMANTIC_SCORE * 100).toFixed(0)}%`,
    detail: { score, threshold: MIN_SEMANTIC_SCORE },
  };
}

/**
 * Vérifie qu'un texte de draft ne contient pas de forbidden words.
 */
export function validateDraftContent(text: string, context: string): SafetyCheck {
  try {
    assertNoForbiddenWords(text);
    return {
      id: `content.forbidden_words.${context}`,
      passed: true,
      severity: "INFO",
      message: `No forbidden words in ${context}`,
    };
  } catch (error) {
    const hit = containsForbidden(text);
    return {
      id: `content.forbidden_words.${context}`,
      passed: false,
      severity: "BLOCKING",
      message: `Forbidden words detected in ${context}: ${hit?.found.join(", ") || "unknown"}`,
      detail: { context, found: hit?.found },
    };
  }
}

// ============================================================================
// FULL SAFETY REPORT
// ============================================================================

/**
 * Génère un rapport de sécurité complet pour une décision.
 */
export function generateSafetyReport(
  decision: OutreachAgentDecision,
  context: { isAdmin: boolean; draftContent?: string },
): SafetyReport {
  const checks: SafetyCheck[] = [];

  // 1. Invariants
  checks.push(...validateDecisionInvariants(decision));

  // 2. Permissions
  checks.push(validatePermissions(decision, context.isAdmin));

  // 3. Semantic confidence
  checks.push(validateSemanticConfidence(decision));

  // 4. Content safety (si draft)
  if (context.draftContent && CONTENT_CREATING_ACTIONS.includes(decision.action)) {
    checks.push(validateDraftContent(context.draftContent, "draft"));
  }

  // 5. Action-specific checks
  if (decision.action === "stage_action") {
    checks.push({
      id: "action.staged_only",
      passed: true,
      severity: "INFO",
      message: "Action staged for HITL review — will not auto-execute",
    });
  }

  // Compile report
  const blocking = checks.filter(c => c.severity === "BLOCKING" && !c.passed);
  const warnings = checks.filter(c => c.severity === "WARNING" && !c.passed);

  return {
    decisionId: `${decision.intent}_${decision.source}_${Date.now()}`,
    checks,
    canProceed: blocking.length === 0,
    blockingReasons: blocking.map(c => c.message),
    warnings: warnings.map(c => c.message),
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// GUARDS (Throw on violation)
// ============================================================================

/**
 * Lance une exception si la décision viole les invariants critiques.
 */
export function guardDecisionOrThrow(decision: OutreachAgentDecision): void {
  if (decision.sendAllowed !== false) {
    throw new Error(
      `CRITICAL SAFETY VIOLATION: sendAllowed=${decision.sendAllowed} — must always be false`
    );
  }

  if (decision.requiresUserReview !== true) {
    throw new Error(
      `CRITICAL SAFETY VIOLATION: requiresUserReview=${decision.requiresUserReview} — must always be true`
    );
  }
}

/**
 * Lance une exception si l'utilisateur non-admin tente une action admin.
 */
export function guardAdminOnlyOrThrow(
  decision: OutreachAgentDecision,
  isAdmin: boolean,
): void {
  const needsAdmin = ADMIN_ONLY_INTENTS.includes(decision.intent);
  if (needsAdmin && !isAdmin) {
    throw new Error(
      `PERMISSION VIOLATION: Intent '${decision.intent}' requires admin role`
    );
  }
}

// ============================================================================
// DIAGNOSTIC EXPORTS
// ============================================================================

/** Exporte la liste des intents admin-only pour introspection. */
export function getAdminOnlyIntents(): readonly OutreachIntent[] {
  return ADMIN_ONLY_INTENTS;
}

/** Exporte la configuration de safety. */
export function getSafetyConfig(): {
  minSemanticScore: number;
  adminOnlyIntents: readonly OutreachIntent[];
  contentCreatingActions: readonly OutreachAgentDecision["action"][];
} {
  return {
    minSemanticScore: MIN_SEMANTIC_SCORE,
    adminOnlyIntents: ADMIN_ONLY_INTENTS,
    contentCreatingActions: CONTENT_CREATING_ACTIONS,
  };
}
