import type { CrewSimulationScenario } from "./types";

export const CREW_SIMULATION_SCENARIOS: CrewSimulationScenario[] = [
  {
    id: "reporting_crew_briefing",
    label: "Reporting Crew — Executive Briefing",
    trigger: "Admin requests a structured briefing of the agentic platform state",
    mode: "read_only",
    risk: "none",
    executable: false,
    steps: [
      {
        id: "step_collect_observability",
        label: "Collect Router Observability",
        description:
          "Read the current router observability summary: outcome distribution, top matched rules, recent traces, aggregation mode.",
        mode: "read_only",
        executable: false,
        usesToolIds: ["read_router_observability", "read_agentic_traces"],
        produces: ["observability_summary"],
        gateRequired: false,
      },
      {
        id: "step_collect_quality",
        label: "Collect Quality Review",
        description:
          "Read router quality metrics: unknown rate, dangerous-refusal rate, educational rate, fallback rate, watchlist items.",
        mode: "read_only",
        executable: false,
        usesToolIds: ["read_router_quality_review"],
        produces: ["quality_review_summary"],
        gateRequired: false,
      },
      {
        id: "step_collect_tool_boundary",
        label: "Collect Tool Boundary State",
        description:
          "Read tool boundary classification: read/draft/confirmed-write/forbidden tiers, consistency warnings.",
        mode: "read_only",
        executable: false,
        usesToolIds: ["read_tool_boundary"],
        produces: ["tool_boundary_summary"],
        gateRequired: false,
      },
      {
        id: "step_collect_control_center",
        label: "Collect Control Center Inventory",
        description:
          "Read the agentic control center: agent inventory, human gates, prompt map, safety summary, next steps.",
        mode: "read_only",
        executable: false,
        usesToolIds: ["read_control_center"],
        produces: ["control_center_summary"],
        gateRequired: false,
      },
      {
        id: "step_compose_briefing",
        label: "Compose Executive Briefing",
        description:
          "Deterministically compose the briefing from the four inputs. No LLM call. No write. Output is a structured JSON document.",
        mode: "read_only",
        executable: false,
        usesToolIds: [],
        produces: ["crew_briefing"],
        gateRequired: false,
      },
    ],
    forbiddenActions: [
      "send_outreach",
      "source_prospect",
      "deploy_contract",
      "mark_live",
      "execute_tool",
      "write_database",
      "modify_router",
      "change_guard",
    ],
    safetyNotes: [
      "All inputs are read-only. No data is modified.",
      "Output is a structured summary for human review only.",
      "No LLM call is made during this simulation.",
      "No gate is required because no write action is possible.",
    ],
  },

  {
    id: "outreach_draft_flow",
    label: "Outreach Draft Flow",
    trigger: "Admin requests a draft outreach email or campaign for a prospect segment",
    mode: "draft_only",
    risk: "medium",
    executable: false,
    steps: [
      {
        id: "step_read_prospects",
        label: "Read Prospect Data",
        description:
          "Read CRM prospect records, tier assignments, and last-contact timestamps. No write.",
        mode: "read_only",
        executable: false,
        usesToolIds: ["read_crm_prospects"],
        produces: ["prospect_list"],
        gateRequired: false,
      },
      {
        id: "step_read_templates",
        label: "Read Outreach Templates",
        description:
          "Read available outreach templates for the target tier (A/B/C). No modification.",
        mode: "read_only",
        executable: false,
        usesToolIds: ["read_outreach_templates"],
        produces: ["template_candidates"],
        gateRequired: false,
      },
      {
        id: "step_generate_draft",
        label: "Generate Draft Email",
        description:
          "Produce a personalized draft email using the selected template and prospect data. Draft is not stored until human confirms.",
        mode: "draft_only",
        executable: false,
        usesToolIds: ["create_outreach_draft"],
        produces: ["draft_email"],
        gateRequired: false,
      },
      {
        id: "step_compliance_check",
        label: "Run Compliance Pre-check",
        description:
          "Check draft for forbidden words, single-point APY, guarantee language. Block draft if violations found.",
        mode: "read_only",
        executable: false,
        usesToolIds: ["read_output_guard"],
        produces: ["compliance_result"],
        gateRequired: false,
      },
      {
        id: "step_await_human_gate",
        label: "Await Human Approval Gate",
        description:
          "Draft is presented to admin. Sending is BLOCKED until explicit human confirmation via two-step HITL token.",
        mode: "confirmed_write_blocked",
        executable: false,
        usesToolIds: [],
        produces: ["hitl_gate_token"],
        gateRequired: true,
      },
    ],
    forbiddenActions: [
      "auto_send_outreach",
      "send_without_hitl_token",
      "send_tier_a_outreach",
      "deploy_contract",
      "mark_live",
      "source_prospect_autonomous",
    ],
    safetyNotes: [
      "Tier A outreach is NEVER auto-sent. Hard rule.",
      "Any send requires a valid two-step HITL confirmation token.",
      "Draft is not persisted until admin explicitly saves.",
      "Compliance guard runs before any draft is shown.",
      "OUTREACH_AUTONOMY must be SEND+ for any auto-send; default is SUGGEST.",
    ],
  },

  {
    id: "product_review_flow",
    label: "Product Review Flow",
    trigger: "Admin initiates a product/vault review session to produce structured review notes",
    mode: "read_only",
    risk: "low",
    executable: false,
    steps: [
      {
        id: "step_read_vault_state",
        label: "Read Vault State",
        description:
          "Read current vault parameters: APY range, provenance badges, share classes, methodology version.",
        mode: "read_only",
        executable: false,
        usesToolIds: ["read_vault_config"],
        produces: ["vault_state_snapshot"],
        gateRequired: false,
      },
      {
        id: "step_read_scenario_results",
        label: "Read Scenario Engine Results",
        description:
          "Read latest scenario simulation outputs (p5/p50/p95, assumptions, disclaimers). Engine is pure — no re-run triggered.",
        mode: "read_only",
        executable: false,
        usesToolIds: ["read_scenario_results"],
        produces: ["scenario_snapshot"],
        gateRequired: false,
      },
      {
        id: "step_compose_review_notes",
        label: "Compose Review Notes",
        description:
          "Compose structured review notes from vault state and scenario results. Draft only — no state change.",
        mode: "draft_only",
        executable: false,
        usesToolIds: [],
        produces: ["review_notes_draft"],
        gateRequired: false,
      },
    ],
    forbiddenActions: [
      "deploy_contract",
      "mark_vault_live",
      "mark_live",
      "modify_scenario_parameters",
      "change_methodology",
      "execute_rebalancing",
    ],
    safetyNotes: [
      "No vault state is modified. Review is strictly read-only.",
      "APY must always be a range in output — never a single point.",
      "Every metric in output requires a provenance badge.",
      "No financial action is reachable from this flow.",
    ],
  },

  {
    id: "risk_explanation_flow",
    label: "Risk Explanation Flow",
    trigger: "User asks the Master Agent to explain risk profile of the current vault or scenario",
    mode: "read_only",
    risk: "low",
    executable: false,
    steps: [
      {
        id: "step_read_risk_params",
        label: "Read Risk Parameters",
        description:
          "Read CVaR, max drawdown, volatility assumptions, mining health indicators from the scenario engine read path.",
        mode: "read_only",
        executable: false,
        usesToolIds: ["read_risk_params", "read_mining_health"],
        produces: ["risk_parameter_snapshot"],
        gateRequired: false,
      },
      {
        id: "step_explain_risk",
        label: "Compose Risk Explanation",
        description:
          "Generate a human-readable risk explanation. Must include APY range, provenance badge, not-guaranteed disclaimer. No advice.",
        mode: "read_only",
        executable: false,
        usesToolIds: [],
        produces: ["risk_explanation"],
        gateRequired: false,
      },
      {
        id: "step_guard_check",
        label: "Output Guard Check",
        description:
          "Pass explanation through compliance guard: forbidden words, single-point APY, guarantee language. Block if violations.",
        mode: "read_only",
        executable: false,
        usesToolIds: ["read_output_guard"],
        produces: ["guard_result"],
        gateRequired: false,
      },
    ],
    forbiddenActions: [
      "give_financial_advice",
      "guarantee_return",
      "promise_yield",
      "write_risk_params",
      "execute_rebalancing",
      "send_outreach",
    ],
    safetyNotes: [
      "Output guard always runs — forbidden words and single-point APY block the response.",
      "No financial advice is produced. Explanation only.",
      "APY is always expressed as a range (e.g. 8-15%).",
      "All figures carry a provenance badge (Live/Oracle/Attested/Estimated/Manual/Stale).",
      "No write tool is reachable from this flow.",
    ],
  },

  {
    id: "vault_readiness_flow",
    label: "Vault Readiness Flow",
    trigger: "Admin requests a readiness assessment before considering a vault state change",
    mode: "read_only",
    risk: "high",
    executable: false,
    steps: [
      {
        id: "step_read_contract_state",
        label: "Read Smart Contract State",
        description:
          "Read Base Sepolia contract parameters: vault address, guardian, owner timelock, ERC-4626 state. Mainnet deploy is gated on Spearbit audit.",
        mode: "read_only",
        executable: false,
        usesToolIds: ["read_contract_state"],
        produces: ["contract_state_snapshot"],
        gateRequired: false,
      },
      {
        id: "step_read_adr_gates",
        label: "Read ADR Gates",
        description:
          "Check ADR-006 (audit gate), ADR-012 (no financial action from chat), ADR-017 (single chat engine). No gate is lifted here.",
        mode: "read_only",
        executable: false,
        usesToolIds: ["read_adr_registry"],
        produces: ["adr_gate_status"],
        gateRequired: false,
      },
      {
        id: "step_compose_readiness",
        label: "Compose Readiness Assessment",
        description:
          "Compose a readiness report: blockers, missing gates, required approvals. Output is advisory only.",
        mode: "read_only",
        executable: false,
        usesToolIds: [],
        produces: ["readiness_assessment"],
        gateRequired: false,
      },
    ],
    forbiddenActions: [
      "mark_vault_live",
      "mark_live",
      "deploy_to_mainnet",
      "lift_audit_gate",
      "approve_spearbit_bypass",
      "execute_on_chain",
      "sign_transaction",
    ],
    safetyNotes: [
      "Mainnet deploy is HARD-BLOCKED until Spearbit audit + remediation (ADR-006).",
      "mark_vault_live is a multi-sig admin action — unreachable from any chat or crew flow.",
      "This assessment is advisory. No state is changed.",
      "Risk is rated HIGH because the flow touches contract state context — output must be handled carefully.",
    ],
  },

  {
    id: "memory_distill_flow",
    label: "Memory Distill Flow",
    trigger: "System or admin triggers a memory distillation pass to summarize agent session context",
    mode: "read_only",
    risk: "low",
    executable: false,
    steps: [
      {
        id: "step_read_session_context",
        label: "Read Session Context",
        description:
          "Read recent agent session transcripts and structured outputs. No user message content is stored per privacy rules.",
        mode: "read_only",
        executable: false,
        usesToolIds: ["read_session_context"],
        produces: ["session_context_snapshot"],
        gateRequired: false,
      },
      {
        id: "step_distill_summary",
        label: "Distill Summary",
        description:
          "Produce a concise, structured summary of the session context. No external action. No outreach. No write.",
        mode: "read_only",
        executable: false,
        usesToolIds: [],
        produces: ["distilled_summary"],
        gateRequired: false,
      },
    ],
    forbiddenActions: [
      "store_user_message_text",
      "send_summary_externally",
      "trigger_outreach_from_summary",
      "modify_session_data",
      "execute_any_tool",
    ],
    safetyNotes: [
      "No user message text is ever stored or summarized — only metadata.",
      "Distilled summary stays in the admin session. No external transmission.",
      "No outreach or external action is triggered from a distilled summary.",
    ],
  },
];

export const SCENARIO_IDS = CREW_SIMULATION_SCENARIOS.map((s) => s.id);
