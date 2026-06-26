/**
 * Deterministic Intent Router v2 — orchestrator.
 *
 * `classifyAgenticIntent(message, ctx)` returns a typed AgenticIntentDecision the
 * chat layer can act on BEFORE any LLM call. It NEVER executes anything.
 *
 * v2 changes over v1:
 * - Uses context-aware negation (intent-router-negation.ts v2) that understands
 *   "ne … pas", "n' … pas", "don't", "do not", "sans + verb" vs "sans + noun".
 * - Adds `isEducationalReadOnly` hint for the compliance layer.
 * - Navigation can be driven by the router (not just shadow-logged).
 * - Dangerous intents are refused before any LLM call.
 *
 * Priority (first match wins):
 *   0. empty                         → unknown / needs_clarification
 *   1. standalone cancellation       → cancellation
 *   2. standalone confirmation       → confirmation (requiresExistingPendingAction)
 *   3. DANGEROUS (deploy/sign/gov/…) → refuse_autonomous  [negated ⇒ cancellation]
 *   4. send / source                 → requires_human_gate [negated ⇒ cancellation]
 *   5. outreach draft / setup        → canvas / draft-only  [negated ⇒ cancellation]
 *   6. vault readiness / product draft                      [negated ⇒ cancellation]
 *   7. reporting                                            [negated ⇒ cancellation]
 *   8. navigation (delegated resolver)                      [negated ⇒ cancellation]
 *   9. education (read-only)                                [negated ⇒ unknown]
 *  10. unknown                       → needs_clarification (LLM)
 *
 * Negation runs as a cross-cutting guard: any positive action/nav under a
 * negation is flipped so the router can NEVER emit a positive navigation/action
 * for "ne va pas dans vaults" / "don't open outreach" / "ne déploie pas".
 *
 * Pure: no I/O, no DB. The only dependency is the existing deterministic nav
 * resolver (also pure), reused so route keys never drift.
 */

import {
  resolveNavFallbackDestinationKey,
} from "@/lib/llm/nav-fallback-intent";
import type {
  AgenticIntentContext,
  AgenticIntentDecision,
  IntentRule,
} from "@/lib/agentic/intent-router-types";
import { normalizeIntentInput } from "@/lib/agentic/intent-router-normalize";
import { isNegated } from "@/lib/agentic/intent-router-negation";
import {
  CANCELLATION_RE,
  CONFIRMATION_RE,
  DANGEROUS_RULES,
  EDUCATION_RULES,
  OUTREACH_RULES,
  PRODUCT_VAULT_RULES,
  REPORTING_RULES,
  SEND_SOURCE_RULES,
} from "@/lib/agentic/intent-router-rules";

/** Build a decision from a matched rule, carrying its policy/flags. */
function fromRule(
  rule: IntentRule,
  normalizedInput: string,
  extra: Partial<AgenticIntentDecision> = {},
): AgenticIntentDecision {
  return {
    kind: rule.kind,
    confidence: 0.9,
    actionPolicy: rule.actionPolicy,
    riskLevel: rule.riskLevel,
    canvasKey: rule.canvasKey,
    targetCrew: rule.targetCrew,
    requiresLLM: rule.requiresLLM,
    requiresCanvas: rule.requiresCanvas,
    requiresHumanGate: rule.requiresHumanGate,
    requiresExistingPendingAction: false,
    prohibitedAutonomousAction: rule.prohibitedAutonomousAction,
    matchedRuleIds: [rule.id],
    normalizedInput,
    negated: false,
    reason: rule.reason,
    ...extra,
  };
}

/** Cancellation decision — used directly ("annule") or when a negation flips a
 *  positive intent ("ne va pas dans vaults"). Never carries an action. */
function cancellation(
  normalizedInput: string,
  matchedRuleIds: string[],
  reason: string,
  negated: boolean,
): AgenticIntentDecision {
  return {
    kind: "cancellation",
    confidence: 0.9,
    actionPolicy: "needs_clarification",
    riskLevel: "none",
    requiresLLM: false,
    requiresCanvas: false,
    requiresHumanGate: false,
    requiresExistingPendingAction: false,
    prohibitedAutonomousAction: false,
    matchedRuleIds,
    normalizedInput,
    negated,
    reason,
  };
}

function unknown(
  normalizedInput: string,
  reason: string,
  negated = false,
): AgenticIntentDecision {
  return {
    kind: "unknown",
    confidence: 0.3,
    actionPolicy: "needs_clarification",
    riskLevel: "none",
    requiresLLM: true,
    requiresCanvas: false,
    requiresHumanGate: false,
    requiresExistingPendingAction: false,
    prohibitedAutonomousAction: false,
    matchedRuleIds: [],
    normalizedInput,
    negated,
    reason,
  };
}

function firstMatch(
  rules: readonly IntentRule[],
  normalized: string,
): IntentRule | null {
  for (const rule of rules) {
    if (rule.re.test(normalized)) return rule;
  }
  return null;
}

/**
 * Router-owned navigation augmentation for the explicit phrasings the legacy
 * resolver (`resolveNavFallbackDestinationKey`) does not cover — notably "va dans
 * X" (the legacy NAV_VERB has "va sur" but not "va dans") and bare section names
 * ("dashboard", "reports"). Runs ONLY after the legacy resolver returns null, so
 * it never overrides the canonical sub-page resolution. Returns a route key or
 * null. Pure regex on the normalized input.
 */
const NAV_LEAD =
  "(?:go to|open|take me to|show( me)?|view|ouvre|ouvrir|ouvri|va (?:dans|sur|a|au|aux)|vas? (?:dans|sur)|aller (?:dans|sur|a)|affiche|affiche moi|montre|montre moi|voir|consulte|accede a|accede aux|redirige vers)";

function resolveAugmentedNav(
  normalized: string,
  isAdmin: boolean,
): string | null {
  const navLed = new RegExp(`\\b${NAV_LEAD}\\b`).test(normalized);

  if (navLed && /\bvaults?\b/.test(normalized)) return "vaults";
  if (navLed && /\b(portefeuille|portfolio|portofolio|dashboard|dashbord)\b/.test(normalized)) {
    return "portfolio";
  }
  if (/\b(product workspace|espace produit|workspace produit)\b/.test(normalized)) {
    return "admin-product-workspace";
  }
  if (/\b(outreach|outrich|outtrich|investor pipeline|pipeline investisseurs?|prospects?|campaign|campain|campagne)\b/.test(normalized)) {
    return "admin-outreach";
  }
  if (/\b(dashboard|dashbord|tableau de bord|home|accueil|control tower|tour de controle)\b/.test(normalized)) {
    return isAdmin ? "admin-dashboard" : "portfolio";
  }
  // Bare reports/brief navigation (the generative "génère un rapport" is caught
  // earlier as reporting_request). "reports" is a logical key the chat maps.
  if (/\b(reports?|rapports?|reporting)\b/.test(normalized)) {
    return isAdmin ? "admin-investor-memo" : "portfolio-activity";
  }
  return null;
}

/**
 * Classify a user message into a deterministic agentic decision.
 *
 * @param message raw user text
 * @param ctx     nav scope + pending-gate context (all optional)
 */
export function classifyAgenticIntent(
  message: string,
  ctx: AgenticIntentContext = {},
): AgenticIntentDecision {
  const { normalized, original } = normalizeIntentInput(message);

  // 0. Empty.
  if (!normalized) {
    return unknown("", "Message vide.");
  }

  const negated = isNegated(normalized);

  // 1. Standalone cancellation ("non", "annule", "stop", "cancel").
  if (CANCELLATION_RE.test(normalized)) {
    return cancellation(
      normalized,
      ["cancel.standalone"],
      "Annulation explicite.",
      true,
    );
  }

  // 2. Standalone confirmation ("oui", "confirme", "go", "vas y"). Only meaningful
  //    if a HITL action is pending — flagged so the caller never executes blind.
  if (CONFIRMATION_RE.test(normalized)) {
    return {
      kind: "confirmation",
      confidence: 0.9,
      actionPolicy: "requires_human_gate",
      riskLevel: "low",
      requiresLLM: false,
      requiresCanvas: false,
      requiresHumanGate: true,
      requiresExistingPendingAction: true,
      prohibitedAutonomousAction: false,
      matchedRuleIds: ["confirm.standalone"],
      normalizedInput: normalized,
      negated: false,
      reason: ctx.hasPendingHumanGate
        ? "Confirmation d'une action HITL en attente."
        : "Confirmation isolée : aucune action HITL en attente — ne rien exécuter.",
    };
  }

  // 3. DANGEROUS (deploy / sign / governance / migrate / change core).
  //    A NEGATED dangerous intent ("ne déploie pas") becomes a cancellation —
  //    never a positive action, and the router still never executes a deploy.
  const dangerous = firstMatch(DANGEROUS_RULES, normalized);
  if (dangerous) {
    if (negated) {
      return cancellation(
        normalized,
        [dangerous.id, "negation"],
        "Intention dangereuse niée — aucune action, jamais de déploiement.",
        true,
      );
    }
    return fromRule(dangerous, normalized);
  }

  // 4. SEND / SOURCE (outreach actions, human-gated).
  const sendSource = firstMatch(SEND_SOURCE_RULES, normalized);
  if (sendSource) {
    if (negated) {
      return cancellation(
        normalized,
        [sendSource.id, "negation"],
        "Envoi/sourcing nié — aucune action.",
        true,
      );
    }
    return fromRule(sendSource, normalized);
  }

  // 5. OUTREACH setup / draft (canvas / draft-only).
  const outreach = firstMatch(OUTREACH_RULES, normalized);
  if (outreach) {
    if (negated) {
      return cancellation(
        normalized,
        [outreach.id, "negation"],
        "Campagne niée — aucune ouverture de canvas ni draft.",
        true,
      );
    }
    return fromRule(outreach, normalized);
  }

  // 6. PRODUCT / VAULT (readiness read-only, or product draft canvas).
  const productVault = firstMatch(PRODUCT_VAULT_RULES, normalized);
  if (productVault) {
    if (negated) {
      return cancellation(
        normalized,
        [productVault.id, "negation"],
        "Création/lecture produit niée — aucune action.",
        true,
      );
    }
    return fromRule(productVault, normalized);
  }

  // 7. REPORTING (read-only brief).
  const reporting = firstMatch(REPORTING_RULES, normalized);
  if (reporting) {
    if (negated) {
      return cancellation(
        normalized,
        [reporting.id, "negation"],
        "Rapport nié — aucune génération.",
        true,
      );
    }
    return fromRule(reporting, normalized);
  }

  // 8. NAVIGATION — delegated to the existing deterministic resolver (route keys
  //    never drift). A negation short-circuits BEFORE delegation so a negated nav
  //    ("ne va pas dans vaults") can never resolve a destination.
  if (!negated) {
    const routeKey =
      resolveNavFallbackDestinationKey({
        navProfile: ctx.navProfile ?? "lp",
        isAdmin: ctx.isAdmin ?? false,
        message: original,
        scenarioLabDestinationKey: "admin-scenario-lab",
        scenarioLabNavEnabled: ctx.scenarioLabNavEnabled ?? false,
      }) ?? resolveAugmentedNav(normalized, ctx.isAdmin ?? false);
    if (routeKey) {
      return {
        kind: "navigation",
        confidence: 0.95,
        actionPolicy: "allow_navigation",
        riskLevel: "none",
        routeKey,
        requiresLLM: false,
        requiresCanvas: false,
        requiresHumanGate: false,
        requiresExistingPendingAction: false,
        prohibitedAutonomousAction: false,
        matchedRuleIds: ["nav.resolver"],
        normalizedInput: normalized,
        negated: false,
        reason: `Navigation déterministe vers « ${routeKey} » (lecture seule).`,
      };
    }
  }

  // 9. EDUCATION (read-only). A negated education question ("ne m'explique pas")
  //    is not an answerable request → unknown.
  const education = firstMatch(EDUCATION_RULES, normalized);
  if (education) {
    if (negated) {
      return unknown(
        normalized,
        "Demande d'explication niée — clarification nécessaire.",
        true,
      );
    }
    return fromRule(education, normalized);
  }

  // 10. A negated message that matched no positive rule is still a refusal/cancel
  //     rather than a positive action.
  if (negated) {
    return cancellation(
      normalized,
      ["negation"],
      "Négation sans cible d'action claire — aucune navigation ni action.",
      true,
    );
  }

  // 11. Unknown → let the LLM handle, no action.
  return unknown(normalized, "Aucune règle déterministe — délégué au LLM.");
}

/**
 * Convenience: true when the decision is a read-only educational intent that
 * should never trigger a compliance false-positive. The caller (compliance
 * guard or chat layer) can use this as a hint.
 */
export function isEducationalReadOnly(
  decision: AgenticIntentDecision,
): boolean {
  return (
    decision.actionPolicy === "allow_readonly" &&
    (decision.kind === "education" ||
      decision.kind === "yield_explanation" ||
      decision.kind === "product_explanation" ||
      decision.kind === "risk_explanation" ||
      decision.kind === "reporting_request" ||
      decision.kind === "vault_readiness")
  );
}
