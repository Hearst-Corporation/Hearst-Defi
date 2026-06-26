/**
 * Outreach Regex Router — deterministic, stateful, zero-LLM.
 *
 * Handles campaign-workflow turns that must NOT go through the LLM:
 *   - Detecting a new outreach/campaign-setup intent
 *   - Extracting campaign name + kind from any user phrasing
 *   - Detecting when the user says "you already asked that"
 *   - Detecting navigation requests for an existing campaign
 *   - Separating lead-sourcing requests from campaign navigation
 *   - Resolving the correct admin route for a campaign
 *   - Maintaining an honest workflow state (draft never claimed without an id)
 *
 * Pure: no I/O, no async, no fetch, no LLM, never throws (all paths return a value).
 * Safe to import from both server routes and test files.
 */

// ---------------------------------------------------------------------------
// 1. Outreach-start detection
// ---------------------------------------------------------------------------

const OUTREACH_START_PATTERNS = [
  /\b(on\s+va\s+faire|fais|lance[rz]?|cr[eé][eé][rz]?|prepare[rz]?|pr[eé]pare[rz]?|monte[rz]?|ouvre[rz]?|set\s*up|start|commence[rz]?)\b.{0,40}\b(outreach|campagne|campaign)\b/i,
  /\b(outreach|campagne|campaign)\b.{0,30}\b(cold|newsletter)\b/i,
  /\bfaire\s+un\s+outreach\b/i,
  /\boutreach\s+campaign\b/i,
  /\b(outreach|campagne|campaign)\b.{0,20}\b(distributeurs?|prospects?|leads?)\b/i,
];

/**
 * Returns true when the message is a campaign-creation/start intent.
 * Does NOT match pure navigation ("ouvre la campagne déjà créée") — navigation
 * patterns are checked separately by isCampaignNavRequest.
 */
export function isOutreachStart(text: string): boolean {
  if (typeof text !== "string" || text.length === 0) return false;
  return OUTREACH_START_PATTERNS.some((re) => re.test(text));
}

// ---------------------------------------------------------------------------
// 2. Campaign slot extraction
// ---------------------------------------------------------------------------

export type CampaignSlots = {
  campaignName?: string;
  campaignType?: "cold" | "newsletter";
  missing: Array<"campaignName" | "campaignType">;
};

// Kind patterns — must match before name patterns to avoid eating "cold" as a name word.
const KIND_RE = /\b(newsletter|cold)\b/i;

// Name extraction: explicit label first, then positional heuristics.
// Priority 1: after "nommée / named / called / nom: / appelle[-]la"
const NAME_LABEL_RE =
  /(?:nomm[eé][eé]?|appel[eé][eé]?|named|called|nom\s*[:=]|appelle[- ]?(?:la|le))\s*[«""]?\s*([^«""»\n,]{2,100})/i;

// Priority 2: after "Campagne" or "Campaign" keyword (strip leading keyword)
const NAME_AFTER_CAMPAIGN_RE =
  /\b(?:campagne|campaign)\s+([A-Za-zÀ-ÿÀ-ž][A-Za-zÀ-ÿÀ-ž0-9 _\-]*?)(?:\s+(?:cold|newsletter)|[,;.!?]|$)/i;

// Priority 3: bare input without campaign/outreach keyword — treat the whole thing as a name
// (only if it doesn't look like an intent sentence with a verb)
const VERB_RE =
  /\b(on\s+va|lance[rz]?|cr[eé]e[rz]?|pr[eé]pare[rz]?|fais|faire|ouvre[rz]?|commence[rz]?|start|set\s*up|d[eé]marre[rz]?|monte[rz]?)\b/i;

// Words that should never be treated as a campaign name on their own
const NOISE_ONLY_RE = /^(outreach|prospection|distributeurs?)$/i;

function extractKind(text: string): "cold" | "newsletter" | undefined {
  const m = KIND_RE.exec(text);
  if (!m?.[1]) return undefined;
  return m[1].toLowerCase() === "newsletter" ? "newsletter" : "cold";
}

function cleanName(raw: string): string {
  return raw
    .replace(/[«»"""]/g, "")
    .replace(/\b(cold|newsletter)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[,;.!?]+$/, "")
    .trim();
}

/**
 * Extracts campaign name and kind from a free-text user message.
 * Returns a CampaignSlots with `missing` listing any absent required fields.
 *
 * Handles:
 *   "Adrien test cold"         → { campaignName:"Adrien test", campaignType:"cold", missing:[] }
 *   "Qatar LP newsletter"      → { campaignName:"Qatar LP", campaignType:"newsletter", missing:[] }
 *   "cold"                     → { campaignType:"cold", missing:["campaignName"] }
 *   "newsletter"               → { campaignType:"newsletter", missing:["campaignName"] }
 *   "Adrien test"              → { campaignName:"Adrien test", missing:["campaignType"] }
 *   "Campagne Adrien test cold"→ { campaignName:"Adrien test", campaignType:"cold", missing:[] }
 *   "campaign Adrien test cold"→ { campaignName:"Adrien test", campaignType:"cold", missing:[] }
 */
export function parseOutreachCampaignSlots(text: string): CampaignSlots {
  if (typeof text !== "string" || text.length === 0) {
    return { missing: ["campaignName", "campaignType"] };
  }

  const kind = extractKind(text);

  // Remove the kind word from text before extracting name so it doesn't bleed in.
  const textWithoutKind = text.replace(KIND_RE, "").replace(/\s+/g, " ").trim();

  let name: string | undefined;

  // Priority 1 — explicit label ("nommée X", "appelle-la Y", etc.)
  const label = NAME_LABEL_RE.exec(text);
  if (label?.[1]) {
    name = cleanName(label[1]);
  }

  // Priority 2 — after "Campagne" / "Campaign" keyword
  // Guard: the captured word must not be a noise/intent word (e.g. "outreach"
  // after "campagne outreach" must not become the campaign name).
  if (!name) {
    const afterKw = NAME_AFTER_CAMPAIGN_RE.exec(text);
    if (afterKw?.[1]) {
      const candidate = cleanName(afterKw[1]);
      if (!NOISE_ONLY_RE.test(candidate) && !VERB_RE.test(candidate)) {
        name = candidate;
      }
    }
  }

  // Priority 3 — strip known prefixes, check if the remainder isn't just a kind word
  if (!name) {
    // Remove leading "Campagne", "Campaign", "outreach" noise
    const stripped = textWithoutKind
      .replace(/^\b(campagne|campaign|outreach)\b\s*/i, "")
      .trim();

    // Only use as a name if:
    // - something remains
    // - it's not a single-word intent verb
    // - it's not purely a kind word (already extracted above)
    if (
      stripped.length >= 2 &&
      !VERB_RE.test(stripped) &&
      !/^(cold|newsletter)$/i.test(stripped) &&
      !NOISE_ONLY_RE.test(stripped)
    ) {
      name = cleanName(stripped);
    }
  }

  if (name && name.length < 2) name = undefined;

  const missing: Array<"campaignName" | "campaignType"> = [];
  if (!name) missing.push("campaignName");
  if (!kind) missing.push("campaignType");

  return {
    ...(name ? { campaignName: name } : {}),
    ...(kind ? { campaignType: kind } : {}),
    missing,
  };
}

// ---------------------------------------------------------------------------
// 3. User-correction detection
// ---------------------------------------------------------------------------

const ALREADY_GIVEN_RE =
  /tu\s+m[' ]?as\s+d[eé]j[aà]\s+demand[eé]|je\s+t[' ]?ai\s+d[eé]j[aà]\s+donn[eé]|c[' ]?est\s+d[eé]j[aà]\s+rempli|tu\s+l[' ]?as\s+d[eé]j[aà]\s+rempli|d[eé]j[aà]\s+dit/i;

/**
 * Returns true when the user is telling the assistant it already asked for /
 * already has this information. Triggers a slot-state reuse path rather than
 * re-asking.
 */
export function isUserCorrection(text: string): boolean {
  if (typeof text !== "string" || text.length === 0) return false;
  return ALREADY_GIVEN_RE.test(text);
}

// ---------------------------------------------------------------------------
// 4. Campaign-navigation detection
// ---------------------------------------------------------------------------

// Creation verbs that should NOT match as navigation
const CREATION_VERB_RE =
  /\b(on\s+va\s+faire|fais|lance[rz]?|cr[eé][eé][rz]?|prepare[rz]?|pr[eé]pare[rz]?|monte[rz]?|commence[rz]?|start|set\s*up)\b/i;

const CAMPAIGN_NAV_PATTERNS = [
  // Navigation verbs explicitly paired with "campaign/campagne/brouillon/draft"
  // Excluded: creation verbs (lance, crée, prépare) are not nav
  /(ouvre[rz]?|ouvre[- ]moi|montre[rz]?|affiche[rz]?|emm[eè]ne[rz]?|acc[eè]de[rz]?|va\s+sur|va\s+à)\b.{0,40}\b(campagne|campaign|brouillon|draft)\b/i,
  // Bare "la campagne" / "la campaign" — only when no creation verb present
  /\bla\s+(campagne|campaign)\b(?!\s+(?:de\s+prospection|distributeurs?))/i,
  /\ble\s+brouillon\b/i,
  /\bcampaign\s+draft\b/i,
  /je\s+(?:ne\s+)?(?:la\s+)?vois\s+(?:pas\s+)?(?:la\s+)?(campagne|campaign)/i,
  /o[uù]\s+est\s+(?:la\s+)?(campagne|campaign|brouillon|draft)/i,
  /pourquoi\s+(?:je\s+ne\s+)?(?:la\s+)?vois\s+pas\s+(?:la\s+)?(campagne|campaign)/i,
];

/**
 * Returns true when the user is asking to navigate to / show an existing campaign.
 * "La campagne" alone triggers navigation; "source leads" does NOT.
 * Creation intents ("on va faire une campagne", "lance une campagne") do NOT trigger navigation.
 */
export function isCampaignNavRequest(text: string): boolean {
  if (typeof text !== "string" || text.length === 0) return false;
  // If the message contains a creation verb, it is NOT a navigation request
  if (CREATION_VERB_RE.test(text)) return false;
  // Exclude sourcing requests (they share some campaign words)
  if (isSourcingRequest(text)) return false;
  return CAMPAIGN_NAV_PATTERNS.some((re) => re.test(text));
}

// ---------------------------------------------------------------------------
// 5. Sourcing-request detection
// ---------------------------------------------------------------------------

const SOURCING_RE =
  /\b(source[rz]?|sourc(?:ing|er)|trouve[rz]?|cherche[rz]?|find|import[erz]?|prospecte[rz]?)\b.{0,30}\b(leads?|prospects?|distributeurs?|contacts?)\b/i;

/**
 * Returns true when the user is asking to source / find leads.
 * "La campagne" and "Ouvre la campagne" do NOT trigger sourcing.
 */
export function isSourcingRequest(text: string): boolean {
  if (typeof text !== "string" || text.length === 0) return false;
  return SOURCING_RE.test(text);
}

// ---------------------------------------------------------------------------
// 6. Route resolver
// ---------------------------------------------------------------------------

export type OutreachCampaignRoute =
  | { kind: "campaign_detail"; href: string; reason: string }
  | { kind: "campaign_draft"; href: string; reason: string }
  | { kind: "outreach_workspace"; href: string; reason: string }
  | { kind: "missing_state"; reason: string };

/**
 * Resolves the best navigation target given current campaign workflow state.
 *
 * - If a real `campaignId` exists → /admin/outreach/<campaignId>
 * - If a draft was prepared but no id → /admin/outreach (workspace, with name query param)
 * - Otherwise → missing_state with a clear, targeted reason message (NEVER "section introuvable")
 */
export function resolveOutreachCampaignRoute(state: {
  campaignId?: string;
  campaignName?: string;
  campaignType?: string;
}): OutreachCampaignRoute {
  if (state.campaignId && state.campaignId.length > 0) {
    return {
      kind: "campaign_detail",
      href: `/admin/outreach/campaigns/${state.campaignId}`,
      reason: `Navigating to campaign ${state.campaignName ?? state.campaignId}`,
    };
  }

  if (state.campaignName) {
    const params = new URLSearchParams();
    params.set("name", state.campaignName);
    if (state.campaignType) params.set("kind", state.campaignType);
    return {
      kind: "campaign_draft",
      href: `/admin/outreach?${params.toString()}`,
      reason: `Opening outreach workspace for draft campaign "${state.campaignName}"`,
    };
  }

  return {
    kind: "outreach_workspace",
    href: "/admin/outreach",
    reason: "Opening the outreach workspace — no campaign name yet",
  };
}

// ---------------------------------------------------------------------------
// 7. Workflow state
// ---------------------------------------------------------------------------

export type OutreachWorkflowState = {
  workflow: "outreach_campaign";
  campaignName?: string;
  campaignType?: "cold" | "newsletter";
  /**
   * "none"     — no draft created yet (default).
   * "prepared" — fields collected, HITL button shown, user has NOT confirmed yet.
   * "created"  — user confirmed, server returned a real campaignId.
   *
   * INVARIANT: draftStatus stays "none" until the HITL button is confirmed by the
   * user (not just when both fields are present). It moves to "created" only when
   * a real campaignId is returned from the server.
   */
  draftStatus: "none" | "prepared" | "created";
  campaignId?: string;
  stagedActionId?: string;
};

/**
 * Reconstruct outreach workflow state from chat history.
 *
 * Scans all user messages in the history (chronologically) for campaign name
 * and type, merging slots as they appear. This lets the route handler recover
 * state without a persistent store — if the user said "Adrien test cold" two
 * turns ago, that slot is still available.
 *
 * Never throws. Returns a partial state (missing slots remain undefined).
 */
export function extractOutreachStateFromHistory(
  history: ReadonlyArray<{ role: string; content: string }>,
): OutreachWorkflowState {
  let state: OutreachWorkflowState = {
    workflow: "outreach_campaign",
    draftStatus: "none",
  };
  for (const msg of history) {
    if (msg.role !== "user") continue;
    const slots = parseOutreachCampaignSlots(msg.content);
    state = mergeOutreachState(state, slots);
  }
  return state;
}

// ---------------------------------------------------------------------------
// 8. Deterministic response template builders
// ---------------------------------------------------------------------------

/**
 * State-recap response — emitted when the user says "you already asked that".
 * Reads known slots from state and restates them honestly.
 */
export function buildOutreachStateRecapMessage(state: OutreachWorkflowState): string {
  const name = state.campaignName;
  const kind = state.campaignType;
  if (name && kind) {
    return (
      `J'ai bien : campagne « ${name} », type \`${kind}\`. ` +
      "Je continue avec ces informations — rien n'est créé tant que tu ne confirmes pas dans le workspace."
    );
  }
  if (name) {
    return (
      `J'ai bien le nom : « ${name} ». ` +
      "Il me manque encore le type (cold ou newsletter) pour préparer le draft."
    );
  }
  if (kind) {
    return (
      `J'ai bien le type : \`${kind}\`. ` +
      "Il me manque encore le nom de la campagne."
    );
  }
  return "Je n'ai pas encore les informations de la campagne. Quel nom et quel type (cold ou newsletter) souhaites-tu ?";
}

/**
 * Navigation ack — emitted when the user asks to open / view the campaign.
 * The actual navigation happens via publishNav; this is the chat bubble text.
 */
export function buildOutreachNavAckMessage(
  route: OutreachCampaignRoute,
  state: OutreachWorkflowState,
): string {
  const name = state.campaignName;
  if (route.kind === "campaign_detail") {
    return name
      ? `J'ouvre la campagne « ${name} » dans le console Outreach.`
      : "J'ouvre la campagne dans le console Outreach.";
  }
  if (route.kind === "campaign_draft") {
    return name
      ? `J'ouvre l'espace Outreach pour le draft « ${name} ».`
      : "J'ouvre l'espace Outreach.";
  }
  // outreach_workspace fallback
  return "J'ouvre l'espace Outreach.";
}

/**
 * Sourcing gate — emitted when the user asks to source leads while in the
 * outreach canvas. Sourcing is HITL-gated (action-readiness: confirmed_write).
 * This response explains without navigating or claiming any action was taken.
 */
export function buildOutreachSourcingGateMessage(state: OutreachWorkflowState): string {
  const name = state.campaignName;
  const base = name
    ? `Le sourcing de leads pour « ${name} » est une action confirmée-écriture`
    : "Le sourcing de leads est une action confirmée-écriture";
  return (
    `${base} — elle ne peut pas être lancée automatiquement depuis le chat. ` +
    "Pour démarrer le sourcing, utilise le bouton dédié dans le workspace Outreach après avoir créé le draft de campagne."
  );
}

/**
 * Merge new slot data into an existing (possibly partial) workflow state.
 *
 * INVARIANT: draftStatus is NEVER promoted by this function. Promotion to
 * "prepared" happens when both fields are collected AND the HITL button is
 * surfaced (done by the canvas compose layer). Promotion to "created" happens
 * only when the server confirms a real campaignId (not here).
 *
 * This function only adds/overrides campaignName/campaignType; everything else
 * is carried forward unchanged.
 */
export function mergeOutreachState(
  existing: Partial<OutreachWorkflowState>,
  newSlots: CampaignSlots,
): OutreachWorkflowState {
  return {
    workflow: "outreach_campaign",
    // Carry forward existing values, then overlay new ones (never overwrite with undefined).
    campaignName: newSlots.campaignName ?? existing.campaignName,
    campaignType: newSlots.campaignType ?? existing.campaignType,
    // draftStatus carries forward — this function never changes it.
    draftStatus: existing.draftStatus ?? "none",
    ...(existing.campaignId ? { campaignId: existing.campaignId } : {}),
    ...(existing.stagedActionId ? { stagedActionId: existing.stagedActionId } : {}),
  };
}
