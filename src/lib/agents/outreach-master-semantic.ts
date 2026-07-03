/**
 * Master Outreach Agent — HuggingFace Semantic Fallback.
 *
 * Utilise HF zero-shot classification pour les intentions ambiguës
 * qui ne matchent pas les regex déterministes.
 *
 * Contrat:
 * - Ne JAMAIS remplacer les regex déterministes
 * - Ne JAMAIS bypasser les permissions
 * - Seuil strict (0.85) pour éviter faux positifs
 * - Retourne null si score < threshold (unknown = no_action)
 * - Toujours expliquable (score + label retournés)
 *
 * Pure logic + HF I/O (network-bound, fail-open).
 */

import { huggingface, HF_AVAILABLE, HF_ZEROSHOT_MODEL } from "@/lib/llm/huggingface";
import type {
  OutreachAgentDecision,
  OutreachIntentContext,
} from "./outreach-master-types";

/** Seuil strict pour classification semantic — évite faux positifs. */
const SEMANTIC_THRESHOLD = 0.85;

/** Timeout court pour HF (best-effort 2nd screen). */
const HF_TIMEOUT_MS = 4000;

// ============================================================================
// HYPOTHÈSES ZERO-SHOT MULTILINGUES (FR + EN)
// ============================================================================

interface OutreachHypothesis {
  label: string;
  intent: OutreachAgentDecision["intent"];
  action: OutreachAgentDecision["action"];
  channel?: OutreachAgentDecision["channel"];
  reason: string;
}

const OUTREACH_HYPOTHESES: readonly OutreachHypothesis[] = [
  // Navigation
  {
    label: "Open the outreach workspace or campaign dashboard",
    intent: "open_outreach",
    action: "navigate",
    reason: "User wants to access the outreach section",
  },
  {
    label: "Ouvrir l'espace outreach ou le tableau de bord des campagnes",
    intent: "open_outreach",
    action: "navigate",
    reason: "Utilisateur veut accéder à la section outreach",
  },

  // Campaign creation
  {
    label: "Create a new outreach campaign for investors or distributors",
    intent: "create_campaign",
    action: "open_canvas",
    reason: "User wants to set up a new campaign",
  },
  {
    label: "Créer une nouvelle campagne de prospection pour investisseurs ou distributeurs",
    intent: "create_campaign",
    action: "open_canvas",
    reason: "Utilisateur veut créer une campagne",
  },

  // Email draft
  {
    label: "Draft or write an email to investors or prospects",
    intent: "draft_email",
    action: "draft",
    channel: "email",
    reason: "User wants to compose an email",
  },
  {
    label: "Rédiger ou écrire un email aux investisseurs ou prospects",
    intent: "draft_email",
    action: "draft",
    channel: "email",
    reason: "Utilisateur veut rédiger un email",
  },

  // WhatsApp draft
  {
    label: "Draft or write a WhatsApp message",
    intent: "draft_whatsapp",
    action: "draft",
    channel: "whatsapp",
    reason: "User wants to compose a WhatsApp",
  },
  {
    label: "Rédiger ou écrire un message WhatsApp",
    intent: "draft_whatsapp",
    action: "draft",
    channel: "whatsapp",
    reason: "Utilisateur veut rédiger un WhatsApp",
  },

  // LinkedIn draft
  {
    label: "Draft or write a LinkedIn message or InMail",
    intent: "draft_linkedin",
    action: "draft",
    channel: "linkedin",
    reason: "User wants to compose LinkedIn outreach",
  },
  {
    label: "Rédiger ou écrire un message LinkedIn ou InMail",
    intent: "draft_linkedin",
    action: "draft",
    channel: "linkedin",
    reason: "Utilisateur veut rédiger sur LinkedIn",
  },

  // Follow-up
  {
    label: "Follow up with leads or prospects who haven't responded",
    intent: "follow_up_leads",
    action: "stage_action",
    reason: "User wants to re-engage non-responsive leads",
  },
  {
    label: "Relancer les prospects ou leads qui n'ont pas répondu",
    intent: "follow_up_leads",
    action: "stage_action",
    reason: "Utilisateur veut relancer des leads non réactifs",
  },

  // Source leads
  {
    label: "Source or find new leads and prospects",
    intent: "source_leads",
    action: "stage_action",
    reason: "User wants to acquire new leads",
  },
  {
    label: "Sourcer ou trouver de nouveaux leads et prospects",
    intent: "source_leads",
    action: "stage_action",
    reason: "Utilisateur veut acquérir des leads",
  },

  // Review/analyze (low priority — avoid FP)
  {
    label: "Review or analyze campaign performance and recipients",
    intent: "analyze_recipients",
    action: "answer_only",
    reason: "User wants read-only analysis",
  },
  {
    label: "Revoir ou analyser les performances et destinataires",
    intent: "analyze_recipients",
    action: "answer_only",
    reason: "Utilisateur veut analyse en lecture seule",
  },
];

// ============================================================================
// NEGATIVE HYPOTHESES — Protection contre faux positifs
// ============================================================================

const NEGATIVE_HYPOTHESES: readonly string[] = [
  "This text reports a bug or error with the outreach system",
  "This text asks for an explanation of what outreach means",
  "This text requests historical data or past campaign logs",
  "This text explicitly says to do nothing or not send anything",
  "This text mentions CSS, styling, UI, or visual design bugs",
  "Ce texte signale un bug ou une erreur avec le système outreach",
  "Ce texte demande une explication de ce qu'est l'outreach",
  "Ce texte demande des données historiques ou logs de campagnes",
  "Ce texte dit explicitement de ne rien faire ou ne rien envoyer",
  "Ce texte mentionne CSS, style, UI, ou bugs visuels",
];

// ============================================================================
// CLASSIFICATION LOGIC
// ============================================================================

interface SemanticClassificationResult {
  intent: OutreachAgentDecision["intent"];
  confidence: number;
  topLabel: string;
  action: OutreachAgentDecision["action"];
  channel?: OutreachAgentDecision["channel"];
  reason: string;
}

/**
 * Classifie sémantiquement via HF zero-shot.
 *
 * @returns Classification si score >= threshold, null sinon
 */
async function classifySemantic(
  message: string,
  isAdmin: boolean,
): Promise<SemanticClassificationResult | null> {
  if (!HF_AVAILABLE) {
    return null;
  }

  const trimmed = message.trim();
  if (!trimmed || trimmed.length < 5) {
    return null;
  }

  try {
    // D'abord, vérifier si c'est un pattern négatif
    const negativeOut = await huggingface.zeroShotClassification(
      {
        model: HF_ZEROSHOT_MODEL,
        inputs: trimmed,
        parameters: {
          candidate_labels: [...NEGATIVE_HYPOTHESES],
          multi_label: true,
        },
      },
      { signal: AbortSignal.timeout(HF_TIMEOUT_MS) },
    );

    const negElements = Array.isArray(negativeOut) ? negativeOut : [];
    let negTopScore = 0;
    for (const el of negElements) {
      const score = typeof el?.score === "number" ? el.score : 0;
      if (score > negTopScore) negTopScore = score;
    }

    // Si fortement négatif → rejet
    if (negTopScore >= SEMANTIC_THRESHOLD) {
      return null; // Pattern négatif détecté par HF
    }

    // Classification positive
    const hypotheses = OUTREACH_HYPOTHESES.map(h => h.label);
    const out = await huggingface.zeroShotClassification(
      {
        model: HF_ZEROSHOT_MODEL,
        inputs: trimmed,
        parameters: {
          candidate_labels: hypotheses,
          multi_label: true,
        },
      },
      { signal: AbortSignal.timeout(HF_TIMEOUT_MS) },
    );

    const elements = Array.isArray(out) ? out : [];

    // Trouver le meilleur match
    let bestScore = 0;
    let bestLabel = "";
    for (const el of elements) {
      const score = typeof el?.score === "number" ? el.score : 0;
      const label = typeof el?.label === "string" ? el.label : "";
      if (score > bestScore) {
        bestScore = score;
        bestLabel = label;
      }
    }

    // Si score < threshold → inconnu
    if (bestScore < SEMANTIC_THRESHOLD) {
      return null;
    }

    // Mapper vers l'intent
    const matched = OUTREACH_HYPOTHESES.find(h => h.label === bestLabel);
    if (!matched) {
      return null;
    }

    // Non-admin: seulement navigation autorisée
    if (!isAdmin && matched.intent !== "open_outreach") {
      return null;
    }

    return {
      intent: matched.intent,
      confidence: bestScore,
      topLabel: bestLabel,
      action: matched.action,
      channel: matched.channel,
      reason: matched.reason,
    };

  } catch {
    // Fail-open: erreur HF = pas d'opinion
    return null;
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Classification semantic fallback pour intents Outreach ambigus.
 *
 * Appeler UNIQUEMENT quand le regex déterministe retourne null.
 *
 * @returns Décision si HF confiant, null sinon (passer à no_action)
 */
export async function classifyOutreachIntentSemantic(
  ctx: OutreachIntentContext,
): Promise<OutreachAgentDecision | null> {
  const { message, isAdmin } = ctx;

  const semantic = await classifySemantic(message, isAdmin);
  if (!semantic) {
    return null;
  }

  const normalized = message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const isFrench = /\b(ouvre|va|créer|rédiger|relancer|campagn|prospect)\b/i.test(message);

  const route = semantic.action === "navigate" ? "/admin/outreach" : undefined;
  const canvasKey = semantic.action === "open_canvas" ? "outreach" : undefined;

  const safetyWarnings: string[] = [];
  if (semantic.confidence < 0.9) {
    safetyWarnings.push(`Score semantic: ${(semantic.confidence * 100).toFixed(1)}% — vérification recommandée`);
  }

  return {
    intent: semantic.intent,
    source: "semantic_hf",
    confidence: "medium",
    action: semantic.action,
    route,
    canvasKey,
    channel: semantic.channel,
    sendAllowed: false,
    requiresUserReview: true,
    reason: semantic.reason,
    safetyWarnings,
    normalizedInput: normalized,
    semanticScore: semantic.confidence,
  };
}

/**
 * Vérifie si le classification semantic est disponible.
 */
export function isSemanticClassificationAvailable(): boolean {
  return HF_AVAILABLE;
}
