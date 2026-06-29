/**
 * Deterministic Outreach parser/state utilities (NO LLM).
 */

export type OutreachCampaignType = "cold" | "newsletter";

export type OutreachParseResult = {
  intent:
    | "outreach_start"
    | "outreach_slots"
    | "outreach_open_campaign"
    | "outreach_draft_missing_complaint"
    | "outreach_source_leads"
    | "none";
  campaignName?: string;
  campaignType?: OutreachCampaignType;
  missing?: Array<"campaignName" | "campaignType">;
};

export type OutreachWorkflowState = {
  workflow: "outreach_campaign";
  campaignName?: string;
  campaignType?: OutreachCampaignType;
  draftStatus?: "none" | "prepared" | "created";
  draftContent?: {
    subject: string;
    body: string;
    audienceNote?: string;
  };
  campaignId?: string;
  campaignRoute?: string;
};

const CONTROL_RE = /[\x00-\x1F\x7F]/g;
const MULTI_SPACE_RE = /\s+/g;

const COLD_ALIAS_RE =
  /\b(?:cold|colde|campagne\s+cold|prospection|c['’]?\s*est\s+un\s+cold|c['’]?\s*est\s+un\s+colde)\b/i;
const NEWSLETTER_ALIAS_RE = /\b(?:newsletter|news\s*letter|mailing)\b/i;
const SOURCE_LEADS_RE =
  /\b(?:source|sourcing|prospect|prospects|leads?|lead)\b[^.?!]*\b(?:outreach|campagne|campaign)?\b/i;
const OPEN_CAMPAIGN_RE =
  /\bla\s+campagne\b|\b(?:ouvre(?:-?moi)?|open)\b[^.?!]*\b(?:campagne|campaign)\b|\bbonne\s+page\s+de\s+la\s+campagne\b/i;
const DRAFT_COMPLAINT_RE =
  /\b(?:t['’]?\s*as\s+rien\s+[ée]crit(?:\s+dans\s+le\s+brouillon)?|rien\s+[ée]crit\s+dans\s+le\s+brouillon|brouillon\s+vide|draft\s+vide)\b/i;
const START_RE =
  /\b(?:on\s+va\s+faire|lance|d[ée]marre|pr[ée]pare|cr[ée]e?|setup|set\s*up|start)\b[^.?!]*\b(?:outreach|campagne|campaign)\b/i;

function clean(value: string): string {
  return value
    .replace(CONTROL_RE, "")
    .replace(/["“«»”]/g, "")
    .trim()
    .replace(MULTI_SPACE_RE, " ")
    .slice(0, 160);
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(CONTROL_RE, "")
    .toLowerCase()
    .replace(MULTI_SPACE_RE, " ")
    .trim();
}

function normalizeCampaignType(text: string): OutreachCampaignType | undefined {
  if (NEWSLETTER_ALIAS_RE.test(text)) return "newsletter";
  if (/\bprospection\b/i.test(text) && /\b(?:email|mail|lead|leads|prospect|source|sourcing)\b/i.test(text)) {
    return undefined;
  }
  if (COLD_ALIAS_RE.test(text)) return "cold";
  return undefined;
}

function cleanupTrailingSlotNoise(value: string): string {
  return value
    .replace(
      /(?:\b(?:et|c['’]?\s*est|cest|c\s+est|un|une|type|de|d['’]|la|le|campaign|campagne|outreach)\b[\s,:-]*)+$/i,
      "",
    )
    .trim();
}

function extractCampaignName(text: string, campaignType?: OutreachCampaignType): string | undefined {
  const explicitName =
    /(?:nomm[ée]e?|appel[ée]e?|named|called|nom\s*[:=])\s*["“«]?\s*([^"”»\n,]{2,160})/i.exec(text);
  if (explicitName?.[1]) {
    const out = clean(explicitName[1]);
    if (out.length >= 2) return out;
  }

  if (campaignType) {
    const beforeType =
      /^(.*?)\b(?:cold|colde|newsletter|news\s*letter|mailing|prospection)\b/i.exec(text);
    if (beforeType?.[1]) {
      const out = clean(cleanupTrailingSlotNoise(beforeType[1]));
      if (out.length >= 2) return out;
    }
  }

  const normalized = normalize(text);
  if (
    START_RE.test(normalized) ||
    /\b(?:outreach|campagne|campaign|prospection|newsletter|cold|colde|mailing)\b/i.test(
      normalized,
    )
  ) {
    return undefined;
  }

  if (
    /[?!]/.test(text) ||
    /\b(?:creer|cr[eé]er|prepare|pr[eé]pare|simuler|ouvre|ouvrir|open|liste|list|montre|show|navigue|monte(?:-?moi)?)\b/i.test(
      normalized,
    )
  ) {
    return undefined;
  }
  const tokens = normalized.split(" ").filter(Boolean);
  if (tokens.length === 0 || tokens.length > 4) return undefined;
  if (!/[A-ZÀ-ÖØ-Ý]/.test(text)) return undefined;

  const generic = clean(
    text
      .replace(/[.,!?]/g, " ")
      .replace(MULTI_SPACE_RE, " ")
      .trim(),
  );
  return generic.length >= 2 ? generic : undefined;
}

export function parseOutreachMessage(message: string): OutreachParseResult {
  const text = typeof message === "string" ? message.trim() : "";
  if (text.length === 0) return { intent: "none" };

  const normalizedText = normalize(text);

  if (DRAFT_COMPLAINT_RE.test(normalizedText)) {
    return { intent: "outreach_draft_missing_complaint" };
  }
  if (OPEN_CAMPAIGN_RE.test(normalizedText)) {
    return { intent: "outreach_open_campaign" };
  }
  if (SOURCE_LEADS_RE.test(normalizedText)) {
    return { intent: "outreach_source_leads" };
  }

  const campaignType = normalizeCampaignType(normalizedText);
  const campaignName = extractCampaignName(text, campaignType);
  if (campaignName || campaignType) {
    const missing: Array<"campaignName" | "campaignType"> = [];
    if (!campaignName) missing.push("campaignName");
    if (!campaignType) missing.push("campaignType");
    return {
      intent: "outreach_slots",
      ...(campaignName ? { campaignName } : {}),
      ...(campaignType ? { campaignType } : {}),
      ...(missing.length > 0 ? { missing } : {}),
    };
  }

  if (START_RE.test(normalizedText) || /\bcampaign\b|\bcampagne\b/i.test(normalizedText)) {
    return {
      intent: "outreach_start",
      missing: ["campaignName", "campaignType"],
    };
  }

  return { intent: "none" };
}

export function prepareOutreachDraftContent(args: {
  campaignName: string;
  campaignType: OutreachCampaignType;
}): OutreachWorkflowState["draftContent"] {
  return {
    subject: "Introduction to Hearst Yield Vault",
    body:
      "Hi {{first_name}},\n\n" +
      "I wanted to introduce Hearst Yield Vault, a read-only institutional yield product designed around transparent APY ranges, provenance, and risk framing.\n\n" +
      "The current preview is structured for review only: no send action has been triggered, and distribution or sourcing requires confirmation.\n\n" +
      "Best,\nHearst Connect",
    audienceNote: `${args.campaignName} · ${args.campaignType}`,
  };
}

export function reduceOutreachWorkflowState(
  prev: OutreachWorkflowState,
  parsed: OutreachParseResult,
): OutreachWorkflowState {
  const next: OutreachWorkflowState = {
    ...prev,
    workflow: "outreach_campaign",
    draftStatus: prev.draftStatus ?? "none",
  };
  if (parsed.campaignName) next.campaignName = parsed.campaignName;
  if (parsed.campaignType) next.campaignType = parsed.campaignType;

  const hasSubject = Boolean(next.draftContent?.subject?.trim());
  const hasBody = Boolean(next.draftContent?.body?.trim());
  const hasDraftContent = hasSubject && hasBody;

  if (
    next.campaignName &&
    next.campaignType &&
    (!hasDraftContent || parsed.intent === "outreach_draft_missing_complaint")
  ) {
    next.draftContent = prepareOutreachDraftContent({
      campaignName: next.campaignName,
      campaignType: next.campaignType,
    });
    next.draftStatus = "prepared";
  } else if (hasDraftContent && next.draftStatus !== "created") {
    next.draftStatus = "prepared";
  }

  if (next.draftStatus === "created" && !next.campaignId) {
    next.draftStatus = "prepared";
  }

  return next;
}

export function buildOutreachWorkflowStateFromMessages(
  userMessages: string[],
): OutreachWorkflowState {
  let state: OutreachWorkflowState = {
    workflow: "outreach_campaign",
    draftStatus: "none",
  };
  for (const msg of userMessages) {
    state = reduceOutreachWorkflowState(state, parseOutreachMessage(msg));
  }
  return state;
}

export function buildOutreachAskFieldsMessage(state: OutreachWorkflowState): string {
  const missing = [];
  if (!state.campaignName) missing.push("nom de campagne");
  if (!state.campaignType) missing.push("type (`cold` ou `newsletter`)");
  const suffix =
    missing.length > 0
      ? `Il me manque ${missing.join(" et ")}.`
      : "Je peux préparer le draft dès que les slots sont complets.";
  return `J’ouvre le workspace Outreach. ${suffix}`;
}

export function buildOutreachDraftPreparedMessage(state: OutreachWorkflowState): string {
  const name = state.campaignName ?? "Campaign";
  const kind = state.campaignType ?? "cold";
  return `J’ai préparé un brouillon pour “${name}” · ${kind}. Aucun envoi n’a été lancé.`;
}

export function buildOutreachDraftComplaintFixedMessage(state: OutreachWorkflowState): string {
  const name = state.campaignName ?? "Campaign";
  const kind = state.campaignType ?? "cold";
  return `Tu as raison. Je corrige : le contenu du draft “${name}” · ${kind} est maintenant prêt. Aucun envoi n’est lancé.`;
}

export function buildOutreachOpenCampaignMessage(state: OutreachWorkflowState): string {
  if (!state.campaignName && !state.campaignType) {
    return "Je peux ouvrir la campagne dès que tu me donnes son nom et son type (`cold` ou `newsletter`).";
  }
  if (!state.campaignName) {
    return "Je peux ouvrir la campagne, il me manque seulement le nom.";
  }
  if (!state.campaignType) {
    return "Je peux ouvrir la campagne, il me manque seulement le type (`cold` ou `newsletter`).";
  }
  return `J’ouvre la campagne “${state.campaignName}” · ${state.campaignType} dans le workspace Outreach.`;
}

export function buildOutreachPostDraftMessage(name: string): string {
  return `Le draft de campagne “${clean(name) || name}” est enregistré avec un contenu non vide. Aucun envoi n’a été lancé.`;
}
