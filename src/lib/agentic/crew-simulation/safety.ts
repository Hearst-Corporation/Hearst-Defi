import type {
  CrewSimulationScenario,
  CrewSimulationStep,
} from "./types";

export type SafetyViolation = {
  kind:
    | "step_executable_true"
    | "confirmed_write_without_gate"
    | "forbidden_action_missing"
    | "executable_send_action"
    | "executable_deploy_action"
    | "executable_mark_live_action"
    | "executable_source_action"
    | "tool_execution_detected";
  scenarioId: string;
  stepId?: string;
  detail: string;
};

const WRITE_VERBS_THAT_MUST_BE_BLOCKED = [
  "send",
  "deploy",
  "mark_live",
  "source",
  "execute",
  "approve",
  "mutate",
  "write",
  "sign",
] as const;

export function assertStepSafe(
  scenarioId: string,
  step: CrewSimulationStep,
): SafetyViolation[] {
  const violations: SafetyViolation[] = [];

  if ((step.executable as unknown) !== false) {
    violations.push({
      kind: "step_executable_true",
      scenarioId,
      stepId: step.id,
      detail: `Step "${step.id}" has executable !== false`,
    });
  }

  if (
    step.mode === "confirmed_write_blocked" &&
    !step.gateRequired
  ) {
    violations.push({
      kind: "confirmed_write_without_gate",
      scenarioId,
      stepId: step.id,
      detail: `Step "${step.id}" is confirmed_write_blocked but gateRequired is false`,
    });
  }

  for (const toolId of step.usesToolIds) {
    const lower = toolId.toLowerCase();
    for (const verb of WRITE_VERBS_THAT_MUST_BE_BLOCKED) {
      if (lower.startsWith(verb) && lower !== "read_output_guard") {
        violations.push({
          kind: "tool_execution_detected",
          scenarioId,
          stepId: step.id,
          detail: `Step "${step.id}" uses toolId "${toolId}" which starts with write verb "${verb}" — must not be executable`,
        });
      }
    }
  }

  return violations;
}

export function assertScenarioSafe(
  scenario: CrewSimulationScenario,
): SafetyViolation[] {
  const violations: SafetyViolation[] = [];

  if ((scenario.executable as unknown) !== false) {
    violations.push({
      kind: "step_executable_true",
      scenarioId: scenario.id,
      detail: `Scenario "${scenario.id}" has executable !== false`,
    });
  }

  for (const step of scenario.steps) {
    violations.push(...assertStepSafe(scenario.id, step));
  }

  const hasSendForbidden = scenario.forbiddenActions.some((a) =>
    a.includes("send"),
  );
  const hasDeployForbidden = scenario.forbiddenActions.some((a) =>
    a.includes("deploy"),
  );
  const hasMarkLiveForbidden = scenario.forbiddenActions.some((a) =>
    a.includes("mark_live") || a.includes("mark-live"),
  );

  const isOutreachScenario = scenario.id.includes("outreach");
  const isVaultScenario =
    scenario.id.includes("vault") || scenario.id.includes("product");

  if (isOutreachScenario && !hasSendForbidden) {
    violations.push({
      kind: "executable_send_action",
      scenarioId: scenario.id,
      detail: `Outreach scenario "${scenario.id}" does not list a send-blocking forbidden action`,
    });
  }

  if (isVaultScenario && !hasDeployForbidden) {
    violations.push({
      kind: "executable_deploy_action",
      scenarioId: scenario.id,
      detail: `Vault/product scenario "${scenario.id}" does not list deploy as a forbidden action`,
    });
  }

  if (isVaultScenario && !hasMarkLiveForbidden) {
    violations.push({
      kind: "executable_mark_live_action",
      scenarioId: scenario.id,
      detail: `Vault/product scenario "${scenario.id}" does not list mark_live as a forbidden action`,
    });
  }

  return violations;
}

export function assertAllScenariosSafe(
  scenarios: CrewSimulationScenario[],
): SafetyViolation[] {
  return scenarios.flatMap((s) => assertScenarioSafe(s));
}
