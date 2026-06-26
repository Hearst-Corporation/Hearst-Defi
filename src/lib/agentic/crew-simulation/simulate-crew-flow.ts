import { CREW_SIMULATION_SCENARIOS } from "./scenarios";
import type {
  CrewSimulationError,
  CrewSimulationResult,
} from "./types";

function buildSummary(scenarioId: string): string {
  const summaries: Record<string, string> = {
    reporting_crew_briefing:
      "Reporting Crew collects read-only observability, quality review, tool boundary, and control center data, then composes a deterministic executive briefing. No tool is executed. No data is modified.",
    outreach_draft_flow:
      "Outreach Draft Flow reads prospect data and templates, generates a compliance-checked draft email, and halts at a human approval gate. Sending is blocked until explicit HITL confirmation.",
    product_review_flow:
      "Product Review Flow reads vault state and scenario results, then composes structured review notes. All outputs are advisory drafts. No vault state is modified.",
    risk_explanation_flow:
      "Risk Explanation Flow reads risk parameters and composes a human-readable explanation. Output guard always runs. No financial advice is given. No write action is reachable.",
    vault_readiness_flow:
      "Vault Readiness Flow reads smart contract state and ADR gate status, then produces an advisory readiness assessment. Mainnet deploy remains hard-blocked (ADR-006 audit gate).",
    memory_distill_flow:
      "Memory Distill Flow reads session context metadata (no user text) and produces a concise internal summary. No external transmission. No tool is executed.",
    projection_flow:
      "Projection Flow validates allowlisted input, deterministically builds a read-only projection artifact (metrics, scenarios, charts, assumptions, provenance), and runs output guards. APY is only a range; no number is invented; no return is promised; no write is performed.",
  };
  return (
    summaries[scenarioId] ??
    `Simulation of scenario "${scenarioId}" completed. No tool executed. No write performed.`
  );
}

export function simulateCrewFlow(
  id: string,
): CrewSimulationResult | CrewSimulationError {
  const scenario = CREW_SIMULATION_SCENARIOS.find((s) => s.id === id);

  if (!scenario) {
    return {
      kind: "unknown_scenario",
      scenarioId: id,
      message: `No simulation scenario registered for id "${id}". No fallback execution will occur.`,
    } satisfies CrewSimulationError;
  }

  const requiredGates = scenario.steps
    .filter((s) => s.gateRequired)
    .map((s) => s.id);

  const blockedActions = [
    ...scenario.forbiddenActions,
    ...scenario.steps
      .filter((s) => s.mode === "confirmed_write_blocked")
      .map((s) => `confirmed_write:${s.id}`),
  ];

  return {
    generatedAt: new Date().toISOString(),
    scenario,
    summary: buildSummary(id),
    blockedActions,
    requiredGates,
  } satisfies CrewSimulationResult;
}

export function listSimulationScenarioIds(): string[] {
  return CREW_SIMULATION_SCENARIOS.map((s) => s.id);
}

export function isCrewSimulationError(
  result: CrewSimulationResult | CrewSimulationError,
): result is CrewSimulationError {
  return "kind" in result && "scenarioId" in result && "message" in result;
}
