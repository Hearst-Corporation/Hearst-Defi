export const PRODUCT_WORKSPACE_DESTINATION_KEY = "admin-product-workspace";

const MAX_OBJECTIVE_LEN = 220;

const PRODUCT_CREATION_INTENT_RE =
  /\b(créer|cree|create|creation|création|nouveau produit|nouveau vault|nouvelle offre|new product|new vault|product creation|lancer un produit|lancement produit|go to market|go-to-market)\b/i;

const PRODUCT_FRAMING_INTENT_RE =
  /\b(cadrer|cadrage|frame|framing|thesis|thèse|strategie|stratégie|strategy|modeling|modelling|modélisation|modeliser|modéliser)\b/i;

const PRODUCT_CONTEXT_RE =
  /\b(produit|product|vault|offre|offer|strategy|strategie|stratégie)\b/i;

export const EXPLICIT_SIMULATION_INTENT_RE =
  /\b(simuler|simulation|scenario|scénario|stress test|stress-test|monte carlo|backtest|run scenario)\b/i;

export function isExplicitSimulationIntent(message: string): boolean {
  return EXPLICIT_SIMULATION_INTENT_RE.test(message);
}

export function isProductWorkspaceIntent(message: string): boolean {
  if (PRODUCT_CREATION_INTENT_RE.test(message)) return true;
  if (isExplicitSimulationIntent(message)) return false;
  return PRODUCT_FRAMING_INTENT_RE.test(message) && PRODUCT_CONTEXT_RE.test(message);
}

export function deriveProductWorkspaceObjective(message: string): string | undefined {
  const compact = message.replace(/\s+/g, " ").trim();
  if (!compact) return undefined;
  return compact.slice(0, MAX_OBJECTIVE_LEN);
}

export interface MasterAgentNavPublishDirective {
  destinationKey: string;
  objective?: string;
  autostart?: boolean;
}

/**
 * Resolves the nav directive published after a Master Agent turn.
 * Admin product-creation intents override the model's chosen destination.
 */
export function resolveMasterAgentNavPublish(args: {
  navProfile: "lp" | "admin";
  message: string;
  modelDestinationKey: string;
  productWorkspaceNavEnabled: boolean;
}): MasterAgentNavPublishDirective {
  const { navProfile, message, modelDestinationKey, productWorkspaceNavEnabled } = args;

  if (
    navProfile === "admin" &&
    isProductWorkspaceIntent(message) &&
    productWorkspaceNavEnabled
  ) {
    return {
      destinationKey: PRODUCT_WORKSPACE_DESTINATION_KEY,
      objective: deriveProductWorkspaceObjective(message),
      autostart: true,
    };
  }

  return { destinationKey: modelDestinationKey };
}
