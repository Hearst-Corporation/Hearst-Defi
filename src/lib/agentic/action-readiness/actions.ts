import type { ActionReadinessItem } from "./types";

export const ACTION_READINESS_ITEMS: ActionReadinessItem[] = [
  // ─── READ-ONLY ────────────────────────────────────────────────────────────
  {
    id: "navigate_admin_surface",
    label: "Navigate admin surface",
    tier: "read_only",
    status: "available",
    autonomousAllowed: true,
    humanGateRequired: false,
    confirmationRequired: false,
    riskLevel: "none",
    reason:
      "Read-only navigation within closed admin route whitelist. No state mutation, no external effect.",
    examples: [
      "Open /admin/agentic",
      "Navigate to /admin/vaults",
      "Open /admin/investors",
    ],
  },
  {
    id: "explain_product",
    label: "Explain product",
    tier: "read_only",
    status: "available",
    autonomousAllowed: true,
    humanGateRequired: false,
    confirmationRequired: false,
    riskLevel: "none",
    reason:
      "Textual explanation of product structure, fees, and mechanics. No DB write, no external call, no financial commitment implied.",
    examples: [
      "Explain the Hearst Yield Vault structure",
      "What is the 60-day soft lock-up?",
      "Describe share classes",
    ],
  },
  {
    id: "explain_yield",
    label: "Explain yield",
    tier: "read_only",
    status: "available",
    autonomousAllowed: true,
    humanGateRequired: false,
    confirmationRequired: false,
    riskLevel: "low",
    reason:
      "APY always expressed as a range (non-negotiable rule #1). No single-point promise. Educational only, output-guard enforced.",
    examples: [
      "What is the target APY range?",
      "How is yield generated from mining?",
      "Explain the 8-15% APY range",
    ],
  },
  {
    id: "compose_reporting_briefing",
    label: "Compose reporting briefing",
    tier: "read_only",
    status: "available",
    autonomousAllowed: true,
    humanGateRequired: false,
    confirmationRequired: false,
    riskLevel: "none",
    reason:
      "Deterministic aggregation of existing read-only signals (control center, observability, quality review, tool boundary). Pure function, no DB write.",
    examples: [
      "Compose agentic health briefing",
      "Summarize router quality + tool boundary",
      "Generate reporting crew briefing",
    ],
  },
  {
    id: "review_router_quality",
    label: "Review router quality",
    tier: "read_only",
    status: "available",
    autonomousAllowed: true,
    humanGateRequired: false,
    confirmationRequired: false,
    riskLevel: "none",
    reason:
      "Read-only interpretation of existing router observability data. computeRouterQualityReview is a pure function over already-recorded traces.",
    examples: [
      "What is the current unknown-intent rate?",
      "Show router quality watchlist",
      "Are there dangerous refusal spikes?",
    ],
  },
  {
    id: "inspect_tool_boundary",
    label: "Inspect tool boundary",
    tier: "read_only",
    status: "available",
    autonomousAllowed: true,
    humanGateRequired: false,
    confirmationRequired: false,
    riskLevel: "none",
    reason:
      "Static reflection of the real tool registry (11 read + 7 write IDs). No tool execution, no registry mutation.",
    examples: [
      "List all read tools",
      "Show write-gated tools",
      "Which tools are forbidden autonomous?",
    ],
  },
  {
    id: "read_observability",
    label: "Read observability data",
    tier: "read_only",
    status: "available",
    autonomousAllowed: true,
    humanGateRequired: false,
    confirmationRequired: false,
    riskLevel: "none",
    reason:
      "Time-windowed read of existing AgenticRouterDecisionTrace records. No user text stored, no mutation.",
    examples: [
      "Show 24h router decision trends",
      "How many nav decisions in 7d?",
      "What are the top matched rules?",
    ],
  },
  {
    id: "explain_risk",
    label: "Explain risk",
    tier: "read_only",
    status: "available",
    autonomousAllowed: true,
    humanGateRequired: false,
    confirmationRequired: false,
    riskLevel: "low",
    reason:
      "Read-only explanation of a product/vault risk profile from available risk parameters. Output-guard enforced (no guarantees, no risk-free language); educational only, no DB write, no financial advice.",
    examples: [
      "What are the primary risks of this vault?",
      "Explain the mining counterparty risk",
      "Describe the lock-up and liquidity risk",
    ],
  },
  {
    id: "explain_provenance",
    label: "Explain provenance",
    tier: "read_only",
    status: "available",
    autonomousAllowed: true,
    humanGateRequired: false,
    confirmationRequired: false,
    riskLevel: "none",
    reason:
      "Read-only explanation of the provenance/attestation/source of a metric (Live / Oracle / Attested / Estimated / Manual / Stale). Reads existing provenance metadata only — no mutation, no external call.",
    examples: [
      "Where does this APY figure come from?",
      "Explain the proof-of-reserves attestation",
      "What is the provenance of the NAV value?",
    ],
  },
  {
    id: "read_session_context",
    label: "Read session context (metadata-only)",
    tier: "read_only",
    status: "available",
    autonomousAllowed: true,
    humanGateRequired: false,
    confirmationRequired: false,
    riskLevel: "none",
    reason:
      "Read-only, metadata-only view of agent session context (ids, counts, timestamps) for memory housekeeping. NEVER reads raw user text / conversation content / prompts; stores nothing; no mutation, no external transmission.",
    examples: [
      "How many turns in the current session?",
      "Show session metadata for distillation",
      "List session ids eligible for memory distill",
    ],
  },
  {
    id: "run_projection",
    label: "Run product projection",
    tier: "read_only",
    status: "available",
    autonomousAllowed: true,
    humanGateRequired: false,
    confirmationRequired: false,
    riskLevel: "low",
    reason:
      "Deterministic, read-only projection artifact from allowlisted inputs (scenarios, ranges, assumptions, provenance, disclaimers). Invents no number, makes no return claim, APY only as a range (ADR-006). No DB write, no external tool, no mutation, no storage.",
    examples: [
      "Project the Hearst Yield Vault over 12 months",
      "Build a bear/base/bull projection from a stated APY range",
      "Show the projected yield range for a given capital base",
    ],
  },

  // ─── DRAFT / PROPOSAL ─────────────────────────────────────────────────────
  {
    id: "create_review_note_draft",
    label: "Create review note draft",
    tier: "draft_or_proposal",
    status: "gated",
    autonomousAllowed: false,
    humanGateRequired: true,
    confirmationRequired: true,
    riskLevel: "low",
    requiredGate: "two-step HITL confirmation token",
    reason:
      "Draft only — stored with status=draft, never published without human confirmation. Gate: two-step input-bound single-use token via /api/admin/chat-tools.",
    examples: [
      "Draft a monthly investor note",
      "Create a governance review note",
      "Prepare investor communication draft",
    ],
  },
  {
    id: "create_governance_proposal_draft",
    label: "Create governance proposal draft",
    tier: "draft_or_proposal",
    status: "gated",
    autonomousAllowed: false,
    humanGateRequired: true,
    confirmationRequired: true,
    riskLevel: "medium",
    requiredGate: "two-step HITL confirmation token + admin review",
    reason:
      "Draft governance proposals are stored as drafts requiring multi-step human approval before any on-chain or operational effect. Never auto-executed.",
    examples: [
      "Draft a vault parameter change proposal",
      "Create a fee-structure governance proposal",
      "Prepare a vault guardian update proposal",
    ],
  },
  {
    id: "create_campaign_draft",
    label: "Create outreach campaign draft",
    tier: "draft_or_proposal",
    status: "gated",
    autonomousAllowed: false,
    humanGateRequired: true,
    confirmationRequired: true,
    riskLevel: "low",
    requiredGate: "two-step HITL confirmation token",
    reason:
      "Outreach campaigns are draft-only from chat. Tier A (top prospects) is never auto-sent. Tiers B/C require OUTREACH_AUTONOMY=SEND+ and explicit send run trigger.",
    examples: [
      "Draft Q3 outreach campaign for family offices",
      "Create follow-up campaign draft for Tier B prospects",
    ],
  },
  {
    id: "create_vault_draft",
    label: "Create vault draft",
    tier: "draft_or_proposal",
    status: "gated",
    autonomousAllowed: false,
    humanGateRequired: true,
    confirmationRequired: true,
    riskLevel: "medium",
    requiredGate: "two-step HITL confirmation token + blueprint completeness check",
    reason:
      "create_vault_draft is draft-only. markAsLive is a separate multi-step admin server action — never reachable from chat. No on-chain action from draft creation.",
    examples: [
      "Create a new Defensive vault draft",
      "Draft a BTC Plus vault configuration",
    ],
  },
  {
    id: "draft_outreach_email",
    label: "Draft outreach email",
    tier: "draft_or_proposal",
    status: "gated",
    autonomousAllowed: false,
    humanGateRequired: true,
    confirmationRequired: true,
    riskLevel: "low",
    requiredGate: "two-step HITL confirmation token",
    reason:
      "Email content is drafted and stored; suppression re-checked at send time. No email dispatched from draft creation alone.",
    examples: [
      "Draft intro email for Tier B prospect",
      "Create follow-up email for investor John Doe",
    ],
  },

  // ─── CONFIRMED-WRITE ──────────────────────────────────────────────────────
  {
    id: "outreach_trigger_send_run",
    label: "Trigger outreach send run",
    tier: "confirmed_write",
    status: "gated",
    autonomousAllowed: false,
    humanGateRequired: true,
    confirmationRequired: true,
    riskLevel: "high",
    requiredGate:
      "OUTREACH_AUTONOMY=SEND+ env gate + HITL token + daily cap (OUTREACH_DAILY_SEND_CAP) + suppression check + forbidden-words guard + unsubscribe link",
    reason:
      "The single confirmed-write action. Only dispatches for Tier B/C when OUTREACH_AUTONOMY=SEND+ (default=SUGGEST=no-op). Tier A never auto-sent. Hard daily cap enforced. Every send audited.",
    examples: [
      "Trigger scheduled Tier B send run",
      "Run hourly outreach cron for Tier C",
    ],
  },

  // ─── FORBIDDEN AUTONOMOUS ─────────────────────────────────────────────────
  {
    id: "source_leads_autonomously",
    label: "Source leads autonomously",
    tier: "forbidden_autonomous",
    status: "blocked",
    autonomousAllowed: false,
    humanGateRequired: true,
    confirmationRequired: true,
    riskLevel: "high",
    requiredGate: "manual admin action only",
    reason:
      "Autonomous lead sourcing (Apollo or equivalent) is not permitted from the chat agent. External PII collection requires explicit admin-side operation with full compliance review.",
    examples: ["Find 50 new family office leads", "Source investors from Apollo"],
  },
  {
    id: "deploy_product",
    label: "Deploy product to production",
    tier: "forbidden_autonomous",
    status: "blocked",
    autonomousAllowed: false,
    humanGateRequired: true,
    confirmationRequired: true,
    riskLevel: "critical",
    requiredGate: "Vercel Git deploy (push main) + Spearbit audit gate for smart contracts",
    reason:
      "Production deploy is triggered only by git push to main (Vercel auto-deploy). Smart contract mainnet deploy is gated on a completed Spearbit audit + remediation. No chat-accessible deploy path exists.",
    examples: [
      "Deploy to production",
      "Push the new vault contract to mainnet",
    ],
  },
  {
    id: "mark_vault_live",
    label: "Mark vault as live",
    tier: "forbidden_autonomous",
    status: "blocked",
    autonomousAllowed: false,
    humanGateRequired: true,
    confirmationRequired: true,
    riskLevel: "critical",
    requiredGate:
      "Admin server action requireAdmin + state machine draft→review→deployed→live + blueprint completeness + approval quorum",
    reason:
      "markAsLive is a dedicated admin server action with multi-step state machine. It is NOT a chat tool. No route from the chat agent to live-state mutation.",
    examples: ["Mark the Yield Vault as live", "Set vault status to live"],
  },
  {
    id: "safe_signature",
    label: "Safe / multisig signature",
    tier: "forbidden_autonomous",
    status: "blocked",
    autonomousAllowed: false,
    humanGateRequired: true,
    confirmationRequired: true,
    riskLevel: "critical",
    requiredGate: "multisig quorum + out-of-band hardware signing",
    reason:
      "Gnosis Safe or multisig signature is a custodial financial action. No chat agent has access to signing keys or can initiate on-chain transactions.",
    examples: [
      "Sign the Safe transaction",
      "Approve the multisig withdrawal",
    ],
  },
  {
    id: "governance_execution",
    label: "Execute governance decision",
    tier: "forbidden_autonomous",
    status: "blocked",
    autonomousAllowed: false,
    humanGateRequired: true,
    confirmationRequired: true,
    riskLevel: "critical",
    requiredGate: "governance quorum + timelock + admin multi-step confirmation",
    reason:
      "On-chain or operational governance execution requires quorum, timelock, and explicit multi-step admin confirmation. No autonomous execution path from any agent.",
    examples: [
      "Execute the approved fee-change proposal",
      "Apply governance vote outcome",
    ],
  },
  {
    id: "db_migration",
    label: "Run DB migration",
    tier: "forbidden_autonomous",
    status: "blocked",
    autonomousAllowed: false,
    humanGateRequired: true,
    confirmationRequired: true,
    riskLevel: "critical",
    requiredGate: "manual DBA + Prisma migrate dev/prod + explicit approval",
    reason:
      "Schema migrations are never triggered from within any agent, tool, or chat session. Production DB mutations (port 5432 direct) require explicit operator approval and verified rollback plan.",
    examples: [
      "Add a new column to the investors table",
      "Run prisma migrate deploy",
    ],
  },
  {
    id: "formula_model_change",
    label: "Change formula or model",
    tier: "forbidden_autonomous",
    status: "blocked",
    autonomousAllowed: false,
    humanGateRequired: true,
    confirmationRequired: true,
    riskLevel: "critical",
    requiredGate: "Methodology version bump + ADR + explicit code review + typecheck gate",
    reason:
      "The Scenario/Backtest/Risk engine is a pure function (rule #6). Model or formula changes require a Methodology version bump and ADR. No runtime or chat path can alter engine logic.",
    examples: [
      "Update the APY calculation formula",
      "Change the Monte Carlo seed injection",
    ],
  },
  {
    id: "tier_a_auto_send",
    label: "Auto-send to Tier A prospect",
    tier: "forbidden_autonomous",
    status: "blocked",
    autonomousAllowed: false,
    humanGateRequired: true,
    confirmationRequired: true,
    riskLevel: "critical",
    requiredGate: "manual send only — hard-blocked regardless of OUTREACH_AUTONOMY setting",
    reason:
      "Tier A (highest-value prospects) is NEVER auto-sent. This is a hard block regardless of environment flags or autonomy level. ADR-016.",
    examples: [
      "Auto-send intro to top-tier family office",
      "Automatically email Tier A lead list",
    ],
  },
];
