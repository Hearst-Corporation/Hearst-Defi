import "server-only";

import {
  CANVAS_CONTRACT_VERSION,
  type CanvasId,
  type CanvasState,
  type CanvasSection,
  type PendingActionProposal,
} from "@/lib/canvas/contract";
import { getCanvasDefinition, canvasAllowsWriteTool } from "@/lib/canvas/registry";
import { VAULT_YIELD } from "@/lib/engine/vaults";
import { chatOutputViolation } from "@/lib/llm/output-guard";

/**
 * Server-side composer for a canvas's `CanvasState`.
 *
 * The agent does NOT free-author JSON into the canvas: the SERVER composes the
 * structured state deterministically from the registry + the seed objective,
 * exactly as the product-chat charts are server-computed (the chat stays a thin
 * client; intelligence is server-side). The objective only flavours the intro
 * copy. Every agent-facing string is run through the SAME compliance check the
 * chat stream uses (`chatOutputViolation`: forbidden words + single-point APY)
 * before it leaves this module — a violating field is replaced with a safe
 * fallback rather than shipped.
 *
 * A `PendingActionProposal` here is INERT: it names `create_vault_draft` + the
 * draft input, but carries no token. Execution is the two-step flow on
 * `/api/admin/chat-tools`.
 */

const NOT_GUARANTEED =
  "Projections only — not guaranteed. Past performance does not predict future results. Assumptions are shown alongside every figure.";

/**
 * Deterministic (no-LLM) extraction of the outreach campaign `name`/`kind` from
 * a free-text objective.
 *
 * WHY (WIRE-1): the live chat path passes agent-extracted `values` into
 * `composeCanvasState`, so the action proposal carries the real name/kind. But
 * the degraded `<CanvasLive>` autostart fallback re-composes from the URL
 * `objective` ALONE — without values, the recomposed proposal had an empty name
 * and the canvas looked "blank" after a remount. Deriving name/kind from the
 * objective here lets the fallback rebuild the SAME proposal, so the
 * "Create campaign draft" button survives a remount with the right input.
 *
 * Pure + regex-only (no network, no LLM): matches the quoted name after
 * "nommée/named/nommé/appelée/called" and the kind keyword (cold/newsletter).
 * Returns only the keys it can confidently extract; the compose default
 * (kind → "cold", name → "") still applies for anything absent.
 */
const OUTREACH_NAME_RE =
  /(?:nomm[ée]e?|appel[ée]e?|named|called|nom\s*[:=])\s*["“«]?\s*([^"”»\n,]{2,160})/i;
const OUTREACH_KIND_RE = /\b(newsletter|cold)\b/i;

export function deriveOutreachValuesFromObjective(
  objective: string | undefined,
): { name?: string; kind?: "cold" | "newsletter" } | undefined {
  if (!objective) return undefined;
  const out: { name?: string; kind?: "cold" | "newsletter" } = {};
  const nameMatch = OUTREACH_NAME_RE.exec(objective);
  if (nameMatch?.[1]) {
    const name = nameMatch[1].trim().replace(/["”»]+$/, "").trim();
    if (name.length >= 2) out.name = name.slice(0, 160);
  }
  const kindMatch = OUTREACH_KIND_RE.exec(objective);
  const kindWord = kindMatch?.[1]?.toLowerCase();
  if (kindWord) {
    out.kind = kindWord === "newsletter" ? "newsletter" : "cold";
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Replace any non-compliant agent string with a safe fallback (defense in depth). */
function guarded(text: string, fallback: string): string {
  return chatOutputViolation(text, true) === null ? text : fallback;
}

/** A blank vault-draft input seeded from the flagship as honest, EDITABLE defaults. */
function seedVaultDraftInput(): Record<string, unknown> {
  const v = VAULT_YIELD;
  return {
    ticker: "",
    name: "",
    strategy: "mining_yield",
    minTicketUsdc: 250_000,
    capacityUsdc: 25_000_000,
    mgmtFeeBps: 150,
    perfFeeBps: 1500,
    hurdleBps: 0,
    softLockupDays: 60,
    targetApyLowBps: v.apyTarget.low * 100,
    targetApyHighBps: v.apyTarget.high * 100,
    spvJurisdiction: "cayman",
    shareClass: "A",
    regExemption: "regD_506c",
    disclaimers:
      "Projections are estimates and not guaranteed. Past performance does not predict future results. This is not an offer; see the PPM and LPA for terms, risks and eligibility.",
    targetMiningBps: v.allocationTargets.mining * 100,
    targetBtcTacticalBps: v.allocationTargets.btc_tactical * 100,
    targetUsdcBaseBps: v.allocationTargets.usdc_base * 100,
    targetStableReserveBps: v.allocationTargets.stable_reserve * 100,
    signersWhitelist: [],
    requiredSigners: 2,
  };
}

function composeCreateVault(
  objective: string | undefined,
  _agentLive: boolean,
): CanvasSection[] {
  const draftInput = seedVaultDraftInput();

  const proposal: PendingActionProposal | null = canvasAllowsWriteTool(
    "create-vault",
    "create_vault_draft",
  )
    ? {
        proposalId: "create-vault-draft",
        toolId: "create_vault_draft",
        input: draftInput,
        label: "Create vault draft (DRAFT only)",
        riskLevel: "high",
        summary: {
          projection:
            "A new vault is recorded as a draft with the parameters shown.",
          trigger: "You confirm the draft after reviewing every field.",
          action:
            "Persist a vault in the draft state (no deployment, no on-chain action).",
          impact:
            "The draft enters the review → multi-signer → live pipeline; it is NOT live and distributes nothing.",
        },
        willNotDo: [
          "Does NOT deploy or mark the vault live (markAsLive is a separate gated step).",
          "Performs no financial or custodial action.",
          "Sends nothing on-chain.",
        ],
      }
    : null;

  const intro = guarded(
    objective?.trim()
      ? `Framing a new vault: ${objective.trim()}`
      : "Frame a new vault. Fill the parameters below, then create it as a draft.",
    "Frame a new vault. Fill the parameters below, then create it as a draft.",
  );

  return [
    {
      id: "vault-identity",
      title: "Identity & strategy",
      status: "ready",
      intro,
      fields: [
        {
          key: "ticker",
          label: "Ticker",
          value: "— (e.g. HYV2)",
          provenance: "Manual",
          editable: true,
          inputBinding: { toolInputKey: "ticker" },
          note: "3–12 uppercase letters / digits / hyphens.",
        },
        {
          key: "name",
          label: "Name",
          value: "—",
          provenance: "Manual",
          editable: true,
          inputBinding: { toolInputKey: "name" },
          note: "3–80 characters; no forbidden words.",
        },
        {
          key: "strategy",
          label: "Strategy",
          value: "mining_yield",
          provenance: "Manual",
          editable: true,
          inputBinding: { toolInputKey: "strategy" },
        },
        {
          key: "targetApy",
          label: "Target APY (range)",
          value: `${VAULT_YIELD.apyTarget.low}-${VAULT_YIELD.apyTarget.high}%`,
          provenance: "Estimated",
          editable: true,
          inputBinding: { toolInputKey: "targetApyLowBps" },
          note: "Always a range, never a single point.",
        },
      ],
      options: [
        {
          id: "opt-yield",
          label: "Use Yield profile (8-15%)",
          effect: { kind: "set_field", sectionId: "vault-identity", fieldKey: "strategy", value: "mining_yield" },
        },
        {
          id: "opt-defensive",
          label: "Use Defensive profile (5-8%)",
          effect: { kind: "prefill_chat", prompt: "Set this vault to the Defensive profile (5-8% range, mining capped 15-25%)." },
        },
      ],
      actions: [],
    },
    {
      id: "vault-capital-stack",
      title: "Capital stack & terms",
      status: "ready",
      intro:
        "Allocation sleeves must sum to 100%. Fees, lock-up and signer quorum are set before review.",
      fields: [
        {
          key: "allocation",
          label: "Allocation (mining / BTC / USDC / reserve)",
          value: `${VAULT_YIELD.allocationTargets.mining} / ${VAULT_YIELD.allocationTargets.btc_tactical} / ${VAULT_YIELD.allocationTargets.usdc_base} / ${VAULT_YIELD.allocationTargets.stable_reserve}%`,
          provenance: "Estimated",
          editable: true,
          inputBinding: { toolInputKey: "targetMiningBps" },
          note: "Four sleeves; bps must sum to exactly 10000.",
        },
        {
          key: "minTicket",
          label: "Min ticket",
          value: "$250,000",
          provenance: "Manual",
          editable: true,
          inputBinding: { toolInputKey: "minTicketUsdc" },
        },
        {
          key: "softLockup",
          label: "Soft lock-up",
          value: "60 days",
          provenance: "Manual",
          editable: true,
          inputBinding: { toolInputKey: "softLockupDays" },
        },
      ],
      options: [],
      actions: proposal ? [proposal] : [],
    },
  ];
}

function composeOutreach(
  objective: string | undefined,
  _agentLive: boolean,
  values?: Record<string, string>,
): CanvasSection[] {
  const baseIntro = objective?.trim()
    ? `Setting up distributor outreach: ${objective.trim()}`
    : "Set up a distributor outreach campaign — every step is human-in-the-loop. Nothing auto-sends.";
  const intro = guarded(
    baseIntro,
    "Set up a distributor outreach campaign — every step is human-in-the-loop. Nothing auto-sends.",
  );

  // Agent-provided values flow into BOTH the displayed fields and the action
  // proposal input, so "Create campaign draft" pre-fills with what the operator
  // dictated in chat (still HITL — the button must be confirmed).
  const campaignName = values?.name?.trim() ?? "";
  // The kind must be EXPLICITLY supplied to satisfy the HITL gate. A silent
  // "cold" default must NEVER make the draft button appear (Fix D — the gating
  // hole): track the provided kind separately from the display value.
  const providedKind: "cold" | "newsletter" | undefined =
    values?.kind === "newsletter"
      ? "newsletter"
      : values?.kind === "cold"
        ? "cold"
        : undefined;
  // Field display: show "—" until the operator picks a kind, so the canvas never
  // fabricates a choice the operator did not make.
  const campaignKindDisplay = providedKind ?? "—";
  // Action input kind — guaranteed defined whenever a proposal is surfaced (the
  // gate below requires providedKind); the ?? "cold" only satisfies the type and
  // never actually defaults a surfaced proposal.
  const campaignKind: "cold" | "newsletter" = providedKind ?? "cold";
  const draftSubject = values?.draftSubject?.trim() ?? "";
  const draftBody = values?.draftBody?.trim() ?? "";
  const draftAudienceNote = values?.draftAudienceNote?.trim() ?? "";
  const draftReady = draftSubject.length > 0 && draftBody.length > 0;

  // Gating (ROUTE-2 / Fix D): the create_campaign_draft proposal is only surfaced
  // once BOTH required fields are present — a non-empty name AND an EXPLICIT kind.
  // Without the explicit-kind check the button rendered the moment a name was
  // extracted, kind silently defaulted to "cold" — a HITL gating hole. When a
  // field is missing we emit NO proposal; the section intro tells the operator
  // what is still needed.
  const hasRequiredCampaignFields =
    campaignName.length > 0 && providedKind !== undefined;

  const campaignProposal: PendingActionProposal | null = (
    hasRequiredCampaignFields &&
    canvasAllowsWriteTool("outreach", "create_campaign_draft")
  )
    ? {
        proposalId: "outreach-campaign-draft",
        toolId: "create_campaign_draft",
        input: { name: campaignName, kind: campaignKind, includeTypeform: true },
        label: "Create campaign draft",
        riskLevel: "medium",
        summary: {
          projection: "A new outreach campaign is recorded as a draft.",
          trigger: "You confirm after naming it and choosing its kind.",
          action: "Persist an OutreachCampaign in the draft state.",
          impact:
            "The campaign is a container only — no leads sourced, nothing drafted or sent.",
        },
        willNotDo: [
          "Does NOT source leads, draft, or send anything.",
          "Does NOT change OUTREACH_AUTONOMY.",
        ],
      }
    : null;

  // Pipeline write proposals (source / send) are LATER steps — gated behind the
  // SAME required-fields check so the opening turn surfaces nothing actionable
  // (no premature "Source leads" / "Trigger send run" before the campaign is even
  // named + typed). They stay strictly HITL once shown.
  const sourceProposal: PendingActionProposal | null = (
    hasRequiredCampaignFields &&
    canvasAllowsWriteTool("outreach", "outreach_source_leads")
  )
    ? {
        proposalId: "outreach-source-leads",
        toolId: "outreach_source_leads",
        input: { count: 20 },
        label: "Source 20 leads (review only)",
        riskLevel: "medium",
        summary: {
          projection: "Up to 20 distributor leads are sourced against the active ICP.",
          trigger: "You confirm; an active ICP must exist.",
          action: "Create 'new' prospects in the directory for review.",
          impact: "Prospects await drafting. Nothing is emailed; no credit spent until you confirm.",
        },
        willNotDo: [
          "Sends no email and spends no credit on its own.",
          "Requires an active ICP — none means it cannot run.",
        ],
      }
    : null;

  const sendProposal: PendingActionProposal | null = (
    hasRequiredCampaignFields &&
    canvasAllowsWriteTool("outreach", "outreach_trigger_send_run")
  )
    ? {
        proposalId: "outreach-send-run",
        toolId: "outreach_trigger_send_run",
        input: {},
        label: "Trigger a governed send run",
        riskLevel: "high",
        summary: {
          projection: "Queued agent drafts may dispatch within the autonomy dial.",
          trigger: "You confirm; the run obeys OUTREACH_AUTONOMY.",
          action: "Run the SAME governed job as the hourly cron.",
          impact:
            "In SUGGEST mode nothing sends. Tier A is NEVER auto-sent; daily cap + suppression re-check apply.",
        },
        willNotDo: [
          "Tier A is NEVER auto-sent.",
          "Cannot raise OUTREACH_AUTONOMY — in SUGGEST mode nothing leaves.",
          "Bounded by the warm-up daily cap; suppression re-checked at send time.",
        ],
      }
    : null;

  // Section intro restates what is still required when the draft cannot yet be
  // proposed, so the operator (and the chat) know the next concrete step instead
  // of seeing an inert panel.
  const campaignIntro = hasRequiredCampaignFields
    ? intro
    : `${intro} — Name and kind (cold | newsletter) are required before the draft can be created.`;

  return [
    {
      id: "outreach-campaign",
      title: "Campaign",
      status: hasRequiredCampaignFields ? "ready" : "building",
      intro: campaignIntro,
      fields: [
        {
          key: "name",
          label: "Campaign name",
          value: campaignName || "—",
          provenance: "Manual",
          editable: true,
          inputBinding: { toolInputKey: "name" },
          note: "1–160 characters; no forbidden words.",
        },
        {
          key: "kind",
          label: "Kind",
          value: campaignKindDisplay,
          provenance: "Manual",
          editable: true,
          inputBinding: { toolInputKey: "kind" },
          note: "cold | newsletter",
        },
      ],
      options: [
        {
          id: "outreach-opt-newsletter",
          label: "Make it a newsletter",
          effect: { kind: "set_field", sectionId: "outreach-campaign", fieldKey: "kind", value: "newsletter" },
        },
      ],
      actions: campaignProposal ? [campaignProposal] : [],
    },
    {
      id: "outreach-pipeline",
      title: "Source → draft → send (all HITL)",
      status: "ready",
      intro:
        "Each step needs an explicit confirmation. Drafting targets a specific prospect — ask in the chat once leads are sourced.",
      fields: [
        {
          key: "autonomy",
          label: "Autonomy",
          value: "Governed by OUTREACH_AUTONOMY (SUGGEST = nothing sends)",
          provenance: "Manual",
          editable: false,
          note: "Tier A is never auto-sent.",
        },
      ],
      options: [
        {
          id: "outreach-opt-draft",
          label: "Draft an email for a prospect",
          effect: {
            kind: "prefill_chat",
            prompt: "Draft an outreach email for prospect <paste prospectId here>.",
          },
        },
        {
          id: "outreach-opt-list",
          label: "List sourced prospects",
          effect: { kind: "prefill_chat", prompt: "List the outreach prospects awaiting drafting." },
        },
      ],
      actions: [sourceProposal, sendProposal].filter(
        (p): p is PendingActionProposal => p !== null,
      ),
    },
    {
      id: "outreach-draft",
      title: "Draft content",
      status: draftReady ? "ready" : "building",
      intro: draftReady
        ? "Draft content is prepared for review. No send action has been triggered."
        : "Draft content will appear here once campaign name and type are set.",
      fields: [
        {
          key: "subject",
          label: "Subject",
          value: draftSubject || "—",
          provenance: "Manual",
          editable: false,
        },
        {
          key: "body",
          label: "Body",
          value: draftBody || "—",
          provenance: "Manual",
          editable: false,
        },
        {
          key: "audience",
          label: "Audience note",
          value: draftAudienceNote || "—",
          provenance: "Manual",
          editable: false,
        },
      ],
      options: [],
      actions: [],
    },
  ];
}

function composeLpYieldExplainer(objective: string | undefined): CanvasSection[] {
  const intro = guarded(
    objective?.trim()
      ? `Here is how the yield works, focused on: ${objective.trim()}`
      : "Here is how the vault generates its yield, step by step.",
    "Here is how the vault generates its yield, step by step.",
  );
  return [
    {
      id: "lp-yield-sources",
      title: "Where the yield comes from",
      status: "ready",
      intro,
      fields: [
        {
          key: "source",
          label: "Primary source",
          value: "Bitcoin mining revenue-share, paid into a USDC reserve.",
          provenance: "Attested",
          editable: false,
        },
        {
          key: "distribution",
          label: "Distributions",
          value: "Monthly USDC distributions to LPs.",
          provenance: "Attested",
          editable: false,
        },
        {
          key: "target",
          label: "Target range",
          value: `${VAULT_YIELD.apyTarget.low}-${VAULT_YIELD.apyTarget.high}% (range, not a point)`,
          provenance: "Estimated",
          editable: false,
        },
      ],
      options: [
        {
          id: "lp-opt-risks",
          label: "What are the risks?",
          effect: { kind: "prefill_chat", prompt: "What are the main risks of this vault and how are they managed?" },
        },
        {
          id: "lp-opt-assumptions",
          label: "Show the assumptions",
          effect: { kind: "prefill_chat", prompt: "What assumptions underlie the target yield range?" },
        },
      ],
      // Read-only canvas: zero write actions by construction.
      actions: [],
    },
  ];
}

export function composeCanvasState(args: {
  canvasId: CanvasId;
  objective?: string;
  revision: number;
  agentLive: boolean;
  /** Agent-extracted field values merged into the canvas (HITL still applies). */
  values?: Record<string, string>;
}): CanvasState {
  const def = getCanvasDefinition(args.canvasId);
  const sections =
    args.canvasId === "create-vault"
      ? composeCreateVault(args.objective, args.agentLive)
      : args.canvasId === "lp-yield-explainer"
        ? composeLpYieldExplainer(args.objective)
        : composeOutreach(args.objective, args.agentLive, args.values);

  return {
    contractVersion: CANVAS_CONTRACT_VERSION,
    canvasId: args.canvasId,
    revision: args.revision,
    audience: def.audience,
    title: def.title,
    disclaimer: NOT_GUARANTEED,
    agentLive: args.agentLive,
    sections,
  };
}
