export type CrewSimulationMode =
  | "read_only"
  | "draft_only"
  | "confirmed_write_blocked"
  | "forbidden";

export type CrewSimulationRisk =
  | "none"
  | "low"
  | "medium"
  | "high"
  | "critical";

export type CrewSimulationStep = {
  id: string;
  label: string;
  description: string;
  mode: CrewSimulationMode;
  executable: false;
  usesToolIds: string[];
  produces: string[];
  gateRequired: boolean;
};

export type CrewSimulationScenario = {
  id: string;
  label: string;
  trigger: string;
  mode: CrewSimulationMode;
  risk: CrewSimulationRisk;
  executable: false;
  steps: CrewSimulationStep[];
  forbiddenActions: string[];
  safetyNotes: string[];
};

export type CrewSimulationResult = {
  generatedAt: string;
  scenario: CrewSimulationScenario;
  summary: string;
  blockedActions: string[];
  requiredGates: string[];
};

export type CrewSimulationError = {
  kind: "unknown_scenario" | "forbidden";
  scenarioId: string;
  message: string;
};
