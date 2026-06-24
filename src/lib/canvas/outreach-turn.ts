/**
 * Deterministic Outreach turn — router + canonical copy (NO LLM).
 *
 * The Outreach campaign-setup conversation must be reliable, so its critical
 * turns are handled by a deterministic state machine, not by prompting the
 * model. This module owns:
 *   - the regex intent classifier (does this message open / drive the workshop?);
 *   - the template assistant copy for each structured step.
 *
 * Pure (no fs / prisma / network) so BOTH the server route and the client action
 * button can import it. Field extraction (name / kind) lives in
 * `deriveOutreachValuesFromObjective` (compose.ts) — the single canonical source.
 */

/**
 * Outreach-campaign OPEN/SETUP intent. Matches a campaign-setup phrasing, never
 * a plain read question ("combien de prospects ?"). Requires "campagne"/"campaign"
 * to co-occur with an outreach/prospection/distributor cue, OR a creation verb on
 * a campaign — so the word "outreach" alone (e.g. "c'est quoi l'outreach ?") does
 * NOT open the workshop.
 */
const OUTREACH_INTENT_RE =
  /\b(?:campagne|campaign)\b[^.?!]*\b(?:outreach|prospection|distributeurs?)\b|\b(?:outreach|prospection)\b[^.?!]*\b(?:campagne|campaign|leads?|prospects?|distributeurs?)\b|\b(?:lance[rz]?|d[ée]marre[rz]?|pr[ée]pare[rz]?|monte[rz]?|cr[ée]e?[rz]?|set\s*up|start)\b[^.?!]*\b(?:campagne|campaign)\b/i;

export interface OutreachIntent {
  isOutreach: boolean;
  /** The audience the operator named, when extractable (e.g. "distributeurs institutionnels"). */
  target?: string;
  /** The product the campaign is about, when extractable (e.g. "Hearst Yield"). */
  product?: string;
}

function clean(value: string): string {
  return value
    .replace(/[\x00-\x1F\x7F]/g, "")
    .replace(/["“«»”]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

/**
 * Classify whether a message opens / drives the Outreach campaign workshop, and
 * best-effort extract the target + product for the template copy. Deterministic
 * and pure — no LLM, never throws.
 */
export function classifyOutreachIntent(message: string): OutreachIntent {
  const text = typeof message === "string" ? message : "";
  if (!OUTREACH_INTENT_RE.test(text)) return { isOutreach: false };

  let target: string | undefined;
  let product: string | undefined;

  // Canonical shape: "… outreach <TARGET> pour <PRODUCT>".
  const both = /outreach\s+(.+?)\s+pour\s+(.+?)\s*[.!?]*\s*$/i.exec(text);
  if (both?.[1] && both[2]) {
    target = clean(both[1]);
    product = clean(both[2]);
  } else {
    const t = /\b(distributeurs?(?:\s+institutionnels?)?(?:\s+\w+)?)/i.exec(text);
    if (t?.[1]) target = clean(t[1]);
    const p = /\bpour\s+(.+?)\s*[.!?]*\s*$/i.exec(text);
    if (p?.[1]) product = clean(p[1]);
  }

  return {
    isOutreach: true,
    ...(target ? { target } : {}),
    ...(product ? { product } : {}),
  };
}

/**
 * Turn 1 — the workshop is open but the required fields (name + kind) are
 * missing. Deterministic question asking exactly for the campaign name and the
 * kind. Mentions the target/product when they were extractable.
 */
export function buildOutreachAskFieldsMessage(args: {
  target?: string;
  product?: string;
}): string {
  const { target, product } = args;
  const scope =
    target && product
      ? `pour une campagne ciblant les ${target} autour de ${product}`
      : target
        ? `pour une campagne ciblant les ${target}`
        : product
          ? `pour une campagne autour de ${product}`
          : "pour une nouvelle campagne de prospection distributeurs";
  return (
    `J'ouvre le workspace Outreach ${scope}. ` +
    "Pour créer le draft, quel nom veux-tu donner à la campagne, et souhaites-tu un type `cold` ou `newsletter` ?"
  );
}

/**
 * Turn 2 — the operator supplied both required fields. Deterministic
 * acknowledgement that the Create-campaign-draft button is now available and
 * that NOTHING is created until they confirm. Never announces an auto action.
 */
export function buildOutreachFieldsAckMessage(args: {
  name: string;
  kind: "cold" | "newsletter";
}): string {
  return (
    `C'est noté : campagne « ${args.name} », type \`${args.kind}\`. ` +
    "Le bouton « Create campaign draft » est disponible dans le workspace — rien n'est créé tant que tu ne confirmes pas. " +
    "Aucun lead n'est sourcé et aucun email n'est rédigé ou envoyé à cette étape."
  );
}

/**
 * Post-draft — emitted AFTER a successful create_campaign_draft confirmation.
 * Deterministic so the model can never improvise "je vais sourcer". States what
 * was done, that nothing was sourced/sent, and proposes the next step UNDER
 * explicit confirmation.
 */
export function buildOutreachPostDraftMessage(name: string): string {
  const safeName = clean(name) || name;
  return (
    `Le brouillon de campagne \`${safeName}\` a été créé en statut draft. ` +
    "Aucun lead n'a été sourcé, aucun email n'a été rédigé ou envoyé. " +
    "Souhaites-tu maintenant préparer le sourcing de leads ? Cette étape demandera une confirmation explicite."
  );
}
