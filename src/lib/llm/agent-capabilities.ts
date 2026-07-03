import type { ChatMode } from "@/lib/llm/chat-modes";

export type AgentCapabilityKind =
  | "response"
  | "navigation"
  | "read_tool"
  | "write_tool"
  | "review";

export type AgentCapabilityTestStatus = "untested" | "red" | "orange" | "green";

export interface AgentCapabilityDefinition {
  id: string;
  label: string;
  mode: ChatMode;
  kind: AgentCapabilityKind;
  description: string;
  testPrompt: string;
  successCriteria: string;
  initialStatus?: AgentCapabilityTestStatus;
  initialNote?: string;
}

export const AGENT_CAPABILITY_DEFINITIONS: AgentCapabilityDefinition[] = [
  {
    id: "normal-product-qa",
    label: "Product / vault Q&A",
    mode: "normal",
    kind: "response",
    description:
      "Answers product, vaults, yield, custody and proof center questions with compliance guardrails.",
    testPrompt: "Explain the Hearst Yield Vault in 3 sentences.",
    successCriteria:
      "Concise, English response, no promise, with APY as a range and a correct product tone.",
    initialStatus: "green",
    initialNote:
      "Wired + tested via runChatAgent (ADR-017). route.guard.test: a 'guaranteed yield' / 'APY 11%' response is blocked (BLOCK_SENTINEL) before the LP; a range response passes. CHAT_MASTER_AGENT=0 → 503 (kill-switch), no second engine.",
  },
  {
    id: "normal-portfolio-context",
    label: "User portfolio context",
    mode: "normal",
    kind: "response",
    description:
      "Uses the injected portfolio context when present to answer without fabricating figures.",
    testPrompt: "Why is my portfolio stale?",
    successCriteria:
      "The answer relies on the real context or explicitly states that a data point is missing.",
    initialStatus: "green",
    initialNote:
      "buildPortfolioContextBlock(userId) injected into enrichedSystemPrompt (route.ts). Strict userId scope, null if 0 position. Covered by chat-context.test (cross-tenant scoping + freshness).",
  },
  {
    id: "normal-lp-navigation",
    label: "Whitelisted LP navigation",
    mode: "normal",
    kind: "navigation",
    description:
      "Can open a whitelisted product page when the Master Agent decides to navigate.",
    testPrompt: "Open my portfolio.",
    successCriteria:
      "The chat opens the correct product route without leaving the authorized whitelist.",
    initialStatus: "green",
    initialNote:
      "Navigation is 100% deterministic via regex (resolveNavFallbackDestinationKey) — before the LLM, no navigate tool exposed to the model. Covered by nav-fallback-intent + route tests.",
  },
  {
    id: "review-distill-chat",
    label: "Review document distillation",
    mode: "review",
    kind: "review",
    description:
      "Distills the conversation into a structured change document when generation is triggered.",
    testPrompt: "Switch to Review then click Generate the document.",
    successCriteria:
      "The stream ends with a usable document in the review modal.",
    initialStatus: "green",
    initialNote:
      "Targeted review/admin chat controls tests passing. The Review path is wired and validated once automatically.",
  },
  {
    id: "admin-ops-qa",
    label: "Internal ops / architecture",
    mode: "admin",
    kind: "response",
    description:
      "Answers as an internal copilot on architecture, allocations, proofs, deployments and runbooks.",
    testPrompt: "Explain the vault deployment runbook in 5 steps.",
    successCriteria:
      "The answer stays internal, actionable, with no autonomous execution or sensitive leak.",
    initialStatus: "green",
    initialNote:
      "COCKPIT_ADMIN_SYSTEM_PROMPT + buildAdminContextBlock (linted read-tools snapshot). Write tools never auto-executed (chat-agent). Model-driven Q&A and read tools go through runChatAgent; CHAT_MASTER_AGENT=0 shuts down the whole chat (503).",
  },
  {
    id: "admin-product-workspace-open",
    label: "Open Product Workspace",
    mode: "admin",
    kind: "navigation",
    description:
      "Automatically opens Product Workspace for a vault/product creation or framing.",
    testPrompt: "Create a new Defensive vault.",
    successCriteria:
      "The chat opens /admin/product-workspace with autostart and objective pre-filled.",
    initialStatus: "green",
    initialNote:
      "Navigate override + fallback intent (route.ts). autostart+objective → ChatNavBridge. Unavailable if CHAT_MASTER_AGENT=0 (503).",
  },
  {
    id: "admin-scenario-lab-open",
    label: "Open Scenario Lab",
    mode: "admin",
    kind: "navigation",
    description:
      "Opens Scenario Lab for an explicit simulation intent or as a secondary step of a product framing.",
    testPrompt: "Simulate a BTC bear scenario on the vault.",
    successCriteria:
      "The chat opens /admin/scenario-lab or adds it as a relevant secondary step.",
    initialStatus: "green",
    initialNote:
      "Product Workspace parity: navigate(admin-scenario-lab) + fallback simulation intent. Unavailable if CHAT_MASTER_AGENT=0 (503).",
  },
  {
    id: "admin-new-client-action",
    label: "New client / create investor",
    mode: "admin",
    kind: "write_tool",
    description:
      "Create a new client/investor from the chat or open the right customer surface directly.",
    testPrompt: "Create a new client and open the customer record.",
    successCriteria:
      "The chat can at least open the right customer surface, ideally pre-fill without leaving scope.",
    initialStatus: "orange",
    initialNote:
      "admin-customers navigation + keyword fallback. No create_investor write tool — surface opening only (HITL write tool to wire if needed).",
  },
  {
    id: "admin-email-send-action",
    label: "Send emails / outreach",
    mode: "admin",
    kind: "write_tool",
    description:
      "Prepare or send an email/outreach from the chat on a dedicated surface.",
    testPrompt: "Prepare then send a prospecting email to a new client.",
    successCriteria:
      "The chat must either open a dedicated outreach surface or run an explicitly confirmed flow.",
    initialStatus: "orange",
    initialNote:
      "admin-outreach navigation + HITL write tools (outreach_source_leads, outreach_draft_email, outreach_trigger_send_run) via the admin Actions panel — no model auto-exec. Real sending governed by OUTREACH_AUTONOMY (ADR-016).",
  },
  {
    id: "admin-read-allocations",
    label: "Read canonical allocations",
    mode: "admin",
    kind: "read_tool",
    description: "Reads the canonical vault allocations.",
    testPrompt: "Give me the canonical vault allocations.",
    successCriteria:
      "The result returns the expected allocations without mutation or fabrication.",
    initialStatus: "green",
    initialNote:
      "Read tool wired + registry/chat-tools tests. (a) admin execute_read panel — independent of the chat kill-switch. (b) Model-driven via runChatAgent in admin mode.",
  },
  {
    id: "admin-read-market-snapshot",
    label: "Read market snapshot",
    mode: "admin",
    kind: "read_tool",
    description: "Reads the latest mining and vault snapshot.",
    testPrompt: "What is the latest market snapshot?",
    successCriteria:
      "The result returns the available market signals with honest freshness.",
    initialStatus: "green",
    initialNote:
      "Read tool wired + registry/chat-tools tests. (a) admin execute_read panel — independent of the chat kill-switch. (b) Model-driven via runChatAgent in admin mode.",
  },
  {
    id: "admin-read-routes-index",
    label: "Read routes index",
    mode: "admin",
    kind: "read_tool",
    description: "Reads an example index of the product/admin routes.",
    testPrompt: "List the key routes for an admin demo.",
    successCriteria:
      "The result cites the relevant demo routes without leaving scope.",
    initialStatus: "green",
    initialNote:
      "Read tool wired + registry/chat-tools tests. (a) admin execute_read panel — independent of the chat kill-switch. (b) Model-driven via runChatAgent in admin mode.",
  },
  {
    id: "admin-read-specs-index",
    label: "Read specs index",
    mode: "admin",
    kind: "read_tool",
    description: "Reads an example index of the spec docs.",
    testPrompt: "Which specs cover vaults and governance?",
    successCriteria:
      "The result points to the relevant indexed specs.",
    initialStatus: "green",
    initialNote:
      "Read tool wired + registry/chat-tools tests. (a) admin execute_read panel — independent of the chat kill-switch. (b) Model-driven via runChatAgent in admin mode.",
  },
  {
    id: "admin-read-runtime-capabilities",
    label: "Read runtime capabilities",
    mode: "admin",
    kind: "read_tool",
    description: "Exposes the matrix of currently tooled runtime capabilities.",
    testPrompt: "Tell me what you can really do in this chat.",
    successCriteria:
      "The result clearly distinguishes navigation, reading, limits and non-tooled actions.",
    initialStatus: "green",
    initialNote:
      "Read tool wired and consistent with the current runtime audit.",
  },
  {
    id: "admin-generate-chart-spec",
    label: "Generate chart spec",
    mode: "admin",
    kind: "read_tool",
    description: "Generates a deterministic chart spec from the available data.",
    testPrompt: "Generate a chart spec for APY vs risk over 30 days.",
    successCriteria:
      "The JSON/tool output contains a usable spec with type, series, timeframe and provenance.",
    initialStatus: "green",
    initialNote:
      "Admin utility wired + tested. (a) Form panel /api/admin/chat-tools. (b) Model-driven via runChatAgent in admin mode.",
  },
  {
    id: "admin-generate-demo-plan",
    label: "Generate demo plan",
    mode: "admin",
    kind: "read_tool",
    description: "Generates an ordered demo plan for the admin from the routes/specs.",
    testPrompt: "Generate a demo plan to present the product to internal stakeholders.",
    successCriteria:
      "The result correctly orders the steps and the routes to present.",
    initialStatus: "green",
    initialNote:
      "Admin utility wired + tested. (a) Form panel /api/admin/chat-tools. (b) Model-driven via runChatAgent in admin mode.",
  },
  {
    id: "admin-export-demo-pack",
    label: "Export demo pack",
    mode: "admin",
    kind: "read_tool",
    description:
      "Produces a structured demo pack with plan, charts and checklist.",
    testPrompt: "Export a demo pack for an admin walkthrough.",
    successCriteria:
      "The result contains a structured pack with metadata, plan, charts and checklist.",
    initialStatus: "green",
    initialNote:
      "Admin utility wired + tested. (a) Form panel /api/admin/chat-tools. (b) Model-driven via runChatAgent in admin mode.",
  },
  {
    id: "admin-export-briefing-pack",
    label: "Export briefing pack",
    mode: "admin",
    kind: "read_tool",
    description:
      "Produces a structured executive briefing pack for internal use.",
    testPrompt: "Export a briefing pack for an internal IC.",
    successCriteria:
      "The result contains a usable executive briefing with a summary and an action plan.",
    initialStatus: "green",
    initialNote:
      "Admin utility wired + tested. (a) Form panel /api/admin/chat-tools. (b) Model-driven via runChatAgent in admin mode.",
  },
  {
    id: "admin-create-review-note-draft",
    label: "Create review note draft",
    mode: "admin",
    kind: "write_tool",
    description:
      "Prepares a review note draft via mandatory human confirmation.",
    testPrompt: "Prepare a review note draft on the vault.",
    successCriteria:
      "The system first asks for confirmation, then executes only after validation.",
    initialStatus: "green",
    initialNote:
      "Write tool UI + confirmation flow covered by the admin chat tools / controls tests.",
  },
  {
    id: "admin-create-governance-proposal-draft",
    label: "Create governance proposal draft",
    mode: "admin",
    kind: "write_tool",
    description:
      "Prepares a governance proposal draft via mandatory human confirmation.",
    testPrompt: "Prepare a governance proposal draft for a parameter change.",
    successCriteria:
      "The system first asks for confirmation and executes nothing automatically.",
    initialStatus: "green",
    initialNote:
      "Write tool UI + confirmation flow covered by the admin chat tools / controls tests.",
  },
];
