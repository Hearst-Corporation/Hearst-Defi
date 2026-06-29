/**
 * Product Workspace — objective specificity analyzer.
 *
 * A bare "Je veux créer un produit." carries NO product substance: no asset /
 * strategy, no target investor, no yield source, no risk profile, no horizon.
 * Asking the model to write a full framing brief from it produces either a
 * hallucinated product or an endlessly-streaming preamble — which is exactly the
 * "the agent is writing the brief…" spinner the user reported.
 *
 * This pure analyzer scores the objective against the 5 framing dimensions so
 * the workspace can render a STRUCTURED "too vague" fallback (the 5 inputs to
 * define) instead of spinning. It NEVER calls the model and has no I/O.
 */

export type ProductFramingDimension =
  | "asset_or_strategy"
  | "target_investor"
  | "yield_source"
  | "risk_profile"
  | "time_horizon";

export interface ObjectiveQuality {
  /** True when the objective is too broad to generate a complete brief. */
  tooVague: boolean;
  /** Dimensions the objective DID cover (substance present). */
  present: ProductFramingDimension[];
  /** Dimensions still missing — what the admin must add. */
  missing: ProductFramingDimension[];
}

const DIMENSION_PATTERNS: Record<ProductFramingDimension, RegExp> = {
  // Asset / strategy: a concrete underlying or strategy, not just "produit".
  asset_or_strategy:
    /\b(btc|bitcoin|eth|ethereum|usdc|usdt|stable\w*|mining|minage|defi|staking|lending|rwa|treasury|bons? du tresor|t-?bills?|delta neutral|delta-neutre|basis|arbitrage|carry|yield farming|liquidity|liquidite|options?|perp\w*|futures?|hedge|covered call|structured?|structure\w*)\b/i,
  // Target investor: who it's for.
  target_investor:
    /\b(institution\w*|family office|fund of funds|hnwi|high net worth|accredited|qualified|retail|lp|limited partner|allocator\w*|distributeur\w*|wealth manager|ria|investisseur\w* (?:institutionnel\w*|qualifie\w*|accredite\w*)|prive\w*|professionnel\w*)\b/i,
  // Yield source: where return comes from.
  yield_source:
    /\b(yield|rendement|apy|apr|funding rate|funding|premium|prime|coupon|distribution\w*|interets?|interest|fee\w*|frais|carry|basis|spread|mining reward\w*|recompense\w*|staking reward\w*|cash flow|cashflow)\b/i,
  // Risk profile: downside / protection / volatility posture.
  risk_profile:
    /\b(downside|protection|hedge\w*|capital (?:preservation|protege\w*|protection)|defensive|defensif|conservat\w*|low (?:risk|vol)|faible (?:risque|volatilite)|drawdown|var|cvar|max loss|perte max\w*|buffer|coussin|principal protect\w*|aggressive|agressif|opportunist\w*|leverage|levier)\b/i,
  // Time horizon: lock-up / tenor / maturity.
  time_horizon:
    /\b(\d+\s*(?:jour|jours|day|days|mois|month|months|an|ans|annee|annees|year|years|trimestre\w*|quarter\w*|semaine\w*|week\w*))\b|\b(lock[- ]?up|lockup|blocage|maturite|maturity|tenor|echeance|horizon|duree|duration|short[- ]?term|long[- ]?term|court terme|long terme|moyen terme)\b/i,
};

const ALL_DIMENSIONS: readonly ProductFramingDimension[] = [
  "asset_or_strategy",
  "target_investor",
  "yield_source",
  "risk_profile",
  "time_horizon",
];

/** Human label for each missing dimension — surfaced in the fallback list. */
export const DIMENSION_LABEL: Record<ProductFramingDimension, string> = {
  asset_or_strategy: "Asset or strategy",
  target_investor: "Target investor",
  yield_source: "Yield source",
  risk_profile: "Risk profile",
  time_horizon: "Time horizon",
};

/**
 * Score an objective. An objective is "too vague" when it covers fewer than 2 of
 * the 5 framing dimensions — i.e. it names little more than "a product". Two or
 * more concrete dimensions (e.g. "BTC yield with downside protection") is enough
 * substance to attempt a real brief.
 */
export function analyzeObjectiveQuality(
  objective: string | null | undefined,
): ObjectiveQuality {
  const text = (objective ?? "").trim();
  if (text.length === 0) {
    return { tooVague: true, present: [], missing: [...ALL_DIMENSIONS] };
  }
  const present: ProductFramingDimension[] = [];
  const missing: ProductFramingDimension[] = [];
  for (const dim of ALL_DIMENSIONS) {
    if (DIMENSION_PATTERNS[dim].test(text)) present.push(dim);
    else missing.push(dim);
  }
  return { tooVague: present.length < 2, present, missing };
}
