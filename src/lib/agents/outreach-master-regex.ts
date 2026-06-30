/**
 * Master Outreach Agent — Regex deterministic classifier.
 *
 * Grammaire déterministe pour la classification des intentions Outreach.
 * Priorité: négatifs d'abord (protection), puis positives déterministes.
 *
 * Règles:
 * - Regex first, toujours.
 * - Si intent clair → deterministic (confidence: high).
 * - Si négatif détecté → no_action avec source: regex_negative.
 * - Si ambigu → passe à semantic HF (fichier séparé).
 *
 * Pure: no I/O, no DB, no random, no Date.now().
 */

import type {
  OutreachAgentDecision,
  OutreachIntentContext,
  OutreachEntityExtraction,
  OutreachNegativePattern,
} from "./outreach-master-types";

// ============================================================================
// NORMALIZATION
// ============================================================================

/** Normalise le texte pour le matching regex. */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Détecte si le message est en français. */
function isFrench(text: string): boolean {
  const frMarkers = /\b(ouvre|va|aller|montre|affiche|lance|créer|préparer|rédiger|écrire|relancer|campagn|prospect|distributeur)\b/i;
  const enMarkers = /\b(open|go|show|launch|create|prepare|draft|write|follow.?up|campaign|lead|distributor)\b/i;
  const frCount = (text.match(frMarkers) || []).length;
  const enCount = (text.match(enMarkers) || []).length;
  return frCount >= enCount;
}

// ============================================================================
// NEGATIVE PATTERNS — Protection contre faux positifs
// ============================================================================

interface NegativeRule {
  pattern: OutreachNegativePattern;
  re: RegExp;
  reason: string;
}

const NEGATIVE_RULES: readonly NegativeRule[] = [
  {
    pattern: "bug_report",
    re: /\b(bug|bugs|cassee?|casse|issue|probleme|problème|wrong|broken|buggy|bugged|ne marche pas|marche pas|fonctionne pas)\b/i,
    reason: "Bug report détecté — aucune navigation Outreach",
  },
  {
    pattern: "explain_request",
    re: /\b(explique|explique.?moi|explain|explain.*me|c.*est quoi|what is|how does.*work|comment.*marche)\b.*\b(outreach|campaign|campagne|prospect|lead)\b/i,
    reason: "Demande d'explication — réponse éducative uniquement",
  },
  {
    pattern: "history_request",
    re: /\b(historique|history|logs|past|précédent|previous|archive|archives)\b.*\b(campaign|campagne|outreach|email|send|envoi|envoy)\b/i,
    reason: "Demande historique — lecture seule, pas d'action",
  },
  {
    pattern: "cancel_instruction",
    re: /\b(ne\s+(?:fais?|fait|lance|envoie?|sourc)|n['']\s*(?:envoie?|lance)|don.?t\s+(?:do|launch|send|source)|pas\s+(?:d.*action|d.*envoi|de\s+sourc|de\s+campagne)|no\s+(?:action|send|source))\b/i,
    reason: "Instruction de non-action respectée",
  },
  {
    pattern: "analysis_only",
    re: /\b(juste\s+analyser|juste\s+analyser|analyse\s+only|analyze\s+only|seulement\s+analyser|only\s+analyze)\b/i,
    reason: "Analyse seule — pas de création/draft",
  },
  {
    pattern: "read_only",
    re: /\b(draft\s+only|read\s+only|lecture\s+seule|juste\s+lire|preview|prévisualiser)\b/i,
    reason: "Mode lecture seule demandé",
  },
];

function detectNegativePattern(text: string): NegativeRule | null {
  const normalized = normalize(text);
  for (const rule of NEGATIVE_RULES) {
    if (rule.re.test(text) || rule.re.test(normalized)) {
      return rule;
    }
  }
  return null;
}

// ============================================================================
// POSITIVE PATTERNS — Intents Outreach déterministes
// ============================================================================

interface IntentRule {
  intent: "open_outreach" | "create_campaign" | "draft_email" | "draft_whatsapp" | "draft_linkedin" | "follow_up_leads" | "source_leads" | "review_campaign" | "analyze_recipients";
  re: RegExp;
  action: "navigate" | "open_canvas" | "draft" | "stage_action" | "answer_only";
  channel?: "email" | "whatsapp" | "linkedin";
  priority: number; // Plus haut = testé en premier
}

// Navigation verbs shared
const NAV_VERB = "(?:ouvre|ouvrir|va|vas|aller|montre|affiche|navigue|accede|acceder|open|go|show|view|take|bring|navigate)";
const CREATE_VERB = "(?:créer|crée|créons|lance|lancer|lançons|prépare|préparer|préparons|monte|monter|setup|set up|create|launch|prepare|build)";
const DRAFT_VERB = "(?:rédige|rédiger|rédigeons|écris|écrire|écrivez|draft|write|compose|prépare.*un)";
const FOLLOWUP_VERB = "(?:relance|relancer|relançons|follow.?up|followup|re.?engage|nudge)";
const SOURCE_VERB = "(?:source|sourcer|sourcez|trouve|trouver|trouvez|find|search|look for)";

const INTENT_RULES: readonly IntentRule[] = [
  // --- NAVIGATION: open_outreach (highest priority for direct nav) ---
  {
    intent: "open_outreach",
    re: new RegExp(`${NAV_VERB}.*(?:outreach|investor pipeline|pipeline investisseur|prospect|campaign|campagne|espace prospection)`, "i"),
    action: "navigate",
    priority: 100,
  },
  {
    intent: "open_outreach",
    re: /\b(outreach workspace|outreach dashboard|espace outreach|tableau outreach)\b/i,
    action: "navigate",
    priority: 95,
  },
  // Short commands (bare keywords that are clearly commands)
  {
    intent: "open_outreach",
    re: /^(?:outreach|campagnes?|campaigns?|prospects?)\s*$/i,
    action: "navigate",
    priority: 90,
  },

  // --- CREATE_CAMPAIGN ---
  {
    intent: "create_campaign",
    re: /(?:creer|cree|lance|lancer|prepare|preparer|setup|create|launch|prepare|build).*(?:campagne|campaign|outreach|prospection|distributeur|investisseur|lead|prospect)/i,
    action: "open_canvas",
    priority: 85,
  },
  {
    intent: "create_campaign",
    re: /(?:nouvelle|new).*(?:campagne|campaign|outreach)|cold outreach/i,
    action: "open_canvas",
    priority: 80,
  },

  // --- DRAFT_EMAIL ---
  {
    intent: "draft_email",
    re: new RegExp(`\\b${DRAFT_VERB}\\b.*\\b(email|mail|e-mail|courriel|message.*investisseur|message.*distributeur)\\b`, "i"),
    action: "draft",
    channel: "email",
    priority: 75,
  },
  {
    intent: "draft_email",
    re: /(?:email|mail|e-mail).*(?:aux?|pour|to|for|investisseur|distributeur|prospect|lead)/i,
    action: "draft",
    channel: "email",
    priority: 70,
  },
  {
    intent: "draft_email",
    re: /(?:ecris|ecrire|prepar|write|draft).*(?:mail|email|prospection)/i,
    action: "draft",
    channel: "email",
    priority: 65,
  },

  // --- DRAFT_WHATSAPP ---
  {
    intent: "draft_whatsapp",
    re: /\b(whatsapp|wa|message whatsapp|whatsapp message|message sur whatsapp)\b/i,
    action: "draft",
    channel: "whatsapp",
    priority: 75,
  },
  {
    intent: "draft_whatsapp",
    re: /\b(?:écris|écrire|write|draft).*\b(?:whatsapp|sur whatsapp|lui sur wa|wa)\b/i,
    action: "draft",
    channel: "whatsapp",
    priority: 70,
  },

  // --- DRAFT_LINKEDIN ---
  {
    intent: "draft_linkedin",
    re: /\b(linkedin|li|message linkedin|inmail|linkedin message|connection request)\b/i,
    action: "draft",
    channel: "linkedin",
    priority: 75,
  },
  {
    intent: "draft_linkedin",
    re: /(?:ecris|ecrire|write|draft).*(?:linkedin|inmail|connection)/i,
    action: "draft",
    channel: "linkedin",
    priority: 70,
  },

  // --- FOLLOW_UP_LEADS ---
  {
    intent: "follow_up_leads",
    re: /(?:follow.?up|followup|relance|relancer|re.?engage|nudge).*(?:prospect|lead|investisseur|distributeur|ceux|those|no.*answer|not.*respond|repondu|didn.*t)/i,
    action: "stage_action",
    priority: 75,
  },
  {
    intent: "follow_up_leads",
    re: /(?:relance|relancer).*(?:ceux|qui|who|pas|not|repondu|answer|respond)/i,
    action: "stage_action",
    priority: 70,
  },

  // --- SOURCE_LEADS ---
  {
    intent: "source_leads",
    re: /(?:source|sourcer|sourcing|trouve|touver|find|search).*(?:lead|prospect|distributeur|investisseur|contact|email|uae)/i,
    action: "stage_action",
    priority: 75,
  },
  {
    intent: "source_leads",
    re: /(?:sourcing|source|find).*(?:new|nouveau|plus|more|uae).*(?:lead|prospect)/i,
    action: "stage_action",
    priority: 70,
  },

  // --- REVIEW_CAMPAIGN ---
  {
    intent: "review_campaign",
    re: /\b(review|revoir|vérif|vérifier|check|validate|valider|approuver|approve).*\b(campagne|campaign)\b/i,
    action: "stage_action",
    priority: 65,
  },

  // --- ANALYZE_RECIPIENTS ---
  {
    intent: "analyze_recipients",
    re: /\b(analyser|analyze|analyse|segment|segmenter|stats|statistiques|report|rapport|kpi|metrics).*\b(prospects?|leads?|recipients?|campagne|campaign)\b/i,
    action: "answer_only",
    priority: 60,
  },
];

// Sort by priority descending
const SORTED_INTENT_RULES = [...INTENT_RULES].sort((a, b) => b.priority - a.priority);

// ============================================================================
// ENTITY EXTRACTION
// ============================================================================

const CAMPAIGN_NAME_RE = /(?:nomm[ée]e?|appel[ée]e?|named|called|titre|title)\s*[""«»']?\s*([^""«»'\n,]{2,80})/i;
const CAMPAIGN_TYPE_RE = /\b(cold|newsletter|prospection froide|mailing| emailing)\b/i;
const CHANNEL_EMAIL_RE = /\b(email|mail|e-mail|courriel)\b/i;
const CHANNEL_WHATSAPP_RE = /\b(whatsapp|wa)\b/i;
const CHANNEL_LINKEDIN_RE = /\b(linkedin|inmail)\b/i;
const SCOPE_UAE_RE = /\b(uae|dubai|abou dhabi|abou dabi|emirates|émirats)\b/i;
const SCOPE_US_RE = /\b(usa|us|états-unis|states|america|uk|gb|britain|france|europe)\b/i;

function extractEntities(text: string): OutreachEntityExtraction {
  const extraction: OutreachEntityExtraction = {};

  // Campaign name
  const nameMatch = CAMPAIGN_NAME_RE.exec(text);
  if (nameMatch?.[1]) {
    extraction.campaignName = nameMatch[1].trim().replace(/[""«»']+$/g, "").trim();
  }

  // Campaign type
  const typeMatch = CAMPAIGN_TYPE_RE.exec(text);
  if (typeMatch?.[1]) {
    const t = typeMatch[1].toLowerCase();
    extraction.campaignType = t === "newsletter" || t === "mailing" || t === "emailing" ? "newsletter" : "cold";
  }

  // Channel
  if (CHANNEL_WHATSAPP_RE.test(text)) extraction.channel = "whatsapp";
  else if (CHANNEL_LINKEDIN_RE.test(text)) extraction.channel = "linkedin";
  else if (CHANNEL_EMAIL_RE.test(text)) extraction.channel = "email";

  // Scope
  if (SCOPE_UAE_RE.test(text)) extraction.scope = "UAE";
  else if (SCOPE_US_RE.test(text)) extraction.scope = "US/UK/EU";

  // Brief: tout après le verbe principal jusqu'à la fin
  const briefMatch = /(?:pour|for|about|sur|à propos de|concernant)\s+(.{10,200})/i.exec(text);
  if (briefMatch?.[1]) {
    extraction.brief = briefMatch[1].trim();
  }

  return extraction;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Classifie déterministiquement l'intent Outreach via regex.
 *
 * @returns Décision complète, ou null si ambigu (passer à semantic HF)
 */
export function classifyOutreachIntentRegex(
  ctx: OutreachIntentContext,
): OutreachAgentDecision | null {
  const { message, isAdmin } = ctx;

  if (!message?.trim()) {
    return buildDecision("no_action", "regex_negative", "high", "no_action", "Message vide", []);
  }

  const normalized = normalize(message);
  const locale = isFrench(message) ? "fr" : "en";

  // --- ÉTAPE 1: Vérifier les patterns négatifs (protection) ---
  const negative = detectNegativePattern(message);
  if (negative) {
    return buildDecision(
      "no_action",
      "regex_negative",
      "negative",
      "no_action",
      negative.reason,
      ["Pattern négatif détecté — aucune action Outreach"],
      normalized,
    );
  }

  // --- ÉTAPE 2: Vérifier les permissions ---
  if (!isAdmin) {
    // Non-admin: seulement navigation et answer_only
    const navRule = SORTED_INTENT_RULES.find(r => r.intent === "open_outreach" && r.re.test(message));
    if (navRule) {
      return buildDecision(
        "open_outreach",
        "regex_deterministic",
        "high",
        "navigate",
        `Navigation Outreach détectée (${locale})`,
        [],
        normalized,
        "/admin/outreach",
      );
    }
    // Non-admin demande autre chose → no_action
    return buildDecision(
      "no_action",
      "regex_negative",
      "negative",
      "no_action",
      "Action Outreach réservée admin — aucune navigation",
      ["Permission insuffisante pour cette action Outreach"],
      normalized,
    );
  }

  // --- ÉTAPE 3: Admin — matcher les règles positives ---
  for (const rule of SORTED_INTENT_RULES) {
    if (rule.re.test(message) || rule.re.test(normalized)) {
      const entities = extractEntities(message);
      return buildDecisionFromRule(rule, entities, normalized, locale);
    }
  }

  // --- ÉTAPE 4: Ambigu — retourner null pour passer à HF/LLM ---
  return null;
}

/** Construit une décision complète. */
function buildDecision(
  intent: OutreachAgentDecision["intent"],
  source: OutreachAgentDecision["source"],
  confidence: OutreachAgentDecision["confidence"],
  action: OutreachAgentDecision["action"],
  reason: string,
  safetyWarnings: string[],
  normalizedInput?: string,
  route?: string,
  canvasKey?: OutreachAgentDecision["canvasKey"],
  channel?: OutreachAgentDecision["channel"],
  recipientsScope?: string,
): OutreachAgentDecision {
  return {
    intent,
    source,
    confidence,
    action,
    reason,
    safetyWarnings,
    sendAllowed: false,
    requiresUserReview: true,
    ...(normalizedInput && { normalizedInput }),
    ...(route && { route }),
    ...(canvasKey && { canvasKey }),
    ...(channel && { channel }),
    ...(recipientsScope && { recipientsScope }),
  };
}

/** Construit une décision depuis une règle matched. */
function buildDecisionFromRule(
  rule: IntentRule,
  entities: OutreachEntityExtraction,
  normalizedInput: string,
  locale: "fr" | "en",
): OutreachAgentDecision {
  const safetyWarnings: string[] = [];

  // Warnings contextuels
  if (rule.intent === "create_campaign" && !entities.campaignName) {
    safetyWarnings.push("Nom de campagne non détecté — sera demandé à l'étape suivante");
  }
  if (rule.intent === "create_campaign" && !entities.campaignType) {
    safetyWarnings.push("Type de campagne non détecté — 'cold' par défaut (modifiable)");
  }
  if (rule.intent === "draft_email" && !entities.brief) {
    safetyWarnings.push("Brief email non précisé — draft générique proposé");
  }

  const route = rule.action === "navigate" ? "/admin/outreach" : undefined;
  const canvasKey = rule.action === "open_canvas" ? "outreach" : undefined;

  const reasonBase = locale === "fr" ? "Intent détecté" : "Intent detected";

  return buildDecision(
    rule.intent,
    "regex_deterministic",
    "high",
    rule.action,
    `${reasonBase}: ${rule.intent} (${locale})`,
    safetyWarnings,
    normalizedInput,
    route,
    canvasKey,
    rule.channel,
    entities.scope,
  );
}

/** Exporte les règles pour introspection/tests. */
export function getOutreachRegexRules(): {
  negatives: readonly NegativeRule[];
  positives: readonly IntentRule[];
} {
  return {
    negatives: NEGATIVE_RULES,
    positives: SORTED_INTENT_RULES,
  };
}

/** Exporte les patterns négatifs pour diagnostic. */
export function getNegativePatterns(): readonly NegativeRule[] {
  return NEGATIVE_RULES;
}
