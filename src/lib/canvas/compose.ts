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
  agentLive: boolean,
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
): CanvasSection[] {
  const intro = guarded(
    objective?.trim()
      ? `Setting up distributor outreach: ${objective.trim()}`
      : "Set up a distributor outreach campaign — every step is human-in-the-loop. Nothing auto-sends.",
    "Set up a distributor outreach campaign — every step is human-in-the-loop. Nothing auto-sends.",
  );

  const campaignProposal: PendingActionProposal | null = canvasAllowsWriteTool(
    "outreach",
    "create_campaign_draft",
  )
    ? {
        proposalId: "outreach-campaign-draft",
        toolId: "create_campaign_draft",
        input: { name: "", kind: "cold", includeTypeform: true },
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

  const sourceProposal: PendingActionProposal | null = canvasAllowsWriteTool(
    "outreach",
    "outreach_source_leads",
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

  const sendProposal: PendingActionProposal | null = canvasAllowsWriteTool(
    "outreach",
    "outreach_trigger_send_run",
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

  return [
    {
      id: "outreach-campaign",
      title: "Campaign",
      status: "ready",
      intro,
      fields: [
        {
          key: "name",
          label: "Campaign name",
          value: "—",
          provenance: "Manual",
          editable: true,
          inputBinding: { toolInputKey: "name" },
          note: "1–160 characters; no forbidden words.",
        },
        {
          key: "kind",
          label: "Kind",
          value: "cold",
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
}): CanvasState {
  const def = getCanvasDefinition(args.canvasId);
  const sections =
    args.canvasId === "create-vault"
      ? composeCreateVault(args.objective, args.agentLive)
      : args.canvasId === "lp-yield-explainer"
        ? composeLpYieldExplainer(args.objective)
        : composeOutreach(args.objective, args.agentLive);

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
