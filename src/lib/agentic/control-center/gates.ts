// Agentic Control Center — human gate registry (static, read-only).
//
// Every critical action that must NEVER be performed autonomously by the chat
// or an agent. autonomousAllowed is `false` for all of them by construction —
// this registry is the documented invariant + the place tests assert it.

import type { HumanGate } from "./types";

const GATES: HumanGate[] = [
  {
    id: "send_email",
    action: "Send outreach email",
    domain: "outreach",
    autonomousAllowed: false,
    requiresHuman: true,
    requiresAdmin: true,
    requiresConfirmation: true,
    riskLevel: "high",
    protectedActions: ["outreach_trigger_send_run", "hourly send cron"],
    paths: [
      "src/lib/llm/tools/registry.ts",
      "src/lib/inngest/functions/outreach-auto-send.ts",
      "src/lib/outreach/send-policy.ts",
    ],
    notes:
      "outreach_trigger_send_run is HITL-gated; OUTREACH_AUTONOMY=SUGGEST (default) short-circuits before any dispatch. Tier A never auto-sent; daily warm-up cap + suppression re-check (ADR-016).",
  },
  {
    id: "source_leads",
    action: "Source leads (Apollo)",
    domain: "outreach",
    autonomousAllowed: false,
    requiresHuman: true,
    requiresAdmin: true,
    requiresConfirmation: true,
    riskLevel: "high",
    protectedActions: ["outreach_source_leads"],
    paths: ["src/lib/llm/tools/registry.ts", "src/app/admin/outreach/actions.ts"],
    notes:
      "Draft-only HITL write tool; creates scored prospect rows, nothing sent.",
  },
  {
    id: "create_campaign",
    action: "Create outreach campaign",
    domain: "outreach",
    autonomousAllowed: false,
    requiresHuman: true,
    requiresAdmin: true,
    requiresConfirmation: true,
    riskLevel: "medium",
    protectedActions: ["create_campaign_draft"],
    paths: ["src/lib/llm/tools/registry.ts", "src/app/admin/outreach/actions.ts"],
    notes:
      "create_campaign_draft persists OutreachCampaign status=draft; no leads sourced/drafted/sent, autonomy unchanged.",
  },
  {
    id: "create_vault_draft",
    action: "Create vault draft",
    domain: "vault",
    autonomousAllowed: false,
    requiresHuman: true,
    requiresAdmin: true,
    requiresConfirmation: true,
    riskLevel: "high",
    protectedActions: ["create_vault_draft"],
    paths: ["src/lib/llm/tools/registry.ts", "src/app/admin/vaults/actions.ts"],
    notes:
      "Draft-only and confirmation-gated; persists VaultDeployment status=draft. markAsLive is a separate state-machine action, never reachable here.",
  },
  {
    id: "promote_vault",
    action: "Promote vault (draft → review → deployed)",
    domain: "vault",
    autonomousAllowed: false,
    requiresHuman: true,
    requiresAdmin: true,
    requiresConfirmation: true,
    riskLevel: "high",
    protectedActions: ["vault status transition"],
    paths: ["src/app/admin/vaults/actions.ts"],
    notes: "State-machine transition behind requireAdmin; not exposed as a chat tool.",
  },
  {
    id: "mark_live",
    action: "Mark vault live",
    domain: "vault",
    autonomousAllowed: false,
    requiresHuman: true,
    requiresAdmin: true,
    requiresConfirmation: true,
    riskLevel: "critical",
    protectedActions: ["markAsLive"],
    paths: ["src/app/admin/vaults/actions.ts", "src/lib/vaults/blueprint.ts"],
    notes:
      "markAsLive (deployed → live) is an admin server action with evaluateDeploymentLiveGate (blueprint completeness + approval quorum). NOT a chat tool.",
  },
  {
    id: "deploy",
    action: "Deploy contract / mainnet",
    domain: "contracts",
    autonomousAllowed: false,
    requiresHuman: true,
    requiresAdmin: true,
    requiresConfirmation: true,
    riskLevel: "critical",
    protectedActions: ["on-chain deploy"],
    paths: ["contracts/", "src/app/admin/vaults/actions.ts"],
    notes:
      "No deploy tool exists in the registry; read_runtime_capabilities reports deploy_execute=no. Mainnet deploy gated on a completed Spearbit audit + remediation (ADR-006).",
  },
  {
    id: "safe_signature",
    action: "Gnosis Safe / multisig signature",
    domain: "governance",
    autonomousAllowed: false,
    requiresHuman: true,
    requiresAdmin: true,
    requiresConfirmation: true,
    riskLevel: "critical",
    protectedActions: ["multisig sign"],
    paths: ["src/app/admin/governance/", "src/lib/governance/actions.ts"],
    notes: "Custodial signatures are out of the agentic surface entirely — multi-sig page, never a chat/agent action.",
  },
  {
    id: "governance_execute",
    action: "Governance proposal execution",
    domain: "governance",
    autonomousAllowed: false,
    requiresHuman: true,
    requiresAdmin: true,
    requiresConfirmation: true,
    riskLevel: "critical",
    protectedActions: ["executeProposal", "state-machine advance"],
    paths: ["src/lib/governance/actions.ts", "src/lib/governance/state-machine.ts"],
    notes:
      "create_governance_proposal_draft can draft (HITL, state=DRAFT/SIGNING); proposeAction/signProposal/executeProposal are server actions, never tools. No tool can advance or execute.",
  },
  {
    id: "db_migration",
    action: "DB migration / schema change",
    domain: "platform",
    autonomousAllowed: false,
    requiresHuman: true,
    requiresAdmin: true,
    requiresConfirmation: true,
    riskLevel: "critical",
    protectedActions: ["prisma migrate"],
    paths: ["prisma/schema.prisma", "prisma/migrations/"],
    notes: "No migration tool exposed. Schema is a sensitive single-owner file; migrations are run by a human operator.",
  },
  {
    id: "formula_change",
    action: "Formula change (scenario engine)",
    domain: "engine",
    autonomousAllowed: false,
    requiresHuman: true,
    requiresAdmin: true,
    requiresConfirmation: true,
    riskLevel: "critical",
    protectedActions: ["engine formula edit"],
    paths: ["src/lib/engine/"],
    notes:
      "Scenario engine is pure-function and human-owned. No formula-change tool exposed; vault params gated via draft + governance.",
  },
  {
    id: "model_change",
    action: "Model / methodology change",
    domain: "methodology",
    autonomousAllowed: false,
    requiresHuman: true,
    requiresAdmin: true,
    requiresConfirmation: true,
    riskLevel: "critical",
    protectedActions: ["methodology version bump"],
    paths: ["docs/methodology/"],
    notes:
      "Methodology is immutable once published (version bump only). No agent edits the model; no model-change tool exposed.",
  },
];

export function getHumanGateInventory(): HumanGate[] {
  return GATES;
}
