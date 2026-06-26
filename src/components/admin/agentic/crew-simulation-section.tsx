// Admin · Agentic Control Tower — Crew Simulation (presentational).
//
// READ-ONLY. Rewritten 2026-06-26: 6 crew scenarios as ONE row each in a
// collapsible group (scenario · risk · mode · gates), with the step rail tucked
// into a nested <details> so the table stays scannable. `executable: false` is
// stated once at the group level. No run / send / deploy anywhere. No hardcoded
// values. Pure component.

import { AgenticGroup, AgenticTag, type AgenticTone } from "@/components/admin/agentic/agentic-group";
import type {
  CrewSimulationMode,
  CrewSimulationResult,
  CrewSimulationRisk,
} from "@/lib/agentic/crew-simulation/types";

const MODE_LABEL: Record<CrewSimulationMode, string> = {
  read_only: "read-only",
  draft_only: "draft-only",
  confirmed_write_blocked: "write blocked",
  forbidden: "forbidden",
};

function riskTone(risk: CrewSimulationRisk): AgenticTone {
  if (risk === "critical" || risk === "high") return "danger";
  if (risk === "medium") return "warning";
  return "neutral";
}

function modeTone(mode: CrewSimulationMode): AgenticTone {
  if (mode === "read_only") return "success";
  if (mode === "forbidden") return "danger";
  return "warning";
}

export function CrewSimulationSection({
  simulations,
}: {
  simulations: CrewSimulationResult[] | null | undefined;
}) {
  if (!simulations || simulations.length === 0) return null;

  return (
    <AgenticGroup
      id="crew-simulation"
      title="Crew Simulation"
      count={simulations.length}
      meta={<AgenticTag tone="danger">executable: false</AgenticTag>}
      note="What each crew would do — read-only simulation. No step executes; no tool is called."
    >
      <table className="agentic-table">
        <thead>
          <tr>
            <th>Scenario</th>
            <th>Risk</th>
            <th>Mode</th>
            <th className="agentic-cell-num">Gates</th>
          </tr>
        </thead>
        <tbody>
          {simulations.map(({ scenario, summary, requiredGates, blockedActions }) => (
            <tr key={scenario.id} data-tone={modeTone(scenario.mode)}>
              <td className="agentic-cell-strong">
                {scenario.label}
                <details className="agentic-rowdetail">
                  <summary className="agentic-rowdetail-summary">flow</summary>
                  <div className="agentic-rowdetail-body">
                    <span className="agentic-cell-muted">{summary}</span>
                    <ol className="agentic-steps">
                      {scenario.steps.map((step, i) => (
                        <li key={step.id} className="agentic-step">
                          <span className="agentic-step-index">{i + 1}</span>
                          <span>{step.label}</span>
                          <span className="agentic-step-mode">{MODE_LABEL[step.mode]}</span>
                        </li>
                      ))}
                    </ol>
                    {blockedActions.length > 0 && (
                      <span className="agentic-cell-faint">
                        blocked: {blockedActions.join(", ")}
                      </span>
                    )}
                  </div>
                </details>
              </td>
              <td>
                {scenario.risk !== "low" && scenario.risk !== "none" ? (
                  <AgenticTag tone={riskTone(scenario.risk)}>{scenario.risk}</AgenticTag>
                ) : (
                  <span className="agentic-cell-faint">—</span>
                )}
              </td>
              <td>
                <AgenticTag tone={modeTone(scenario.mode)}>{MODE_LABEL[scenario.mode]}</AgenticTag>
              </td>
              <td className="agentic-cell-num agentic-cell-muted">
                {requiredGates.length || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </AgenticGroup>
  );
}
