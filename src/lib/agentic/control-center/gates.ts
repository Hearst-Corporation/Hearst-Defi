// Agentic Control Center v0 — human gate registry (static, read-only).
//
// Every critical action that must NEVER be performed autonomously by the chat
// or an agent. autonomousAllowed is `false` for all of them by construction —
// this registry is the documented invariant + the place tests assert it.

import type { HumanGate } from "./types";

const GATES: HumanGate[] = [
  {
    id: "create-campaign",
    action: "Create outreach campaign",
    autonomousAllowed: false,
    requiresAdmin: true,
    requiresConfirmation: true,
    paths: ["src/app/admin/outreach/actions.ts"],
    notes: "createCampaign is an admin server action; chat can only draft, not commit a campaign.",
  },
  {
    id: "send-email",
    action: "Send outreach email",
    autonomousAllowed: false,
    requiresAdmin: true,
    requiresConfirmation: true,
    paths: [
      "src/lib/llm/tools/registry.ts",
      "src/lib/outreach/send-policy.ts",
    ],
    notes:
      "outreach_trigger_send_run is HITL-gated; dispatch only for Tier B/C when OUTREACH_AUTONOMY is SEND+ (default SUGGEST = nothing auto-sends). Tier A is never auto-sent (ADR-016).",
  },
  {
    id: "source-leads",
    action: "Source leads (Apollo)",
    autonomousAllowed: false,
    requiresAdmin: true,
    requiresConfirmation: true,
    paths: ["src/lib/llm/tools/registry.ts", "src/app/admin/outreach/actions.ts"],
    notes: "outreach_source_leads is a draft-only HITL write tool; produces scored prospects, no sends.",
  },
  {
    id: "create-vault-draft",
    action: "Create vault draft",
    autonomousAllowed: false,
    requiresAdmin: true,
    requiresConfirmation: true,
    paths: ["src/lib/llm/tools/registry.ts", "src/app/admin/vaults/actions.ts"],
    notes: "create_vault_draft is draft-only and confirmation-gated; never promotes or deploys.",
  },
  {
    id: "promote-vault",
    action: "Promote vault (draft → review → deployed)",
    autonomousAllowed: false,
    requiresAdmin: true,
    requiresConfirmation: true,
    paths: ["src/app/admin/vaults/actions.ts"],
    notes: "State-machine transition behind requireAdmin; not reachable as a chat tool.",
  },
  {
    id: "mark-live",
    action: "Mark vault live",
    autonomousAllowed: false,
    requiresAdmin: true,
    requiresConfirmation: true,
    paths: ["src/app/admin/vaults/actions.ts"],
    notes:
      "markAsLive (deployed → live) is a separate admin server action with approval quorum + blueprint completeness. NOT a chat tool.",
  },
  {
    id: "deploy",
    action: "Deploy contract / mainnet",
    autonomousAllowed: false,
    requiresAdmin: true,
    requiresConfirmation: true,
    paths: ["contracts/", "src/app/admin/vaults/actions.ts"],
    notes:
      "No deploy is reachable from the chat. Mainnet deploy is gated on a completed Spearbit audit + remediation (ADR-006).",
  },
  {
    id: "safe-signature",
    action: "Gnosis Safe / multisig signature",
    autonomousAllowed: false,
    requiresAdmin: true,
    requiresConfirmation: true,
    paths: ["src/app/admin/governance/"],
    notes: "Custodial signatures are out of the agentic surface entirely — multi-sig page, never a chat/agent action.",
  },
  {
    id: "governance-execution",
    action: "Governance proposal execution",
    autonomousAllowed: false,
    requiresAdmin: true,
    requiresConfirmation: true,
    paths: ["src/app/admin/governance/"],
    notes: "Governance proposals can be drafted (HITL) but execution is admin-only, never autonomous.",
  },
  {
    id: "db-migration",
    action: "DB migration / schema change",
    autonomousAllowed: false,
    requiresAdmin: true,
    requiresConfirmation: true,
    paths: ["prisma/schema.prisma", "prisma/migrations/"],
    notes: "No agent runs migrations. Schema is a sensitive single-owner file; migrations are run by a human operator.",
  },
  {
    id: "formula-model-change",
    action: "Formula / model change (engine, methodology)",
    autonomousAllowed: false,
    requiresAdmin: true,
    requiresConfirmation: true,
    paths: ["src/lib/engine/", "docs/methodology/"],
    notes:
      "Scenario engine is pure-function and human-owned; methodology is immutable once published (version bump only). No agent edits formulas.",
  },
];

export function getHumanGateInventory(): HumanGate[] {
  return GATES;
}
