/**
 * Outreach Action Cards — Canvas section composers.
 *
 * Centralized builders for Outreach action cards in the canvas workspace.
 * All cards respect the safety invariants:
 * - sendAllowed is always false (no direct send)
 * - requiresUserReview is always true (HITL)
 * - PTAI-shaped summaries
 * - Provenance badges on all fields
 */

import type {
  CanvasSection,
  PendingActionProposal,
  ActionSummaryPtai,
  CanvasField,
} from "./contract";
import type { AdminWriteToolId } from "@/lib/llm/tools/types";

// ============================================================================
// SAFETY CONSTANTS
// ============================================================================

const SAFETY_NO_SEND = "No send — review required";
const SAFETY_DRAFT_ONLY = "Draft only — HITL confirmation";
const SAFETY_REVIEW_REQUIRED = "Review required before any action";

// ============================================================================
// PTAI SUMMARIES
// ============================================================================

function ptaiCampaignDraft(campaignName: string): ActionSummaryPtai {
  return {
    projection: `A new outreach campaign "${campaignName}" is recorded as a draft container. No leads are sourced, nothing is sent.`,
    trigger: "You confirm the campaign name and kind after reviewing.",
    action: "Persist an OutreachCampaign row in draft state.",
    impact: "The campaign exists for review → sourcing → drafting → governed send run. Nothing distributes automatically.",
  };
}

function ptaiEmailDraft(toEmail: string): ActionSummaryPtai {
  return {
    projection: `A personalized email draft is prepared for ${toEmail}. It is stored, not sent.`,
    trigger: "You review and confirm the draft content.",
    action: "Persist an OutreachEmailDraft row with staged content.",
    impact: "The draft awaits your send confirmation or batch send run (governed by OUTREACH_AUTONOMY).",
  };
}

function ptaiSourceLeads(count: number): ActionSummaryPtai {
  return {
    projection: `Up to ${count} distributor leads are sourced against the active ICP and scored/tiered.`,
    trigger: "You confirm; an active ICP must exist.",
    action: "Create 'new' OutreachProspect rows in the directory.",
    impact: "Prospects await drafting. Nothing is emailed; no credit spent until you confirm.",
  };
}

function ptaiFollowUpDraft(recipientsCount: number): ActionSummaryPtai {
  return {
    projection: `Follow-up drafts are prepared for ${recipientsCount} non-responsive prospects.`,
    trigger: "You confirm the recipient scope and review drafts.",
    action: "Create staged follow-up email/WhatsApp drafts.",
    impact: "Drafts await your review. No auto-send; governed by OUTREACH_AUTONOMY dial.",
  };
}

// ============================================================================
// FIELD BUILDERS
// ============================================================================

function field(
  key: string,
  label: string,
  value: string,
  provenance: CanvasField["provenance"],
  editable: boolean,
  note?: string,
): CanvasField {
  return {
    key,
    label,
    value,
    provenance,
    editable,
    ...(note && { note }),
  };
}

function editableField(
  key: string,
  label: string,
  value: string,
  toolInputKey: string,
  note?: string,
): CanvasField {
  return {
    key,
    label,
    value,
    provenance: "Manual",
    editable: true,
    inputBinding: { toolInputKey },
    ...(note && { note }),
  };
}

// ============================================================================
// ACTION PROPOSAL BUILDERS
// ============================================================================

function proposal(
  proposalId: string,
  toolId: AdminWriteToolId,
  label: string,
  riskLevel: "low" | "medium" | "high",
  summary: ActionSummaryPtai,
  willNotDo: string[],
  input: Record<string, unknown>,
): PendingActionProposal {
  return {
    proposalId,
    toolId,
    label,
    riskLevel,
    summary,
    willNotDo,
    input,
  };
}

// ============================================================================
// SECTION BUILDERS
// ============================================================================

/**
 * Campaign creation action card.
 */
export function buildCreateCampaignSection(
  campaignName: string,
  campaignType: "cold" | "newsletter",
  onCreate?: boolean,
): CanvasSection {
  const fields: CanvasField[] = [
    editableField("name", "Campaign name", campaignName || "—", "name", "1-160 characters"),
    editableField("kind", "Kind", campaignType || "—", "kind", "cold | newsletter"),
    field(
      "status",
      "Status",
      onCreate ? "Draft ready for review" : "Configuration required",
      onCreate ? "Estimated" : "Manual",
      false,
    ),
  ];

  const actions: PendingActionProposal[] = [];
  if (campaignName && campaignType) {
    actions.push(
      proposal(
        "outreach-campaign-draft",
        "create_campaign_draft",
        "Create campaign draft",
        "medium",
        ptaiCampaignDraft(campaignName),
        [
          "Does NOT source leads, draft, or send anything.",
          "Does NOT change OUTREACH_AUTONOMY.",
          "No send without explicit confirmation.",
        ],
        { name: campaignName, kind: campaignType, includeTypeform: true },
      ),
    );
  }

  return {
    id: "outreach-campaign",
    title: "Campaign",
    status: onCreate ? "ready" : "building",
    intro: onCreate
      ? `Campaign "${campaignName}" · ${campaignType}. Review fields, then create the draft.`
      : "Set campaign name and kind (cold | newsletter) to enable the draft creation.",
    fields,
    options: [
      {
        id: "opt-cold",
        label: "Make it a cold outreach campaign",
        effect: { kind: "set_field", sectionId: "outreach-campaign", fieldKey: "kind", value: "cold" },
      },
      {
        id: "opt-newsletter",
        label: "Make it a newsletter campaign",
        effect: { kind: "set_field", sectionId: "outreach-campaign", fieldKey: "kind", value: "newsletter" },
      },
    ],
    actions,
  };
}

/**
 * Email draft action card.
 */
export function buildEmailDraftSection(
  prospectEmail: string,
  prospectName: string,
  subject: string,
  body: string,
  isPreview: boolean,
): CanvasSection {
  const fields: CanvasField[] = [
    field("to", "To", `${prospectName} <${prospectEmail}>`, "Manual", false),
    field("channel", "Channel", "Email", "Manual", false, "Standard email delivery"),
    field("subject", "Subject", subject || "—", isPreview ? "Estimated" : "Manual", false),
    field(
      "body",
      "Body preview",
      body ? body.slice(0, 200) + (body.length > 200 ? "…" : "") : "—",
      isPreview ? "Estimated" : "Manual",
      false,
    ),
    field("safety", "Safety", SAFETY_NO_SEND, "Manual", false, SAFETY_REVIEW_REQUIRED),
  ];

  const actions: PendingActionProposal[] = [];
  if (isPreview && subject && body) {
    actions.push(
      proposal(
        "outreach-email-draft",
        "outreach_draft_email",
        "Save email draft",
        "medium",
        ptaiEmailDraft(prospectEmail),
        [
          "Does NOT send the email.",
          "Draft is staged for your review.",
          "Send requires explicit confirmation or governed send run.",
        ],
        { prospectEmail, subject, body },
      ),
    );
  }

  return {
    id: "outreach-email-draft",
    title: "Draft Email",
    status: isPreview ? "ready" : "building",
    intro: isPreview
      ? `Email draft ready for ${prospectName || prospectEmail}. Review and save.`
      : "Email draft will appear here once generated.",
    fields,
    options: isPreview
      ? [
          {
            id: "opt-regenerate",
            label: "Regenerate with different angle",
            effect: { kind: "prefill_chat", prompt: `Redraft email for ${prospectEmail} with a different angle.` },
          },
        ]
      : [],
    actions,
  };
}

/**
 * WhatsApp draft action card.
 */
export function buildWhatsAppDraftSection(
  prospectName: string,
  body: string,
  isPreview: boolean,
): CanvasSection {
  const fields: CanvasField[] = [
    field("to", "To", prospectName || "—", "Manual", false),
    field("channel", "Channel", "WhatsApp", "Manual", false, "Short-form messaging"),
    field(
      "body",
      "Message",
      body ? body.slice(0, 150) + (body.length > 150 ? "…" : "") : "—",
      isPreview ? "Estimated" : "Manual",
      false,
    ),
    field("length", "Length", body ? `${body.length} chars` : "—", "Manual", false, "Max 400 chars"),
    field("safety", "Safety", SAFETY_DRAFT_ONLY, "Manual", false, SAFETY_REVIEW_REQUIRED),
  ];

  const actions: PendingActionProposal[] = [];
  if (isPreview && body) {
    // WhatsApp drafts are saved as generic drafts (no specific tool yet)
    actions.push({
      proposalId: "outreach-whatsapp-draft",
      toolId: "create_review_note_draft", // Reuse review note for now
      label: "Save WhatsApp draft",
      riskLevel: "low",
      summary: {
        projection: `WhatsApp message draft saved for ${prospectName || "prospect"}. Not sent.`,
        trigger: "You review and confirm.",
        action: "Persist as a review note draft (WhatsApp content).",
        impact: "Draft staged. No auto-send.",
      },
      willNotDo: ["Does NOT send the WhatsApp.", "Manual send only."],
      input: { type: "whatsapp_draft", to: prospectName, body },
    });
  }

  return {
    id: "outreach-whatsapp-draft",
    title: "Draft WhatsApp",
    status: isPreview ? "ready" : "building",
    intro: isPreview
      ? `WhatsApp draft ready for ${prospectName || "prospect"}. Review and save.`
      : "WhatsApp draft will appear here once generated.",
    fields,
    options: [],
    actions,
  };
}

/**
 * LinkedIn draft action card.
 */
export function buildLinkedInDraftSection(
  prospectName: string,
  body: string,
  isConnectionRequest: boolean,
  isPreview: boolean,
): CanvasSection {
  const fields: CanvasField[] = [
    field("to", "To", prospectName || "—", "Manual", false),
    field("channel", "Channel", "LinkedIn", "Manual", false, isConnectionRequest ? "Connection request note" : "InMail/message"),
    field(
      "body",
      "Message",
      body ? body.slice(0, 200) + (body.length > 200 ? "…" : "") : "—",
      isPreview ? "Estimated" : "Manual",
      false,
    ),
    field("type", "Type", isConnectionRequest ? "Connection request" : "InMail", "Manual", false),
    field("safety", "Safety", SAFETY_DRAFT_ONLY, "Manual", false, SAFETY_REVIEW_REQUIRED),
  ];

  const actions: PendingActionProposal[] = [];
  if (isPreview && body) {
    actions.push({
      proposalId: "outreach-linkedin-draft",
      toolId: "create_review_note_draft",
      label: "Save LinkedIn draft",
      riskLevel: "low",
      summary: {
        projection: `LinkedIn ${isConnectionRequest ? "connection note" : "message"} draft saved for ${prospectName || "prospect"}. Not sent.`,
        trigger: "You review and confirm.",
        action: "Persist as a review note draft (LinkedIn content).",
        impact: "Draft staged. No auto-send.",
      },
      willNotDo: ["Does NOT send the LinkedIn message.", "Manual send only."],
      input: { type: "linkedin_draft", to: prospectName, body, isConnectionRequest },
    });
  }

  return {
    id: "outreach-linkedin-draft",
    title: "Draft LinkedIn",
    status: isPreview ? "ready" : "building",
    intro: isPreview
      ? `LinkedIn draft ready for ${prospectName || "prospect"}. Review and save.`
      : "LinkedIn draft will appear here once generated.",
    fields,
    options: [],
    actions,
  };
}

/**
 * Source leads action card.
 */
export function buildSourceLeadsSection(count: number, hasActiveIcp: boolean): CanvasSection {
  const fields: CanvasField[] = [
    field("count", "Leads to source", String(count), "Manual", false, "Max 50 per batch"),
    field("icp", "Active ICP", hasActiveIcp ? "Yes — will match against profile" : "No — create ICP first", hasActiveIcp ? "Estimated" : "Stale", false),
    field("safety", "Safety", SAFETY_REVIEW_REQUIRED, "Manual", false, "No auto-outreach"),
  ];

  const actions: PendingActionProposal[] = [];
  if (hasActiveIcp) {
    actions.push(
      proposal(
        "outreach-source-leads",
        "outreach_source_leads",
        `Source ${count} leads`,
        "medium",
        ptaiSourceLeads(count),
        [
          "Does NOT email or contact leads.",
          "Creates prospects for review only.",
          "No credit spent without confirmation.",
        ],
        { count },
      ),
    );
  }

  return {
    id: "outreach-source-leads",
    title: "Source Leads",
    status: hasActiveIcp ? "ready" : "building",
    intro: hasActiveIcp
      ? `Source up to ${count} distributor leads against the active ICP. Review before confirming.`
      : "Create an Ideal Customer Profile (ICP) before sourcing leads.",
    fields,
    options: hasActiveIcp
      ? [
          { id: "opt-10", label: "Source 10", effect: { kind: "prefill_chat", prompt: "Source 10 leads" } },
          { id: "opt-20", label: "Source 20", effect: { kind: "prefill_chat", prompt: "Source 20 leads" } },
          { id: "opt-50", label: "Source 50", effect: { kind: "prefill_chat", prompt: "Source 50 leads" } },
        ]
      : [
          {
            id: "opt-create-icp",
            label: "Create ICP first",
            effect: { kind: "prefill_chat", prompt: "Create an Ideal Customer Profile for distributor outreach" },
          },
        ],
    actions,
  };
}

/**
 * Follow-up action card.
 */
export function buildFollowUpSection(
  recipientsCount: number,
  daysSince: number,
  channel: "email" | "whatsapp" | "linkedin" | "multi",
): CanvasSection {
  const fields: CanvasField[] = [
    field("recipients", "Recipients", String(recipientsCount), "Manual", false, "Non-responsive prospects"),
    field("days", "Days since last contact", String(daysSince), "Manual", false),
    field("channel", "Channel", channel === "multi" ? "Multi-channel" : channel, "Manual", false),
    field("safety", "Safety", SAFETY_NO_SEND, "Manual", false, SAFETY_REVIEW_REQUIRED),
  ];

  const actions: PendingActionProposal[] = [
    proposal(
      "outreach-follow-up",
      "outreach_draft_email", // Reuse for now
      `Draft ${channel} follow-ups`,
      "medium",
      ptaiFollowUpDraft(recipientsCount),
      [
        "Does NOT send follow-ups automatically.",
        "Drafts are staged for review.",
        "Send requires explicit confirmation.",
      ],
      { recipientsCount, daysSince, channel },
    ),
  ];

  return {
    id: "outreach-follow-up",
    title: "Follow-up",
    status: recipientsCount > 0 ? "ready" : "building",
    intro:
      recipientsCount > 0
        ? `Prepare follow-up drafts for ${recipientsCount} prospects (last contact ${daysSince} days ago).`
        : "Select recipient scope for follow-up campaign.",
    fields,
    options: [
      { id: "opt-email", label: "Use email", effect: { kind: "set_field", sectionId: "outreach-follow-up", fieldKey: "channel", value: "email" } },
      { id: "opt-whatsapp", label: "Use WhatsApp", effect: { kind: "set_field", sectionId: "outreach-follow-up", fieldKey: "channel", value: "whatsapp" } },
      { id: "opt-both", label: "Multi-channel", effect: { kind: "set_field", sectionId: "outreach-follow-up", fieldKey: "channel", value: "multi" } },
    ],
    actions: recipientsCount > 0 ? actions : [],
  };
}

/**
 * Review recipients action card (read-only).
 */
export function buildReviewRecipientsSection(prospectCount: number, tierBreakdown: Record<string, number>): CanvasSection {
  const tierFields: CanvasField[] = Object.entries(tierBreakdown).map(([tier, count]) =>
    field(`tier-${tier}`, `Tier ${tier}`, String(count), "Attested", false),
  );

  return {
    id: "outreach-review-recipients",
    title: "Review Recipients",
    status: "ready",
    intro: `${prospectCount} prospects in current scope. Review tiers and suppression status before drafting.`,
    fields: [
      field("total", "Total prospects", String(prospectCount), "Attested", false),
      ...tierFields,
      field("safety", "Safety", "No auto-send", "Manual", false, "All sends are HITL"),
    ],
    options: [
      {
        id: "opt-list-a",
        label: "List Tier A only",
        effect: { kind: "prefill_chat", prompt: "List Tier A prospects" },
      },
      {
        id: "opt-list-new",
        label: "List new prospects",
        effect: { kind: "prefill_chat", prompt: "List prospects with status 'new'" },
      },
    ],
    actions: [], // Read-only section
  };
}

// ============================================================================
// EXPORT ALL
// ============================================================================

export const outreachActionCards = {
  buildCreateCampaignSection,
  buildEmailDraftSection,
  buildWhatsAppDraftSection,
  buildLinkedInDraftSection,
  buildSourceLeadsSection,
  buildFollowUpSection,
  buildReviewRecipientsSection,
};
