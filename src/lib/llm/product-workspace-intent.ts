export const PRODUCT_WORKSPACE_DESTINATION_KEY = "admin-product-workspace";
export const SCENARIO_LAB_DESTINATION_KEY = "admin-scenario-lab";

const MAX_OBJECTIVE_LEN = 220;

const PRODUCT_CREATION_INTENT_RE =
  /\b(créer|cree|create|creation|création|nouveau produit|nouveau vault|nouvelle offre|new product|new vault|product creation|lancer un produit|lancement produit|go to market|go-to-market)\b/i;

const PRODUCT_FRAMING_INTENT_RE =
  /\b(cadrer|cadrage|frame|framing|thesis|thèse|strategie|stratégie|strategy|modeling|modelling|modélisation|modeliser|modéliser)\b/i;

const PRODUCT_CONTEXT_RE =
  /\b(produit|product|vault|offre|offer|strategy|strategie|stratégie)\b/i;

export const EXPLICIT_SIMULATION_INTENT_RE =
  /\b(simuler|simulation|scenario|scénario|stress test|stress-test|monte carlo|backtest|run scenario)\b/i;

export type ProductWorkspaceIntentKind =
  | "none"
  | "product_creation"
  | "product_framing"
  | "explicit_simulation"
  | "mixed_product_creation_simulation"
  | "mixed_product_framing_simulation";

export interface ProductWorkspaceIntentClassification {
  kind: ProductWorkspaceIntentKind;
  objective?: string;
  primaryDestinationKey?: string;
  secondaryDestinationKey?: string;
  secondaryHint?: string;
  autostart?: boolean;
  shouldOpenProductWorkspace: boolean;
  shouldOpenScenarioLab: boolean;
}

export function isExplicitSimulationIntent(message: string): boolean {
  return EXPLICIT_SIMULATION_INTENT_RE.test(message);
}

export function deriveProductWorkspaceObjective(message: string): string | undefined {
  const compact = message.replace(/\s+/g, " ").trim();
  if (!compact) return undefined;
  return compact.slice(0, MAX_OBJECTIVE_LEN);
}

export function classifyProductWorkspaceIntent(
  message: string,
): ProductWorkspaceIntentClassification {
  const objective = deriveProductWorkspaceObjective(message);
  if (!objective) {
    return {
      kind: "none",
      shouldOpenProductWorkspace: false,
      shouldOpenScenarioLab: false,
    };
  }

  const hasCreation = PRODUCT_CREATION_INTENT_RE.test(message);
  const hasFraming =
    PRODUCT_FRAMING_INTENT_RE.test(message) && PRODUCT_CONTEXT_RE.test(message);
  const hasSimulation = isExplicitSimulationIntent(message);

  if ((hasCreation || hasFraming) && hasSimulation) {
    return {
      kind: hasCreation
        ? "mixed_product_creation_simulation"
        : "mixed_product_framing_simulation",
      objective,
      primaryDestinationKey: PRODUCT_WORKSPACE_DESTINATION_KEY,
      secondaryDestinationKey: SCENARIO_LAB_DESTINATION_KEY,
      secondaryHint: "Scenario Lab validation requested",
      autostart: true,
      shouldOpenProductWorkspace: true,
      shouldOpenScenarioLab: true,
    };
  }

  if (hasCreation) {
    return {
      kind: "product_creation",
      objective,
      primaryDestinationKey: PRODUCT_WORKSPACE_DESTINATION_KEY,
      autostart: true,
      shouldOpenProductWorkspace: true,
      shouldOpenScenarioLab: false,
    };
  }

  if (hasFraming) {
    return {
      kind: "product_framing",
      objective,
      primaryDestinationKey: PRODUCT_WORKSPACE_DESTINATION_KEY,
      autostart: true,
      shouldOpenProductWorkspace: true,
      shouldOpenScenarioLab: false,
    };
  }

  if (hasSimulation) {
    return {
      kind: "explicit_simulation",
      objective,
      primaryDestinationKey: SCENARIO_LAB_DESTINATION_KEY,
      shouldOpenProductWorkspace: false,
      shouldOpenScenarioLab: true,
    };
  }

  return {
    kind: "none",
    objective,
    shouldOpenProductWorkspace: false,
    shouldOpenScenarioLab: false,
  };
}

export function isProductWorkspaceIntent(message: string): boolean {
  return classifyProductWorkspaceIntent(message).shouldOpenProductWorkspace;
}

