/**
 * Master Outreach Agent — types et contrats.
 *
 * Définit le contrat canonique pour les décisions de l'agent Outreach,
 * séparant les intents navigationnels des intents de création/draft.
 *
 * Pure: no I/O, no DB, no imports lourds.
 */

/** Intents spécifiques au domaine Outreach. */
export type OutreachIntent =
  | "open_outreach"           // Navigation vers /admin/outreach
  | "create_campaign"       // Créer une campagne (canvas)
  | "draft_email"           // Draft email pour prospect
  | "draft_whatsapp"        // Draft WhatsApp
  | "draft_linkedin"        // Draft LinkedIn
  | "follow_up_leads"       // Relancer prospects
  | "analyze_recipients"    // Analyser recipients
  | "segment_investors"     // Segmentation investisseurs
  | "review_campaign"       // Review campagne existante
  | "source_leads"          // Sourcing de leads
  | "no_action";            // Aucune action Outreach

/** Source de la décision — traçabilité. */
export type OutreachDecisionSource =
  | "regex_deterministic"    // Regex haute confiance
  | "regex_negative"         // Regex négatif (protection)
  | "semantic_hf"            // HuggingFace semantic similarity
  | "fallback_llm"           // LLM fallback (rare)
  | "unknown";               // Inconnu → no_action

/** Niveau de confiance de la classification. */
export type OutreachConfidence =
  | "high"      // Regex match clair
  | "medium"    // Semantic HF ou pattern indirect
  | "low"       // Ambigu, nécessite clarification
  | "negative"; // Pattern négatif détecté

/** Type d'action recommandée. */
export type OutreachActionType =
  | "navigate"      // Navigation simple
  | "open_canvas"   // Ouvrir canvas outreach
  | "draft"         // Générer un draft
  | "stage_action"  // Stager une action HITL
  | "answer_only"   // Réponse texte seule
  | "no_action"     // Aucune action
  | string;

/** Canal de communication pour drafts. */
export type OutreachChannel = "email" | "whatsapp" | "linkedin" | "general";

/**
 * Décision canonique de l'Outreach Master Agent.
 *
 * Contraintes absolues:
 * - sendAllowed est TOUJOURS false (sauf flow explicite séparé)
 * - requiresUserReview est TOUJOURS true pour tout draft/action
 * - unknown intent = no_action (pas de navigation LLM-only)
 */
export interface OutreachAgentDecision {
  /** Intent détecté */
  intent: OutreachIntent;

  /** Source de la décision (traçabilité) */
  source: OutreachDecisionSource;

  /** Niveau de confiance */
  confidence: OutreachConfidence;

  /** Type d'action recommandée */
  action: OutreachActionType;

  /** Route si navigation */
  route?: string;

  /** Canvas key si applicable */
  canvasKey?: "outreach";

  /** Scope des recipients si précisé */
  recipientsScope?: string;

  /** Canal pour drafts */
  channel?: OutreachChannel;

  /** Toujours false — jamais d'envoi auto */
  sendAllowed: false;

  /** Toujours true — review requise */
  requiresUserReview: true;

  /** Raison/explication de la décision */
  reason: string;

  /** Avertissements de sécurité */
  safetyWarnings: string[];

  /** Input normalisé pour debug */
  normalizedInput?: string;

  /** Score semantic si HF utilisé */
  semanticScore?: number;
}

/** Contexte pour la classification Outreach. */
export interface OutreachIntentContext {
  /** Message brut utilisateur */
  message: string;

  /** Est admin (débloque les actions) */
  isAdmin: boolean;

  /** Locale détectée (fr/en) */
  locale?: "fr" | "en";

  /** Campagne active si connue */
  activeCampaignId?: string;

  /** Historique des intents récents */
  recentIntents?: OutreachIntent[];
}

/** Résultat d'extraction d'entités depuis le message. */
export interface OutreachEntityExtraction {
  /** Nom de campagne extrait */
  campaignName?: string;

  /** Type de campagne */
  campaignType?: "cold" | "newsletter";

  /** Canal préféré */
  channel?: OutreachChannel;

  /** Scope/segment mentionné */
  scope?: string;

  /** Brief/objet du message */
  brief?: string;
}

/** Catégories de patterns négatifs (pour protection). */
export type OutreachNegativePattern =
  | "bug_report"          // "outreach CSS bug"
  | "explain_request"     // "explique-moi outreach"
  | "history_request"     // "historique campagne"
  | "cancel_instruction"  // "ne lance rien"
  | "analysis_only"       // "juste analyser"
  | "read_only";          // "draft only", "read only"

/** Interface du classifier (pour injection/tests). */
export interface OutreachIntentClassifier {
  classify(ctx: OutreachIntentContext): Promise<OutreachAgentDecision> | OutreachAgentDecision;
}
