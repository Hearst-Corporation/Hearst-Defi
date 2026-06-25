// Admin · Agentic Control Tower — Crew Simulation (presentational).
//
// READ-ONLY. 6 crew scenarios rendered as compact flow cards. Each card shows
// risk/mode/gates summary then a tight step rail (name + mode only, no long
// descriptions). `executable: false` is stated once per card, not per step.
// No run / execute / launch / send / deploy anywhere. Pure component.

import { Badge } from "@/components/ui/badge";
import type {
  CrewSimulationMode,
  CrewSimulationResult,
  CrewSimulationRisk,
  CrewSimulationStep,
} from "@/lib/agentic/crew-simulation/types";

type Tone = "success" | "warning" | "danger" | "default";

const MODE_LABEL: Record<CrewSimulationMode, string> = {
  read_only: "read-only",
  draft_only: "draft-only",
  confirmed_write_blocked: "write blocked",
  forbidden: "forbidden",
};

function modeTone(mode: CrewSimulationMode): Tone {
  switch (mode) {
    case "read_only": return "success";
    case "draft_only":
    case "confirmed_write_blocked": return "warning";
    case "forbidden": return "danger";
  }
}

function riskTone(risk: CrewSimulationRisk): Tone {
  switch (risk) {
    case "critical":
    case "high": return "danger";
    case "medium": return "warning";
    default: return "default";
  }
}

function StepRow({ step, index }: { step: CrewSimulationStep; index: number }) {
  return (
    <li className="agentic-sim-step" data-mode={step.mode}>
      <span className="agentic-sim-step-index tabular-nums" aria-hidden>{index + 1}</span>
      <span className="body-xs ct-text-body flex-1 min-w-0">{step.label}</span>
      <Badge variant={modeTone(step.mode)}>{MODE_LABEL[step.mode]}</Badge>
      {step.gateRequired && <span className="agentic-sim-gate-dot" aria-label="gate required" />}
    </li>
  );
}

function CrewCard({ result }: { result: CrewSimulationResult }) {
  const { scenario, summary, blockedActions, requiredGates } = result;
  return (
    <div className="agentic-sim-card">
      <div className="agentic-sim-card-head">
        <span className="body-sm ct-text-strong">{scenario.label}</span>
        <div className="agentic-sim-card-badges">
          <Badge variant={modeTone(scenario.mode)}>{MODE_LABEL[scenario.mode]}</Badge>
          {scenario.risk !== "low" && (
            <Badge variant={riskTone(scenario.risk)}>risk: {scenario.risk}</Badge>
          )}
          {requiredGates.length > 0 && (
            <Badge variant="warning">{requiredGates.length} gate{requiredGates.length > 1 ? "s" : ""}</Badge>
          )}
        </div>
      </div>
      <p className="body-xs ct-text-muted">{summary}</p>
      <ol className="agentic-sim-rail">
        {scenario.steps.map((step, i) => (
          <StepRow key={step.id} step={step} index={i} />
        ))}
      </ol>
      {blockedActions.length > 0 && (
        <div className="agentic-sim-blocked">
          {blockedActions.map((a) => (
            <span key={a} className="agentic-flow-blocked">{a}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export function CrewSimulationSection({
  simulations,
}: {
  simulations: CrewSimulationResult[] | null | undefined;
}) {
  if (!simulations || simulations.length === 0) return null;

  return (
    <section
      id="crew-simulation"
      className="agentic-stack"
      aria-label="Crew Simulation"
    >
      <div className="agentic-section-head">
        <div className="agentic-sim-head-row">
          <h2 className="agentic-section-title m-0">Crew Simulation</h2>
          <Badge variant="danger">executable: false</Badge>
        </div>
        <p className="body-sm ct-text-muted m-0">
          What each crew <em>would</em> do — read-only simulation. No step executes; no tool is called.
        </p>
      </div>

      <div className="agentic-sim-grid">
        {simulations.map((result) => (
          <CrewCard key={result.scenario.id} result={result} />
        ))}
      </div>
    </section>
  );
}
