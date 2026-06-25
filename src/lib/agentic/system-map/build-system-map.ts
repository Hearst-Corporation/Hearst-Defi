// Agentic System Map v0 — graph builder (pure, read-only).
//
// Composes the existing read-only summaries into a visual graph: layered groups,
// nodes (router / guards / crews / agents / tools / gates / observability /
// surfaces) with live status + metrics, and edges (routes / reads / guards /
// gates / observes / composes / forbids). Pure + deterministic: no tool is
// executed, no LLM is called, no write is performed, no Date.now is used.

import type {
  AgenticControlCenterData,
  RouterStatusSummary,
} from "@/lib/agentic/control-center/types";
import type { RouterObservabilitySummary } from "@/lib/agentic/observability/types";
import type { ToolBoundaryV1Summary } from "@/lib/agentic/tool-boundary/types";
import type { ReportingCrewBriefing } from "@/lib/agentic/reporting/types";
import type { ActionReadinessMatrix } from "@/lib/agentic/action-readiness/types";
import type { CrewSimulationResult } from "@/lib/agentic/crew-simulation/types";
import type {
  AgenticSystemEdge,
  AgenticSystemGroup,
  AgenticSystemMap,
  AgenticSystemNode,
  AgenticSystemRisk,
} from "./types";
import {
  deriveRouterStatus,
  deriveObservabilityStatus,
  deriveQualityStatus,
  deriveToolBoundaryStatus,
  deriveReportingStatus,
} from "./derive-system-map-status";

/** Static marker — NOT a live timestamp (pure code has no Date.now). */
const GENERATED_AT = "live read-only system map (static marker)";

const SAFETY_NOTES: string[] = [
  "Read-only system map. No tool is executed, no write is performed, and no prompts, user messages, or tool payloads are stored.",
  "Edges describe how the system is wired (routes / reads / guards / gates / observes / composes / forbids) — they are not actions.",
  "Every write tool is gated (HITL) and non-autonomous; forbidden-autonomous actions are represented but are never callable tools.",
];

/** Group (layer) ids. */
export const GROUP = {
  control: "control",
  crews: "crews",
  observability: "observability",
  tools: "tools",
  actions: "actions",
  simulation: "simulation",
} as const;

const GROUPS: AgenticSystemGroup[] = [
  {
    id: GROUP.control,
    label: "Control Layer",
    summary: "The deterministic router, the compliance guards, the HITL gates, and the tool boundary that bound every action.",
  },
  {
    id: GROUP.crews,
    label: "Crews & Agents",
    summary: "The read-only reporting crew plus the batch agents and admin surfaces (outreach, product, risk, memory, vault).",
  },
  {
    id: GROUP.observability,
    label: "Observability Layer",
    summary: "Durable router traces, SQL aggregates, trends, retention, and the quality review derived from them.",
  },
  {
    id: GROUP.tools,
    label: "Tool Layer",
    summary: "Read tools, draft/proposal tools, the single confirmed-write tool, and the forbidden-autonomous actions.",
  },
  {
    id: GROUP.actions,
    label: "Action Readiness",
    summary: "Every platform action classified by tier: which may run autonomously (read-only), which are HITL-gated (draft / confirmed-write), and which are forbidden-autonomous.",
  },
  {
    id: GROUP.simulation,
    label: "Crew Simulation",
    summary: "Read-only simulated crew flows — what each crew WOULD do, step by step, with its gates and blocked actions. Nothing is executable.",
  },
];

/** Map a control-center RiskLevel-ish to the map risk scale. */
function asRisk(value: string | undefined): AgenticSystemRisk {
  switch (value) {
    case "none":
    case "low":
    case "medium":
    case "high":
    case "critical":
      return value;
    default:
      return "low";
  }
}

interface BuildInputs {
  controlCenter: AgenticControlCenterData;
  observability: RouterObservabilitySummary | null;
  reporting: ReportingCrewBriefing | null;
  /** Action Readiness matrix (v1 integration). Optional/best-effort — null degrades nodes. */
  actionReadiness?: ActionReadinessMatrix | null;
  /** Crew Simulation results (v1 integration). Optional/best-effort — null degrades nodes. */
  crewSimulations?: CrewSimulationResult[] | null;
}

function routerSummary(router: RouterStatusSummary): string {
  return `Deterministic intent router, ${router.status} · ${router.mode} (${router.version}). Classifies before the LLM; never relaxes the guard.`;
}

/**
 * Build the full agentic system map. Pure + deterministic. `observability` and
 * `reporting` may be null (best-effort) — nodes degrade to no_data, never throw.
 */
export function buildAgenticSystemMap(inputs: BuildInputs): AgenticSystemMap {
  const { controlCenter, observability, reporting } = inputs;
  const actionReadiness = inputs.actionReadiness ?? null;
  const crewSimulations = inputs.crewSimulations ?? null;
  const tb: ToolBoundaryV1Summary | undefined = controlCenter.toolBoundaryV1;
  const review = observability?.qualityReview;

  const nodes: AgenticSystemNode[] = [];
  const edges: AgenticSystemEdge[] = [];

  // ---- Control Layer -------------------------------------------------------
  nodes.push({
    id: "router",
    label: "Intent Router",
    type: "router",
    status: deriveRouterStatus(controlCenter.router),
    mode: "control",
    risk: "low",
    group: GROUP.control,
    summary: routerSummary(controlCenter.router),
    source: "src/lib/agentic/intent-router",
    detailHref: "#router",
    metrics: [
      { label: "status", value: controlCenter.router.status },
      { label: "mode", value: controlCenter.router.mode },
    ],
  });

  const guardCount = controlCenter.inventory.filter((i) => i.type === "guard").length;
  nodes.push({
    id: "guard",
    label: "Compliance Guards",
    type: "guard",
    status: "healthy",
    mode: "control",
    risk: "critical",
    group: GROUP.control,
    summary: "Forbidden-words, APY-range, and output-stream guards run on every human-facing surface. Never bypassed by the router.",
    source: "src/lib/agents/forbidden-words.ts · apy-range.ts · src/lib/llm/output-guard.ts",
    detailHref: "#compliance-guards",
    metrics: [{ label: "guards", value: String(guardCount) }],
  });

  const gatedWrites = tb
    ? tb.counts.draft_or_proposal + tb.counts.confirmed_write
    : controlCenter.gates.length;
  const autonomousGates = controlCenter.gates.filter((g) => g.autonomousAllowed).length;
  nodes.push({
    id: "hitl-gates",
    label: "HITL Gates",
    type: "gate",
    status: autonomousGates > 0 ? "alert" : "healthy",
    mode: "control",
    risk: "high",
    group: GROUP.control,
    summary: `Every write is a draft behind a two-step, input-bound, single-use confirmation token. ${autonomousGates} gate(s) allow autonomous action (expected 0).`,
    source: "src/lib/llm/tools/confirmations.ts",
    detailHref: "#human-gates",
    metrics: [
      { label: "gated writes", value: String(gatedWrites) },
      { label: "autonomous", value: String(autonomousGates) },
    ],
  });

  nodes.push({
    id: "tool-boundary",
    label: "Tool Boundary",
    type: "tool",
    status: deriveToolBoundaryStatus(tb),
    mode: "control",
    risk: "medium",
    group: GROUP.control,
    summary: tb
      ? `${tb.counts.read_only} read · ${tb.counts.draft_or_proposal} draft · ${tb.counts.confirmed_write} confirmed-write · ${tb.counts.unknown} unknown.`
      : "Tool boundary reflection unavailable.",
    source: "src/lib/agentic/tool-boundary",
    detailHref: "#tool-boundary-v1",
    metrics: tb
      ? [
          { label: "read", value: String(tb.counts.read_only) },
          { label: "write", value: String(tb.counts.draft_or_proposal + tb.counts.confirmed_write) },
          { label: "unknown", value: String(tb.counts.unknown) },
        ]
      : undefined,
  });

  // ---- Crews & Agents ------------------------------------------------------
  nodes.push({
    id: "reporting-crew",
    label: "Reporting Crew",
    type: "crew",
    status: deriveReportingStatus(reporting),
    mode: "read_only",
    risk: "none",
    group: GROUP.crews,
    summary: reporting
      ? `Read-only briefing (${reporting.status}) composing observability, quality review, tool boundary, gates, and safety.`
      : "Read-only briefing — composes existing summaries.",
    source: "src/lib/agentic/reporting",
    detailHref: "#reporting-crew",
    metrics: reporting
      ? [{ label: "status", value: reporting.status }]
      : undefined,
  });

  // Real agents/surfaces from the inventory — grouped into logical crew nodes.
  const inv = controlCenter.inventory;
  const has = (id: string) => inv.some((i) => i.id === id);

  nodes.push({
    id: "outreach-logic",
    label: "Outreach Logic",
    type: "agent",
    status: "healthy",
    mode: "draft",
    risk: "medium",
    group: GROUP.crews,
    summary: "Outreach scorer (read), writer + reply handler (gated). Source/draft/send are HITL tools; Tier A is never auto-sent.",
    source: "src/lib/agents/outreach-*",
    detailHref: "#agents-inventory",
    metrics: [
      {
        label: "agents",
        value: String(inv.filter((i) => i.domain === "outreach").length),
      },
    ],
  });

  nodes.push({
    id: "product-review",
    label: "Product Review",
    type: "surface",
    status: "healthy",
    mode: "read_only",
    risk: "low",
    group: GROUP.crews,
    summary: "Admin product-review surface — review-mode, read-only over product/spec data.",
    source: "src/app/admin (product review)",
    detailHref: "#agents-inventory",
  });

  nodes.push({
    id: "risk-explanation",
    label: "Risk Explanation",
    type: "agent",
    status: "healthy",
    mode: "read_only",
    risk: "low",
    group: GROUP.crews,
    summary: "Batch agent producing structured risk explanations — guarded on every human-facing output.",
    source: "src/lib/agents (risk explanation)",
    detailHref: "#agents-inventory",
  });

  nodes.push({
    id: "memory-distill",
    label: "Memory Distill",
    type: "agent",
    status: has("memory-distill") ? "healthy" : "planned",
    mode: "read_only",
    risk: "medium",
    group: GROUP.crews,
    summary: "Worker that distils memory from existing data — read-derived, gated where it writes.",
    source: "src/lib/agents (memory)",
    detailHref: "#agents-inventory",
  });

  nodes.push({
    id: "vault-readiness",
    label: "Vault Readiness",
    type: "surface",
    status: "healthy",
    mode: "control",
    risk: "high",
    group: GROUP.crews,
    summary: "Vault readiness / deploy-safety surface. Going live (markAsLive) is a human state-machine action, never a tool.",
    source: "src/app/admin/vaults",
    detailHref: "#agents-inventory",
  });

  nodes.push({
    id: "product-workspace",
    label: "Product Workspace",
    type: "surface",
    status: "healthy",
    mode: "draft",
    risk: "medium",
    group: GROUP.crews,
    summary: "Canvas product workspace — drafts only, gated; no autonomous write.",
    source: "src/app/admin/product-workspace",
    detailHref: "#agents-inventory",
  });

  // ---- Observability Layer -------------------------------------------------
  nodes.push({
    id: "router-observability",
    label: "Router Observability",
    type: "observability",
    status: deriveObservabilityStatus(observability),
    mode: "observe",
    risk: "none",
    group: GROUP.observability,
    summary: observability
      ? `Durable traces · storage ${observability.storage} · window ${observability.window} · ${observability.stats.total} decision(s).`
      : "Durable router-decision traces (read-only).",
    source: "src/lib/agentic/observability",
    detailHref: "#router-observability",
    metrics: observability
      ? [
          { label: "storage", value: observability.storage },
          { label: "decisions", value: String(observability.stats.total) },
        ]
      : undefined,
  });

  nodes.push({
    id: "sql-aggregates",
    label: "SQL Aggregates",
    type: "observability",
    status: observability?.aggregationMode === "sql" ? "healthy" : observability ? "watch" : "no_data",
    mode: "observe",
    risk: "none",
    group: GROUP.observability,
    summary: observability?.aggregationMode
      ? `Window stats/trends via ${observability.aggregationMode === "sql" ? "SQL GROUP BY (O(buckets))" : `${observability.aggregationMode} aggregation`}.`
      : "SQL aggregate reads for durable observability.",
    source: "src/lib/agentic/observability/db-aggregates.ts",
    detailHref: "#router-observability",
  });

  nodes.push({
    id: "quality-review",
    label: "Quality Review",
    type: "observability",
    status: deriveQualityStatus(observability),
    mode: "observe",
    risk: "none",
    group: GROUP.observability,
    summary: review
      ? `Health rates + watchlist over ${review.total} decisions; ${review.activeSignalCount} active signal(s).`
      : "Read-only interpretation of observability (rates + watchlist).",
    source: "src/lib/agentic/observability/quality-review.ts",
    detailHref: "#router-quality-review",
    metrics: review
      ? [{ label: "active signals", value: String(review.activeSignalCount) }]
      : undefined,
  });

  nodes.push({
    id: "trends",
    label: "Trends",
    type: "observability",
    status: observability && observability.state === "enabled" ? "healthy" : "no_data",
    mode: "observe",
    risk: "none",
    group: GROUP.observability,
    summary: "Time-bucketed outcome trends across 1h / 24h / 7d / 30d windows.",
    source: "src/lib/agentic/observability/trends.ts",
    detailHref: "#router-observability",
  });

  nodes.push({
    id: "retention",
    label: "Retention",
    type: "observability",
    status: "healthy",
    mode: "control",
    risk: "low",
    group: GROUP.observability,
    summary: observability
      ? `Durable rows pruned best-effort beyond ${observability.retentionDays} days (read-only policy, dry-run-default helper).`
      : "Retention policy over durable traces (read-only).",
    source: "src/lib/agentic/observability/retention.ts",
    detailHref: "#router-observability",
  });

  // ---- Tool Layer ----------------------------------------------------------
  nodes.push({
    id: "read-tools",
    label: "Read Tools",
    type: "tool",
    status: "healthy",
    mode: "read_only",
    risk: "low",
    group: GROUP.tools,
    summary: "Bounded reads + read-only generation. No DB write, no confirmation.",
    source: "src/lib/llm/tools/registry.ts",
    detailHref: "#tool-boundary-v1",
    metrics: tb ? [{ label: "count", value: String(tb.counts.read_only) }] : undefined,
  });

  nodes.push({
    id: "draft-tools",
    label: "Draft / Proposal Tools",
    type: "tool",
    status: "healthy",
    mode: "draft",
    risk: "medium",
    group: GROUP.tools,
    summary: "Persist a draft / proposal state only — HITL-gated, never live/executed/sent.",
    source: "src/lib/llm/tools/registry.ts",
    detailHref: "#tool-boundary-v1",
    metrics: tb ? [{ label: "count", value: String(tb.counts.draft_or_proposal) }] : undefined,
  });

  nodes.push({
    id: "confirmed-write-tools",
    label: "Confirmed-Write Tools",
    type: "tool",
    status: "healthy",
    mode: "confirmed_write",
    risk: "high",
    group: GROUP.tools,
    summary: "The only tool with an external effect (outreach_trigger_send_run) — runs the same governed send job, HITL-gated, Tier A never auto-sent.",
    source: "src/lib/llm/tools/registry.ts",
    detailHref: "#tool-boundary-v1",
    metrics: tb ? [{ label: "count", value: String(tb.counts.confirmed_write) }] : undefined,
  });

  nodes.push({
    id: "forbidden-autonomous",
    label: "Forbidden-Autonomous",
    type: "tool",
    status: "healthy",
    mode: "forbidden",
    risk: "critical",
    group: GROUP.tools,
    summary: "Deploy / mark-live / governance-execute / Safe signature / DB migration / Tier A auto-send — represented, never callable tools.",
    source: "ADR-012 / ADR-016 / ADR-017",
    detailHref: "#tool-boundary-v1",
    metrics: tb
      ? [{ label: "count", value: String(tb.counts.forbidden_autonomous) }]
      : undefined,
  });

  // Promote inventory risk onto the outreach/risk nodes where available.
  for (const node of nodes) {
    const match = inv.find((i) => i.id === node.id);
    if (match) node.risk = asRisk(match.riskLevel);
  }

  // ---- Action Readiness Layer (v1 integration) -----------------------------
  // Reflects the action-readiness matrix: which actions may run autonomously
  // (read-only), which are HITL-gated, and which are forbidden-autonomous.
  const ar = actionReadiness;
  const arCounts = ar?.counts;
  nodes.push({
    id: "action-readiness",
    label: "Action Readiness",
    type: "tool",
    status: ar ? "healthy" : "no_data",
    mode: "control",
    risk: "medium",
    group: GROUP.actions,
    summary: ar
      ? `${ar.items.length} platform actions classified — read-only run autonomously, draft/confirmed-write stay gated, forbidden are never callable.`
      : "Read-only classification of every platform action by tier.",
    source: "src/lib/agentic/action-readiness",
    detailHref: "#action-readiness",
    metrics: arCounts
      ? [
          { label: "actions", value: String(ar!.items.length) },
          { label: "forbidden", value: String(arCounts.forbidden_autonomous) },
        ]
      : undefined,
  });

  nodes.push({
    id: "read-only-actions",
    label: "Read-only Actions",
    type: "tool",
    status: "healthy",
    mode: "read_only",
    risk: "low",
    group: GROUP.actions,
    summary: "Actions that may run autonomously because they only read — navigate, explain, compose briefing, inspect.",
    source: "action-readiness · tier read_only",
    detailHref: "#action-readiness",
    metrics: arCounts ? [{ label: "count", value: String(arCounts.read_only) }] : undefined,
  });

  nodes.push({
    id: "draft-actions",
    label: "Draft / Proposal Actions",
    type: "tool",
    status: "healthy",
    mode: "draft",
    risk: "medium",
    group: GROUP.actions,
    summary: "Actions that persist a draft / proposal only — HITL-gated, non-autonomous (review notes, governance/vault/campaign drafts, outreach email draft).",
    source: "action-readiness · tier draft_or_proposal",
    detailHref: "#action-readiness",
    metrics: arCounts ? [{ label: "count", value: String(arCounts.draft_or_proposal) }] : undefined,
  });

  nodes.push({
    id: "confirmed-write-actions",
    label: "Confirmed-write Actions",
    type: "tool",
    status: "healthy",
    mode: "confirmed_write",
    risk: "high",
    group: GROUP.actions,
    summary: "The single confirmed-write action (outreach send run) — multi-gated: env autonomy + HITL token + daily cap + suppression + forbidden-words; Tier A never auto-sent.",
    source: "action-readiness · tier confirmed_write",
    detailHref: "#action-readiness",
    metrics: arCounts ? [{ label: "count", value: String(arCounts.confirmed_write) }] : undefined,
  });

  nodes.push({
    id: "forbidden-actions",
    label: "Forbidden Actions",
    type: "tool",
    status: "healthy",
    mode: "forbidden",
    risk: "critical",
    group: GROUP.actions,
    summary: "Actions that must never be autonomous — deploy, mark-live, Safe signature, governance execution, DB migration, formula change, lead sourcing, Tier A auto-send. Represented, never callable.",
    source: "action-readiness · tier forbidden_autonomous",
    detailHref: "#action-readiness",
    metrics: arCounts ? [{ label: "count", value: String(arCounts.forbidden_autonomous) }] : undefined,
  });

  // ---- Crew Simulation Layer (v1 integration) ------------------------------
  // Reflects the read-only crew-simulation scenarios as visual flows. Every
  // scenario + step is executable:false; nothing here can run.
  const sims = crewSimulations ?? [];
  const simById = new Map(sims.map((s) => [s.scenario.id, s]));
  nodes.push({
    id: "crew-simulation",
    label: "Crew Simulation",
    type: "crew",
    status: sims.length > 0 ? "healthy" : "no_data",
    mode: "read_only",
    risk: "none",
    group: GROUP.simulation,
    summary: sims.length > 0
      ? `${sims.length} read-only crew flows simulated — what each crew WOULD do, with its gates and blocked actions. Nothing is executable.`
      : "Read-only simulation of crew flows. Nothing is executable.",
    source: "src/lib/agentic/crew-simulation",
    detailHref: "#crew-simulation",
    metrics: [{ label: "scenarios", value: String(sims.length) }, { label: "executable", value: "0" }],
  });

  // One node per scenario flow.
  const FLOW_NODES: { nodeId: string; scenarioId: string; label: string }[] = [
    { nodeId: "reporting-crew-flow", scenarioId: "reporting_crew_briefing", label: "Reporting Crew Flow" },
    { nodeId: "outreach-draft-flow", scenarioId: "outreach_draft_flow", label: "Outreach Draft Flow" },
    { nodeId: "product-review-flow", scenarioId: "product_review_flow", label: "Product Review Flow" },
    { nodeId: "risk-explanation-flow", scenarioId: "risk_explanation_flow", label: "Risk Explanation Flow" },
    { nodeId: "vault-readiness-flow", scenarioId: "vault_readiness_flow", label: "Vault Readiness Flow" },
    { nodeId: "memory-distill-flow", scenarioId: "memory_distill_flow", label: "Memory Distill Flow" },
  ];
  for (const f of FLOW_NODES) {
    const sim = simById.get(f.scenarioId);
    const scenario = sim?.scenario;
    const mode =
      scenario?.mode === "draft_only"
        ? ("draft" as const)
        : scenario?.mode === "confirmed_write_blocked"
          ? ("confirmed_write" as const)
          : scenario?.mode === "forbidden"
            ? ("forbidden" as const)
            : ("read_only" as const);
    nodes.push({
      id: f.nodeId,
      label: f.label,
      type: "crew",
      status: scenario ? "healthy" : "no_data",
      mode,
      risk: scenario ? asRisk(scenario.risk) : "none",
      group: GROUP.simulation,
      summary: scenario
        ? `${scenario.trigger} — ${scenario.steps.length} steps, ${sim!.requiredGates.length} gate(s), ${sim!.blockedActions.length} blocked action(s). executable: false.`
        : "Simulated crew flow (executable: false).",
      source: `crew-simulation · ${f.scenarioId}`,
      detailHref: "#crew-simulation",
      metrics: scenario
        ? [
            { label: "steps", value: String(scenario.steps.length) },
            { label: "gates", value: String(sim!.requiredGates.length) },
            { label: "executable", value: "false" },
          ]
        : undefined,
    });
  }

  // ---- Edges (how the system is wired) -------------------------------------
  const edge = (
    from: string,
    to: string,
    label: string,
    kind: AgenticSystemEdge["kind"],
  ): AgenticSystemEdge => ({ id: `${from}->${to}:${kind}`, from, to, label, kind });

  edges.push(
    // Router routes to the crews/agents/surfaces.
    edge("router", "reporting-crew", "routes", "routes"),
    edge("router", "outreach-logic", "routes", "routes"),
    edge("router", "product-review", "routes", "routes"),
    edge("router", "risk-explanation", "routes", "routes"),
    edge("router", "product-workspace", "routes", "routes"),
    edge("router", "vault-readiness", "routes", "routes"),
    // Guard guards the router + the explanation surfaces.
    edge("guard", "router", "guards", "guards"),
    edge("guard", "risk-explanation", "guards", "guards"),
    edge("guard", "product-review", "guards", "guards"),
    // Observability observes the router; quality review reads observability.
    edge("router-observability", "router", "observes", "observes"),
    edge("sql-aggregates", "router-observability", "aggregates", "reads"),
    edge("quality-review", "router-observability", "interprets", "reads"),
    edge("trends", "router-observability", "buckets", "reads"),
    edge("retention", "router-observability", "governs traces", "guards"),
    // Reporting crew reads the observability + quality + tool boundary.
    edge("reporting-crew", "router-observability", "reads", "reads"),
    edge("reporting-crew", "quality-review", "reads", "reads"),
    edge("reporting-crew", "tool-boundary", "reads", "reads"),
    // Tool boundary gates the draft + confirmed-write tools; forbids the rest.
    edge("tool-boundary", "read-tools", "classifies", "reads"),
    edge("tool-boundary", "draft-tools", "gates", "gates"),
    edge("tool-boundary", "confirmed-write-tools", "gates", "gates"),
    edge("tool-boundary", "forbidden-autonomous", "forbids", "forbids"),
    // HITL gates the writes.
    edge("hitl-gates", "draft-tools", "confirms", "gates"),
    edge("hitl-gates", "confirmed-write-tools", "confirms", "gates"),
    // Outreach logic uses read + draft + confirmed-write tools.
    edge("outreach-logic", "read-tools", "reads", "reads"),
    edge("outreach-logic", "draft-tools", "drafts", "gates"),
    edge("outreach-logic", "confirmed-write-tools", "send run", "gates"),
    // Tool boundary feeds the action-readiness classification.
    edge("tool-boundary", "action-readiness", "classifies", "reads"),
    // Action readiness fans out to the action tiers.
    edge("action-readiness", "read-only-actions", "read-only", "reads"),
    edge("action-readiness", "draft-actions", "draft", "gates"),
    edge("action-readiness", "confirmed-write-actions", "confirmed-write", "gates"),
    edge("action-readiness", "forbidden-actions", "forbidden", "forbids"),
    // HITL gates the draft + confirmed-write actions; guard forbids the rest.
    edge("hitl-gates", "draft-actions", "confirms", "gates"),
    edge("hitl-gates", "confirmed-write-actions", "confirms", "gates"),
    edge("guard", "forbidden-actions", "forbids", "forbids"),
    // Crew simulation fans out to the six flows.
    edge("crew-simulation", "reporting-crew-flow", "simulates", "composes"),
    edge("crew-simulation", "outreach-draft-flow", "simulates", "composes"),
    edge("crew-simulation", "product-review-flow", "simulates", "composes"),
    edge("crew-simulation", "risk-explanation-flow", "simulates", "composes"),
    edge("crew-simulation", "vault-readiness-flow", "simulates", "composes"),
    edge("crew-simulation", "memory-distill-flow", "simulates", "composes"),
    // Flow wiring — what each simulated flow reads / gates / is blocked by.
    edge("reporting-crew-flow", "router-observability", "reads", "reads"),
    edge("reporting-crew-flow", "quality-review", "reads", "reads"),
    edge("reporting-crew-flow", "tool-boundary", "reads", "reads"),
    edge("outreach-draft-flow", "draft-actions", "drafts", "gates"),
    edge("outreach-draft-flow", "hitl-gates", "awaits gate", "gates"),
    edge("risk-explanation-flow", "guard", "guarded by", "guards"),
    edge("vault-readiness-flow", "forbidden-actions", "mark-live blocked", "forbids"),
    edge("memory-distill-flow", "read-only-actions", "read-derived", "reads"),
    edge("product-review-flow", "read-only-actions", "review read-only", "reads"),
  );

  const map: AgenticSystemMap = {
    generatedAt: GENERATED_AT,
    groups: GROUPS,
    nodes,
    edges,
    selectedDefaultNodeId: "router",
    safetyNotes: SAFETY_NOTES,
  };

  return map;
}
