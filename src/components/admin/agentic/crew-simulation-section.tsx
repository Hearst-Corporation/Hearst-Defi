// Admin · Agentic Control Center — Crew Simulation (presentational).
//
// READ-ONLY. Renders the 6 crew-simulation scenarios as visual FLOW RAILS: each
// scenario is a sequence of steps (with mode + gate), its blocked actions, and a
// prominent `executable: false` marker. It is a SIMULATION, never a runnable
// crew — there is NO Run / Execute / Launch / Send / Deploy control anywhere.
// Pure component; all data passed in, unit-testable via SSR.

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type {
  CrewSimulationMode,
  CrewSimulationResult,
  CrewSimulationRisk,
  CrewSimulationStep,
} from "@/lib/agentic/crew-simulation/types";

type Tone = "success" | "warning" | "danger" | "default" | "accent";

const MODE_LABEL: Record<CrewSimulationMode, string> = {
  read_only: "read-only",
  draft_only: "draft-only",
  confirmed_write_blocked: "confirmed-write (blocked)",
  forbidden: "forbidden",
};

function modeTone(mode: CrewSimulationMode): Tone {
  switch (mode) {
    case "read_only":
      return "success";
    case "draft_only":
    case "confirmed_write_blocked":
      return "warning";
    case "forbidden":
      return "danger";
  }
}

function riskTone(risk: CrewSimulationRisk): Tone {
  switch (risk) {
    case "critical":
    case "high":
      return "danger";
    case "medium":
      return "warning";
    default:
      return "default";
  }
}

function StepRail({ step, index }: { step: CrewSimulationStep; index: number }) {
  return (
    <li className="agentic-flow-step" data-mode={step.mode}>
      <span className="agentic-flow-step-index tabular-nums" aria-hidden>
        {index + 1}
      </span>
      <div className="flex flex-col gap-[var(--ct-space-1)] min-w-0 flex-1">
        <div className="admin-doc-inline-row admin-doc-inline-row--start admin-doc-inline-row--tight flex-wrap">
          <span className="body-xs ct-text-strong break-words">{step.label}</span>
          <Badge variant={modeTone(step.mode)}>{MODE_LABEL[step.mode]}</Badge>
          {step.gateRequired && <Badge variant="warning">gate</Badge>}
        </div>
        <p className="body-xs ct-text-faint break-words">{step.description}</p>
      </div>
    </li>
  );
}

function ScenarioCard({ result }: { result: CrewSimulationResult }) {
  const { scenario, summary, blockedActions, requiredGates } = result;
  return (
    <Card
      hoverOverlay={false}
      contentClassName="flex h-full flex-col gap-[var(--ct-space-3)]"
    >
      <div className="admin-doc-inline-row admin-doc-inline-row--start flex-wrap">
        <h4 className="h4 m-0 flex-1 break-words">{scenario.label}</h4>
        <Badge variant={modeTone(scenario.mode)}>{MODE_LABEL[scenario.mode]}</Badge>
        <Badge variant={riskTone(scenario.risk)}>risk: {scenario.risk}</Badge>
      </div>
      <p className="body-xs ct-text-muted break-words">{summary}</p>
      <div className="admin-doc-inline-row admin-doc-inline-row--start admin-doc-inline-row--tight flex-wrap">
        <Badge variant="default">{scenario.steps.length} steps</Badge>
        <Badge variant={requiredGates.length > 0 ? "warning" : "default"}>
          {requiredGates.length} gate{requiredGates.length === 1 ? "" : "s"}
        </Badge>
        <Badge variant="danger">executable: false</Badge>
      </div>

      {/* Step rail */}
      <ol className="agentic-flow-rail">
        {scenario.steps.map((step, i) => (
          <StepRail key={step.id} step={step} index={i} />
        ))}
      </ol>

      {/* Blocked actions */}
      {blockedActions.length > 0 && (
        <div className="flex flex-col gap-[var(--ct-space-1)]">
          <span className="stat-label ct-text-muted">Blocked actions</span>
          <div className="admin-doc-inline-row admin-doc-inline-row--start admin-doc-inline-row--tight flex-wrap">
            {blockedActions.map((a) => (
              <span key={a} className="agentic-flow-blocked" data-kind="blocked">
                {a}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
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
      className="admin-doc-stack"
      aria-label="Crew Simulation"
    >
      <div className="admin-doc-inline-row admin-doc-inline-row--start flex-wrap">
        <h2 className="h2 m-0">Crew Simulation</h2>
        <span className="flex-1" />
        <Badge variant="accent">read-only</Badge>
        <Badge variant="danger">executable: false</Badge>
      </div>
      <p className="body-xs ct-text-muted">
        What each crew <em>would</em> do, step by step — a read-only simulation of
        the flows, with their gates and blocked actions. This is not a runnable
        crew: every scenario and step is <span className="ct-text-strong">executable: false</span>,
        no tool is executed, and there is no run / launch / send control.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--ct-space-4)]">
        {simulations.map((result) => (
          <ScenarioCard key={result.scenario.id} result={result} />
        ))}
      </div>
    </section>
  );
}
