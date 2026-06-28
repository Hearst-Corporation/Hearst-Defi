export const PRODUCT_WORKSPACE_DESTINATION_KEY = "admin-product-workspace";
export const SCENARIO_LAB_DESTINATION_KEY = "admin-scenario-lab";

const MAX_OBJECTIVE_LEN = 220;

// Self-contained product-creation phrases — they already carry the product noun
// ("nouveau produit", "new vault"), so they classify as product creation on
// their own.
const PRODUCT_CREATION_PHRASE_RE =
  /\b(nouveau produit|nouveau vault|nouvelle offre|new product|new vault|product creation|lancer un produit|lancement produit|go to market|go-to-market)\b/i;

// Bare creation verbs ("créer", "crée", "create", "monter"…). These are
// AMBIGUOUS alone ("create projection", "create a scenario") so they only signal
// a PRODUCT creation when paired with product context (PRODUCT_CONTEXT_RE) — see
// `hasCreation` below.
// NOTE on accents: the matcher is not accent-folded, so each inflection is listed
// explicitly. "crée" (accented 3rd-person/imperative, no trailing -r) was missing
// — "créer"/"création" were present but a bare "crée un produit" fell through.
const PRODUCT_CREATION_VERB_RE =
  /\b(créer|crée|cree|creer|create|creation|création|construire|monter|structurer)\b/i;

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

  const hasProductContext = PRODUCT_CONTEXT_RE.test(message);
  // P0: a bare creation verb only counts as PRODUCT creation when paired with a
  // product/vault noun. A self-contained phrase ("nouveau produit") always counts.
  // "create projection" / "create a scenario" have a creation verb but NO product
  // context → not a product intent.
  const hasCreation =
    PRODUCT_CREATION_PHRASE_RE.test(message) ||
    (PRODUCT_CREATION_VERB_RE.test(message) && hasProductContext);
  const hasFraming =
    PRODUCT_FRAMING_INTENT_RE.test(message) && hasProductContext;
  const hasSimulation = isExplicitSimulationIntent(message);

  // P0 NOTE — projection/product confusion is closed by `hasCreation` above: a
  // bare creation verb ("create", "monter") only signals PRODUCT creation when a
  // product/vault noun is present. So "create projection" / "make a forecast"
  // (no product noun) → hasCreation=false. They then fall through to either the
  // explicit_simulation branch (if a simulation verb is present, → Scenario Lab,
  // NEVER the Product Workspace) or the final `none`. We deliberately do NOT add a
  // hard short-circuit here: a genuine simulation must keep its
  // `shouldOpenScenarioLab` routing (the demo-plan builder depends on it).

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

