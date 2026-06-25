// Agentic Control Tower — headline summary (pure, read-only).
//
// Composes the existing read-only summaries into the small set of numbers + the
// overall health an admin needs to understand the agentic platform in 10 seconds:
// what's autonomous, what's gated, what's forbidden, and whether anything needs
// attention. Pure: no I/O, no tool execution, no Date.now.

import type { AgenticControlCenterData } from "@/lib/agentic/control-center/types";
import type { RouterObservabilitySummary } from "@/lib/agentic/observability/types";
import type { ActionReadinessMatrix } from "@/lib/agentic/action-readiness/types";
import type { CrewSimulationResult } from "@/lib/agentic/crew-simulation/types";

/** Overall console health, worst-first. */
export type TowerHealth = "healthy" | "watch" | "alert" | "no_data";

/** One headline metric for the command summary. */
export interface TowerMetric {
  id: string;
  /** Big number / short value. */
  value: string;
  /** Short product label. */
  label: string;
  /** One-line plain-language meaning. */
  hint: string;
  tone: "accent" | "success" | "warning" | "danger" | "neutral";
}

/** The headline tower summary. */
export interface TowerSummary {
  health: TowerHealth;
  /** Plain-language one-liner for the hero. */
  headline: string;
  metrics: TowerMetric[];
  /** Active attention signals (watch/alert), already plain-language. */
  attention: string[];
}

interface TowerInputs {
  controlCenter: AgenticControlCenterData;
  observability: RouterObservabilitySummary | null;
  actionReadiness: ActionReadinessMatrix | null;
  crewSimulations: CrewSimulationResult[] | null;
}

/**
 * Build the headline tower summary. Pure + deterministic. Inputs may be null
 * (best-effort) — the summary degrades gracefully and never throws.
 */
export function buildTowerSummary(inputs: TowerInputs): TowerSummary {
  const { controlCenter, observability, actionReadiness, crewSimulations } = inputs;
  const ar = actionReadiness;
  const review = observability?.qualityReview;

  const attention: string[] = [];

  // --- attention signals (plain language) ---------------------------------
  const autonomousGates = controlCenter.gates.filter((g) => g.autonomousAllowed).length;
  if (autonomousGates > 0) {
    attention.push(
      `${autonomousGates} critical action(s) marked autonomous — review immediately.`,
    );
  }
  const failingSafety = controlCenter.safetySummary.filter((s) => !s.holds);
  for (const s of failingSafety) {
    attention.push(`Safety claim does not hold: ${s.claim}.`);
  }
  const unknownTools = controlCenter.toolBoundaryV1?.counts.unknown ?? 0;
  if (unknownTools > 0) {
    attention.push(`${unknownTools} tool(s) are unclassified — treated as forbidden until reviewed.`);
  }
  const criticalToolIssues =
    controlCenter.toolBoundaryV1?.consistencyIssues.filter((i) => i.severity === "critical").length ?? 0;
  if (criticalToolIssues > 0) {
    attention.push(`${criticalToolIssues} tool-boundary safety violation(s).`);
  }
  if (review?.watchlist.some((w) => w.active && w.severity === "alert")) {
    attention.push("Router quality alert active — check the dangerous-refusal trend.");
  }
  if (
    observability &&
    (observability.storage === "redis_fallback" ||
      observability.storage === "memory_fallback" ||
      observability.aggregationMode === "fallback")
  ) {
    attention.push("Observability is on a fallback source — numbers may be partial.");
  }
  const routerActive =
    controlCenter.router.status === "active" && controlCenter.router.mode === "non-shadow";
  if (!routerActive) {
    attention.push("Router is not active / non-shadow.");
  }

  // --- overall health ------------------------------------------------------
  let health: TowerHealth;
  const hasAlert =
    autonomousGates > 0 ||
    failingSafety.length > 0 ||
    unknownTools > 0 ||
    criticalToolIssues > 0 ||
    Boolean(review?.watchlist.some((w) => w.active && w.severity === "alert")) ||
    !routerActive;
  const hasWatch =
    Boolean(
      observability &&
        (observability.storage !== "durable" || observability.aggregationMode === "fallback"),
    ) || Boolean(review?.watchlist.some((w) => w.active && w.severity === "watch"));
  const hasData = observability != null && observability.state !== "unavailable";

  if (hasAlert) health = "alert";
  else if (hasWatch) health = "watch";
  else if (!hasData) health = "no_data";
  else health = "healthy";

  // --- headline ------------------------------------------------------------
  const headline =
    health === "alert"
      ? `${attention.length} item(s) need attention. Nothing executes from this console.`
      : health === "watch"
        ? "Operating normally with a few items to watch. Nothing executes from this console."
        : health === "no_data"
          ? "Configured safely; not enough recent activity to assess live health. Nothing executes from this console."
          : "The agentic platform is operating safely. Nothing executes from this console.";

  // --- headline metrics ----------------------------------------------------
  const readOnly = ar?.counts.read_only ?? 0;
  const gated = ar ? ar.counts.draft_or_proposal + ar.counts.confirmed_write : 0;
  const forbidden = ar?.counts.forbidden_autonomous ?? 0;
  const crews = crewSimulations?.length ?? 0;
  const agents = controlCenter.inventory.length;

  const metrics: TowerMetric[] = [
    {
      id: "autonomous",
      value: String(readOnly),
      label: "Autonomous, read-only",
      hint: "Actions an agent may take without a human — all read-only, no writes.",
      tone: "success",
    },
    {
      id: "gated",
      value: String(gated),
      label: "Gated writes",
      hint: "Drafts + the one confirmed-write — each needs explicit human confirmation.",
      tone: "warning",
    },
    {
      id: "forbidden",
      value: String(forbidden),
      label: "Never autonomous",
      hint: "Action types that can never run from an agent (deploy, mark-live, …).",
      tone: "danger",
    },
    {
      id: "agents",
      value: String(agents),
      label: "Agents & surfaces",
      hint: "Logic units in the agentic chain, grouped by domain below.",
      tone: "neutral",
    },
    {
      id: "crews",
      value: String(crews),
      label: "Simulated crews",
      hint: "Read-only flow simulations — none is executable.",
      tone: "accent",
    },
  ];

  return { health, headline, metrics, attention };
}
