import "server-only";

import type { CanvasId } from "@/lib/canvas/contract";

/**
 * Canvas guidance — the system-prompt block injected when an agent-canvas is
 * open, so the chat agent KNOWS which workshop it is in and guides the operator
 * through the structured, human-in-the-loop steps (instead of answering a
 * follow-up like "on commence comment" as a blank generic chat).
 *
 * Server-only: appended to the system prompt in the cockpit-chat route. Never
 * shipped to the client. Describes the steps + the editable fields so the agent
 * can both GUIDE and, when the operator gives values, name the fields it fills.
 */

interface CanvasGuidance {
  title: string;
  /** Ordered, human-readable steps the agent walks the operator through. */
  steps: string[];
  /** Editable field keys the agent can fill from the conversation. */
  fillableFields: string[];
  /** Hard guardrails restated so the agent never oversells. */
  guardrails: string[];
}

const GUIDANCE: Record<CanvasId, CanvasGuidance> = {
  outreach: {
    title: "Outreach — campaign workspace",
    steps: [
      "Nommer la campagne et choisir son type (cold ou newsletter).",
      "Créer le brouillon de campagne (bouton « Create campaign draft » — rien n'est envoyé).",
      "Sourcer des leads distributeurs contre l'ICP active (bouton « Source 20 leads » — création de prospects à revoir, aucun email).",
      "Rédiger un email par prospect (demande l'identifiant du prospect).",
      "Déclencher un envoi gouverné (bouton « Trigger a governed send run »).",
    ],
    fillableFields: ["name (nom de campagne)", "kind (cold | newsletter)"],
    guardrails: [
      "Chaque écriture est en deux temps (préparer puis confirmer) — tu ne déclenches jamais une action toi-même.",
      "Tier A n'est JAMAIS envoyé automatiquement ; en mode SUGGEST rien ne part.",
      "Tu ne peux pas relever le niveau d'autonomie outreach.",
    ],
  },
  "create-vault": {
    title: "New vault — draft workspace",
    steps: [
      "Définir l'identité : ticker, nom, stratégie.",
      "Cadrer la pile de capital : allocation des 4 sleeves (somme = 100%), fourchette d'APY (toujours une plage), frais, lock-up.",
      "Définir le quorum de signataires.",
      "Créer le vault en brouillon (bouton « Create vault draft » — DRAFT uniquement, jamais live).",
    ],
    fillableFields: ["ticker", "name", "strategy", "targetApy (plage)"],
    guardrails: [
      "Le vault est créé en brouillon UNIQUEMENT ; passer en live est une étape séparée multi-signataires, hors de ce canvas.",
      "L'APY est TOUJOURS une plage, jamais un point unique.",
      "Aucune action financière ou custodiale depuis ce canvas.",
    ],
  },
  "lp-yield-explainer": {
    title: "How the yield works",
    steps: [
      "Expliquer la source du rendement : revenue-share du mining BTC dans une réserve USDC.",
      "Décrire les distributions mensuelles en USDC.",
      "Donner la fourchette cible et les hypothèses sous-jacentes.",
    ],
    fillableFields: [],
    guardrails: [
      "Lecture seule : aucune action, aucun bouton.",
      "Toujours présenter l'APY comme une plage et rappeler que les projections ne sont pas garanties.",
    ],
  },
};

/**
 * Build the canvas-awareness system block for an open canvas, or null for an
 * unknown id (defensive — the caller already validated `canvasId`).
 */
export function buildCanvasGuidanceBlock(canvasId: CanvasId): string {
  const g = GUIDANCE[canvasId];
  if (!g) return "";
  const lines = [
    `--- ATELIER CANVAS ACTIF : ${g.title} ---`,
    "L'opérateur travaille dans cet atelier (page centrale). Tu n'es PAS un chat générique :",
    "guide-le étape par étape, propose la prochaine action concrète, et reste dans le périmètre de l'atelier.",
    "",
    "Étapes de l'atelier :",
    ...g.steps.map((s, i) => `${i + 1}. ${s}`),
  ];
  if (g.fillableFields.length > 0) {
    lines.push(
      "",
      "Champs que tu peux pré-remplir quand l'opérateur te donne l'information (ils apparaissent dans la page) :",
      ...g.fillableFields.map((f) => `- ${f}`),
      "Quand l'opérateur fournit une valeur (ex : « appelle-la Distributeurs Q3, en cold »), confirme-la en une phrase ; elle se reporte dans le canvas.",
    );
  }
  lines.push(
    "",
    "Garde-fous (rappelle-les si pertinent, ne les contredis jamais) :",
    ...g.guardrails.map((r) => `- ${r}`),
    "",
    "Si l'opérateur demande « on commence comment / par quoi », réponds par la première étape concrète, pas par une question vague.",
  );
  // ROUTE-2 — at OPENING, ask for the required fields when they are missing,
  // and NEVER announce an automatic action. The chat must accuse réception,
  // explain what is open, and ask the missing required fields — without
  // inventing values, creating drafts, sourcing leads, or sending anything.
  if (g.fillableFields.length > 0) {
    lines.push(
      "",
      "À l'OUVERTURE de l'atelier : accuse réception, dis ce que tu ouvres, puis DEMANDE les champs requis manquants (ne les invente JAMAIS).",
      "Pour une campagne outreach, les champs requis sont le NOM de campagne et le TYPE (cold | newsletter) ; tant qu'ils manquent, demande-les et NE propose PAS de créer le brouillon.",
    );
  }
  lines.push(
    "",
    "RÈGLE ABSOLUE — n'annonce JAMAIS que tu vas exécuter une action toi-même.",
    "Tu ne dis pas « je vais sourcer les leads maintenant », « je crée la campagne », « j'envoie » : INTERDIT.",
    "Chaque action (créer le brouillon, sourcer des leads, rédiger, envoyer) passe par un bouton de confirmation explicite de l'opérateur.",
    "Après une création, décris ce qui a été fait, rappelle que rien n'a été sourcé/rédigé/envoyé, et PROPOSE la prochaine étape SOUS RÉSERVE de confirmation (« souhaites-tu… ? cette étape demandera une confirmation »).",
  );
  return lines.join("\n");
}
