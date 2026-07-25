export const PRODUCT_WORKSPACE_DESTINATION_KEY = "admin-vaults-new";

const MAX_OBJECTIVE_LEN = 220;

// Self-contained product-creation phrases — they already carry the product noun
// ("nouveau produit", "new vault"), so they classify as product creation on
// their own.
const PRODUCT_CREATION_PHRASE_RE =
  /\b(nouveau produit|nouveau vault|nouvelle offre|new product|new vault|product creation|vault creation|lancer un produit|lancement produit|go to market|go-to-market)\b/i;

// Bare creation verbs ("créer", "crée", "create", "monter", "faire"…). These are
// AMBIGUOUS alone ("create projection", "faire le point") so they only signal a
// PRODUCT creation when paired with product context (PRODUCT_CONTEXT_RE) — see
// `hasCreation` below.
// NOTE on accents: the matcher is not accent-folded, so each inflection is listed
// explicitly. "crée" (accented 3rd-person/imperative, no trailing -r) was missing
// — "créer"/"création" were present but a bare "crée un produit" fell through.
// "faire"/"fais"/"fait" + "lancer"/"lance"/"démarrer" added (P0): admins say
// "va faire un vault", "fais un produit", "lance un vault" — context-gated so
// "faire le point"/"lance la sim" never trigger.
// STRONG creation verbs — unambiguous "create" semantics. Paired with product
// context (PRODUCT_CONTEXT_RE) they signal a product creation. "Monte Carlo" is
// NOT here (bare "monte" would match it) — only the infinitive "construire" etc.
const PRODUCT_CREATION_VERB_RE =
  /\b(créer|crée|cree|creer|create|creating|creation|création|construire|construis|construit|structurer)\b/i;

// WEAK / ambiguous creation verbs ("faire", "lance", "monter", "new", "nouveau"…)
// — these only mean PRODUCT creation when a product noun follows DIRECTLY (≤2
// words). This keeps "faire un vault" (creation) apart from "fais une projection
// sur ce vault" (a simulation that merely mentions a vault later). The optional
// "va/vas/on va" lead covers "Va faire un volt", "On va faire un vault".
const WEAK_CREATION_OBJECT_RE =
  /\b(?:faire|fais|fait|faisons|lancer|lance|launch|launching|build|building|monter|démarrer|demarrer|démarre|demarre|new|nouveau|nouvelle|nouveaux)\b(?:\s+\w+){0,2}?\s+(?:produits?|products?|vaults?|volts?|vaul|veault|vaut|vautl|vaultt|offres?|offers?|workspace)\b/i;

const PRODUCT_FRAMING_INTENT_RE =
  /\b(cadrer|cadrage|frame|framing|thesis|thèse|strategie|stratégie|strategy|modeling|modelling|modélisation|modeliser|modéliser)\b/i;

// Product/vault context. Common misspellings of "vault" are included on purpose
// — admins type fast ("volt", "vaul", "veault", "vaut") and a creation intent
// must not be dropped to a generic LLM answer (the page never opened) over a
// typo. In the Hearst DeFi context "volt" is overwhelmingly a vault typo, not the
// electrical unit, so the false-positive risk is negligible vs the UX win.
const PRODUCT_CONTEXT_RE =
  /\b(produit|product|vault|vaults|volt|volts|vaul|veault|vaut|vaultt|vautl|workspace|offre|offer|strategy|strategie|stratégie)\b/i;

// Self-contained workspace/construction nouns — these name the destination
// directly, so they open the Product Workspace on their own (no verb needed):
// "product workspace", "construction produit", "workspace de création".
const WORKSPACE_PHRASE_RE =
  /\b(product workspace|workspace produit|espace produit|workspace de création|workspace de creation|construction produit|product construction|construction workspace)\b/i;

// Nav-INTO-workspace verbs: an open/go verb + the bare "workspace" noun opens the
// Product Workspace ("ouvrir le workspace", "aller dans le workspace", "va dans
// le workspace"). "ouvre/aller" are NOT product creation verbs, so they only
// route here when "workspace" is present.
const WORKSPACE_NAV_VERB_RE =
  /\b(ouvre|ouvrir|ouvre moi|aller|va|vas|accede|accède|accéder|rejoindre|open|go|go to|take me to|bring me to)\b/i;
const WORKSPACE_NOUN_RE = /\bworkspace\b/i;

// NON-PRODUCT guard (P0): kill clearly non-product matches even when a product
// token or creation verb is present. Protects "produit scalaire" (math),
// "tension en volts"/"voltage" (electrical unit), "workspace CSS bug" (frontend
// bug report). "volt(age)" the electrical unit only ever reads as a vault typo in
// a real product/nav context — never here.
const NON_PRODUCT_GUARD_RE =
  /\b(produit scalaire|produit vectoriel|produit cartésien|produit cartesien|dot product|scalar product|cross product|tension|voltage|ampérage|amperage|\d+\s*volts?|watt|watts|unité électrique|unite electrique|css|stylesheet|tailwind)\b/i;

// A simulation/projection mention. It NEVER opens the Product Workspace on its
// own (see `hasCreation` gating below): those words carry no product noun, so a
// bare "je veux faire une projection" is NOT a product-creation intent. The
// Scenario Lab route it used to open was RETIRED, so a standalone simulation ask
// now carries no deterministic destination and falls through to the LLM. This RE
// still classifies the MIXED case ("créer un produit puis simuler …"), where the
// product-creation half opens the Product Workspace and the simulation half is
// only recorded in the `kind`.
export const EXPLICIT_SIMULATION_INTENT_RE =
  /\b(simuler|simulation|scenario|scénario|stress test|stress-test|monte carlo|backtest|run scenario|projection|projections|projeter|prevision|prévision|forecast)\b/i;

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
  autostart?: boolean;
  shouldOpenProductWorkspace: boolean;
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
    };
  }

  // P0 guard: clearly non-product messages (math "produit scalaire", electrical
  // "tension en volts"/"voltage", frontend "workspace CSS bug") never navigate,
  // even though they share a token with the product grammar.
  if (NON_PRODUCT_GUARD_RE.test(message)) {
    return {
      kind: "none",
      objective,
      shouldOpenProductWorkspace: false,
    };
  }

  const hasProductContext = PRODUCT_CONTEXT_RE.test(message);
  // Opening the Product Workspace by name/destination: a self-contained workspace
  // phrase ("product workspace", "construction produit"), or an open/go/creation
  // verb paired with the bare "workspace" noun ("ouvrir le workspace", "va dans le
  // workspace", "créer dans le workspace").
  const hasWorkspaceOpen =
    WORKSPACE_PHRASE_RE.test(message) ||
    (WORKSPACE_NOUN_RE.test(message) &&
      (PRODUCT_CREATION_VERB_RE.test(message) ||
        WORKSPACE_NAV_VERB_RE.test(message)));
  // P0: a bare creation verb only counts as PRODUCT creation when paired with a
  // product/vault noun. A self-contained phrase ("nouveau produit") always counts.
  // "create projection" / "create a scenario" have a creation verb but NO product
  // context → not a product intent.
  const hasCreation =
    PRODUCT_CREATION_PHRASE_RE.test(message) ||
    hasWorkspaceOpen ||
    WEAK_CREATION_OBJECT_RE.test(message) ||
    (PRODUCT_CREATION_VERB_RE.test(message) && hasProductContext);
  const hasFraming =
    PRODUCT_FRAMING_INTENT_RE.test(message) && hasProductContext;
  const hasSimulation = isExplicitSimulationIntent(message);

  // P0 NOTE — projection/product confusion is closed by `hasCreation` above: a
  // bare creation verb ("create", "monter") only signals PRODUCT creation when a
  // product/vault noun is present. So "create projection" / "make a forecast"
  // (no product noun) → hasCreation=false, and — with the Scenario Lab route now
  // RETIRED — a standalone simulation carries no deterministic destination: it
  // falls through to the final `none` (handled by the LLM). Only the MIXED case
  // (product creation/framing that ALSO mentions a simulation) still routes, and
  // it opens the Product Workspace; the simulation half is recorded only in `kind`.

  if ((hasCreation || hasFraming) && hasSimulation) {
    return {
      kind: hasCreation
        ? "mixed_product_creation_simulation"
        : "mixed_product_framing_simulation",
      objective,
      primaryDestinationKey: PRODUCT_WORKSPACE_DESTINATION_KEY,
      autostart: true,
      shouldOpenProductWorkspace: true,
    };
  }

  if (hasCreation) {
    return {
      kind: "product_creation",
      objective,
      primaryDestinationKey: PRODUCT_WORKSPACE_DESTINATION_KEY,
      autostart: true,
      shouldOpenProductWorkspace: true,
    };
  }

  if (hasFraming) {
    return {
      kind: "product_framing",
      objective,
      primaryDestinationKey: PRODUCT_WORKSPACE_DESTINATION_KEY,
      autostart: true,
      shouldOpenProductWorkspace: true,
    };
  }

  // A standalone simulation/projection ask (no product context). The Scenario Lab
  // it used to open was retired, so there is no deterministic destination — it
  // falls to the LLM. The `kind` still reflects the classification for callers
  // that only inspect the intent.
  if (hasSimulation) {
    return {
      kind: "explicit_simulation",
      objective,
      shouldOpenProductWorkspace: false,
    };
  }

  return {
    kind: "none",
    objective,
    shouldOpenProductWorkspace: false,
  };
}

export function isProductWorkspaceIntent(message: string): boolean {
  return classifyProductWorkspaceIntent(message).shouldOpenProductWorkspace;
}

