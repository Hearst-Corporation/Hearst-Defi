/**
 * Deterministic Intent Router v2 — rule tables.
 *
 * Every `re` runs against the NORMALIZED input (lowercase, accent-stripped,
 * apostrophes→space, single-spaced). Rules are grouped by tier; the router
 * evaluates the tiers in a fixed priority order (see intent-router.ts):
 *
 *   cancellation/confirmation (standalone) → DANGEROUS (deploy/send/source/…)
 *   → outreach → product/vault → reporting → navigation → education → unknown
 *
 * The DANGEROUS tier is FIRST among content rules on purpose: a critical intent
 * ("déploie ce produit", "envoie aux prospects") must be caught and refused even
 * if it also contains an education- or nav-ish word. The router NEVER emits an
 * `allow_*` policy for a dangerous rule.
 *
 * v2 changes:
 * - More precise dangerous intent detection (deploy, sign, governance, migrate,
 *   change formula, change model).
 * - Better outreach setup/draft distinction.
 * - Education rules expanded for product/yield/risk questions.
 * - Navigation augmentation covers more phrasings.
 *
 * Pure: no I/O.
 */

import type { IntentRule } from "@/lib/agentic/intent-router-types";

// ---------------------------------------------------------------------------
// Standalone confirmation / cancellation — matched on the WHOLE normalized
// string so "go to vaults" never matches `^go$`, and "annule la campagne"
// still reads as a cancel.
// ---------------------------------------------------------------------------

// Cancellation may carry an object ("annule la campagne") → prefix-anchored.
export const CANCELLATION_RE =
  /^(?:non|annule|annuler|annulons|cancel|stop|stoppe|abandonne|abandonner|laisse tomber|abort|nope)\b/;

// Confirmation must be the WHOLE message, otherwise "go to vaults" / "ok ouvre les
// vaults" would read as a confirmation instead of navigation. Anchored ^…$.
// v2: "vas-y" and "allez-y" are confirmation ONLY when standalone (no other words).
export const CONFIRMATION_RE =
  /^(?:oui|ouais|confirme|confirmer|confirmons|confirm|ok|okay|d accord|daccord|vas y|allez y|allez|go|c est bon|cest bon|parfait|valide|valider|yes|yep|yup)$/;

// ---------------------------------------------------------------------------
// DANGEROUS — deploy / go-live / send / source / sign / governance / migrate /
// change-formula / change-model. Always refused-autonomous; never `allow_*`.
// ---------------------------------------------------------------------------

export const DANGEROUS_RULES: readonly IntentRule[] = [
  {
    id: "deploy.go_live",
    kind: "deploy_request",
    actionPolicy: "refuse_autonomous",
    riskLevel: "critical",
    re: /\b(deploie|deployer|deployez|deploy|deployes?|mets? (?:ce |le |la )?(?:produit|vault|strategie|produit|offre).* en ligne|met en ligne|mise en ligne|publie|publier|publish|go live|passe.* (?:en )?(?:live|production|prod)|lance.* (?:en )?production|mark.* live|marque.* live|mets? live|mise en prod|mettre en ligne)\b/,
    requiresLLM: false,
    requiresCanvas: false,
    requiresHumanGate: true,
    prohibitedAutonomousAction: true,
    reason:
      "Mise en ligne / déploiement : action critique jamais exécutée depuis le chat (gouvernance multi-signataires hors chat).",
  },
  {
    id: "deploy.sign_tx",
    kind: "deploy_request",
    actionPolicy: "refuse_autonomous",
    riskLevel: "critical",
    re: /\b(signe|signer|sign).*(transaction|tx|operation|onchain|on chain)\b|\bexecute.*(transaction|tx)\b|\b(envoie|envoyer|send|broadcast).*(transaction|tx|on chain|onchain)\b/,
    requiresLLM: false,
    requiresCanvas: false,
    requiresHumanGate: true,
    prohibitedAutonomousAction: true,
    reason:
      "Signature / transaction on-chain : aucune action custodiale ou on-chain possible depuis le chat.",
  },
  {
    id: "deploy.execute_governance",
    kind: "deploy_request",
    actionPolicy: "refuse_autonomous",
    riskLevel: "critical",
    re: /\bexecute.*(governance|gouvernance|proposal|proposition)\b|\b(execute|applique|appliquer).* (la )?gouvernance\b/,
    requiresLLM: false,
    requiresCanvas: false,
    requiresHumanGate: true,
    prohibitedAutonomousAction: true,
    reason:
      "Exécution de gouvernance : décision humaine multi-signataires, jamais auto-exécutée par le chat.",
  },
  {
    id: "deploy.migrate_or_change_core",
    kind: "deploy_request",
    actionPolicy: "refuse_autonomous",
    riskLevel: "critical",
    re: /\bmigrate (database|db|schema)\b|\bmigre (la )?(base|db)\b|\bchange (la |le )?(formule|formula|methodologie|methodology|modele|model)\b|\bchanger (la |le )?(formule|methodologie|modele)\b/,
    requiresLLM: false,
    requiresCanvas: false,
    requiresHumanGate: true,
    prohibitedAutonomousAction: true,
    reason:
      "Migration DB / changement de formule ou de modèle : opération hors chat, jamais auto-exécutée.",
  },
];

// ---------------------------------------------------------------------------
// SEND / SOURCE — outreach actions, always behind the human gate (Tier A never
// auto-sent; suppression + cap re-checked at send). Refused autonomously.
// ---------------------------------------------------------------------------

export const SEND_SOURCE_RULES: readonly IntentRule[] = [
  {
    id: "outreach.send",
    kind: "send_request",
    actionPolicy: "requires_human_gate",
    riskLevel: "high",
    re: /\b(envoie|envoyer|envoi|envoyez|expedie|expedier|send|dispatch).*(prospects?|campagne|campaign|email|emails|mail|mails|outreach|leads?|newsletter)\b|\bsend (the |la )?(campaign|campagne)\b|\b(envoie|envoyer).* (la |le )?(campagne|run)\b/,
    requiresLLM: false,
    requiresCanvas: false,
    requiresHumanGate: true,
    prohibitedAutonomousAction: true,
    targetCrew: "outreach",
    reason:
      "Envoi outreach : jamais auto-déclenché. Reste derrière le human gate (Tier A jamais envoyé, cap + suppression).",
  },
  {
    id: "outreach.source",
    kind: "source_request",
    actionPolicy: "requires_human_gate",
    riskLevel: "high",
    re: /\b(source|sourcer|sources|sourcez).*(prospects?|leads?|distributeurs?|contacts?)\b|\b(trouve|trouver|find|cherche|chercher|recupere|recuperer).*(prospects?|leads?)\b|\bsource (some )?(leads?|prospects?)\b/,
    requiresLLM: false,
    requiresCanvas: false,
    requiresHumanGate: true,
    prohibitedAutonomousAction: true,
    targetCrew: "outreach",
    reason:
      "Sourcing de prospects : action gated, jamais auto-exécutée depuis le chat.",
  },
];

// ---------------------------------------------------------------------------
// OUTREACH setup / draft (non-send). Setup opens a canvas to collect fields;
// draft is the HITL draft-only write. The MORE SPECIFIC draft rule is first.
// ---------------------------------------------------------------------------

export const OUTREACH_RULES: readonly IntentRule[] = [
  {
    id: "outreach.draft",
    kind: "outreach_draft",
    actionPolicy: "allow_draft_only",
    riskLevel: "medium",
    re: /\b(cree|creer|create|prepare|preparer|draft|redige|rediger).*(draft )?.*(campagne|campaign).*(nomm|appel|name|cold|newsletter|froide)\b|\bdraft (a )?(cold )?(outreach )?(campaign|campagne)\b/,
    requiresLLM: false,
    requiresCanvas: true,
    requiresHumanGate: true,
    prohibitedAutonomousAction: false,
    canvasKey: "outreach",
    targetCrew: "outreach",
    reason:
      "Création d'un draft de campagne (champs fournis) : canvas + draft-only derrière HITL. N'envoie ni ne source rien.",
  },
  {
    id: "outreach.setup",
    kind: "outreach_setup",
    actionPolicy: "allow_canvas",
    riskLevel: "low",
    re: /\b(lance|lancer|prepare|preparer|cree|creer|create|configure|mets en place|monte|monter).*(campagne|campaign)\b|\bcampagne (outreach|de prospection|newsletter)\b|\boutreach\b.*(campagne|campaign|distributeur|distributeurs|investisseur|pipeline)\b|\b(create|set up|setup).*(outreach)\b/,
    requiresLLM: false,
    requiresCanvas: true,
    requiresHumanGate: false,
    prohibitedAutonomousAction: false,
    canvasKey: "outreach",
    targetCrew: "outreach",
    reason:
      "Cadrage d'une campagne outreach : ouvre l'atelier canvas pour collecter les champs. Aucun envoi, aucun sourcing.",
  },
];

// ---------------------------------------------------------------------------
// PRODUCT / VAULT. Readiness (read-only check) is FIRST so "vérifie si ce vault
// est prêt" never reads as a product_draft creation.
// ---------------------------------------------------------------------------

export const PRODUCT_VAULT_RULES: readonly IntentRule[] = [
  {
    id: "vault.readiness",
    kind: "vault_readiness",
    actionPolicy: "allow_readonly",
    riskLevel: "none",
    re: /\b(verifie|verifier|check|analyse|analyser|evalue|evaluer).*(complet|completude|completeness|readiness|pret|prete|prets|ready)\b|\bvault readiness\b|\b(ce |le )?(vault|produit).* (est|sont).* (pret|prete|prets|ready)\b|\banalyse.* (la )?completude\b/,
    requiresLLM: true,
    requiresCanvas: false,
    requiresHumanGate: false,
    prohibitedAutonomousAction: false,
    targetCrew: "product",
    reason:
      "Vérification de complétude / readiness d'un vault : lecture seule. Aucune mise en ligne.",
  },
  {
    id: "product.draft",
    kind: "product_draft",
    actionPolicy: "allow_canvas",
    riskLevel: "medium",
    re: /\b(cree|creer|create|prepare|preparer|nouveau|nouvelle|monte|monter|build|structure|structurer).*(produit|product|vault|offre|strategie)\b|\bnew (product|vault)\b|\b(produit|vault) hearst\b/,
    requiresLLM: false,
    requiresCanvas: true,
    requiresHumanGate: true,
    prohibitedAutonomousAction: false,
    canvasKey: "create-vault",
    targetCrew: "product",
    reason:
      "Cadrage / création d'un produit ou vault : ouvre le canvas create-vault. Le draft reste DRAFT-only derrière HITL ; aucune mise en ligne.",
  },
];

// ---------------------------------------------------------------------------
// REPORTING — read-only generation of a brief / report / memo.
// ---------------------------------------------------------------------------

export const REPORTING_RULES: readonly IntentRule[] = [
  {
    id: "reporting.request",
    kind: "reporting_request",
    actionPolicy: "allow_readonly",
    riskLevel: "none",
    re: /\b(genere|generer|generate|prepare|preparer|fais|fait|donne|donne moi|build|produis|produire).*(rapport|reporting|brief|briefing|report|memo|resume|synthese)\b|\b(daily|weekly) brief\b/,
    requiresLLM: true,
    requiresCanvas: false,
    requiresHumanGate: false,
    prohibitedAutonomousAction: false,
    targetCrew: "reporting",
    reason: "Génération d'un brief/rapport : lecture seule, aucune action.",
  },
];

// ---------------------------------------------------------------------------
// EDUCATION — read-only explanations. Yield / product / risk / generic.
// Always allow_readonly; the LLM still writes the prose, but the decision marks
// it read-only-safe so the compliance layer knows it is educational (no false
// "blocked" on a compliant educational answer).
//
// v2: Expanded to catch more phrasings and avoid false positives from nav verbs.
// ---------------------------------------------------------------------------

const EXPLAIN_LEAD =
  "(?:explique|expliquer|explique moi|explain|explain me|c est quoi|cest quoi|qu est ce que|qu est ce qu|comment (?:ca )?(?:marche|marchent|fonctionne|fonctionnent)|how (?:does|do)|what (?:is|are)|difference entre|quelle est la difference|quels? sont)";

// Navigation verbs that should NOT trigger education when combined with explain
// (e.g. "explique et ouvre les vaults" is nav, not education)
const NAV_VERB =
  "(?:ouvre|ouvrir|va|vas|aller|affiche|montre|navigue|accede|amene|emmene|voir|consulte|open|go|take|bring|show|view|redirect)";

export const EDUCATION_RULES: readonly IntentRule[] = [
  {
    id: "edu.yield",
    kind: "yield_explanation",
    actionPolicy: "allow_readonly",
    riskLevel: "none",
    re: new RegExp(
      `\\b${EXPLAIN_LEAD}\\b.*\\b(yield|rendement|rendements|apy|interets?)\\b|\\b(yield|rendement)\\b.*\\b(c est quoi|comment (?:ca )?(?:marche|fonctionne))\\b`,
    ),
    requiresLLM: true,
    requiresCanvas: false,
    requiresHumanGate: false,
    prohibitedAutonomousAction: false,
    reason: "Question éducative read-only sur le rendement / yield.",
  },
  {
    // Risk BEFORE product so "explique les risques d'un produit" reads as a risk
    // question, not a product overview (it contains "produit" too).
    id: "edu.risk",
    kind: "risk_explanation",
    actionPolicy: "allow_readonly",
    riskLevel: "none",
    re: new RegExp(
      `\\b${EXPLAIN_LEAD}\\b.*\\b(risque|risques|risk|risks)\\b|\\b(risque|risques)\\b.*\\b(produit|vault|yield|rendement)\\b`,
    ),
    requiresLLM: true,
    requiresCanvas: false,
    requiresHumanGate: false,
    prohibitedAutonomousAction: false,
    reason: "Question éducative read-only sur les risques.",
  },
  {
    id: "edu.product",
    kind: "product_explanation",
    actionPolicy: "allow_readonly",
    riskLevel: "none",
    re: new RegExp(
      `\\b${EXPLAIN_LEAD}\\b.*\\b(produit|produits|product|products|vault|vaults|offre|offres|strategie)\\b|\\b(produit|vault)\\b.*\\b(c est quoi|comment (?:ca )?(?:marche|fonctionne))\\b`,
    ),
    requiresLLM: true,
    requiresCanvas: false,
    requiresHumanGate: false,
    prohibitedAutonomousAction: false,
    reason: "Question éducative read-only sur les produits / vaults.",
  },
  {
    id: "edu.generic",
    kind: "education",
    actionPolicy: "allow_readonly",
    riskLevel: "none",
    re: new RegExp(`\\b${EXPLAIN_LEAD}\\b`),
    requiresLLM: true,
    requiresCanvas: false,
    requiresHumanGate: false,
    prohibitedAutonomousAction: false,
    reason: "Question éducative read-only générale.",
  },
];
