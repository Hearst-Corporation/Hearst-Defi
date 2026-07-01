/**
 * Objective Intent Profile — a PURE, DETERMINISTIC reading of the construction
 * objective text. NO LLM, NO network, NO randomness: it matches a fixed keyword
 * lexicon and returns a typed profile plus the exact signals that matched, so
 * every downstream projection adjustment is explainable and reproducible.
 *
 * This does NOT invent market data, hashprice, yields, or a rendement. It only
 * classifies *intent* (what kind of product, how conservative, what horizon)
 * which the pipeline then turns into BOUNDED, clamped assumption overrides.
 */

export type ProductFamily =
  | "mining"
  | "defi_yield"
  | "btc_treasury"
  | "stable_income"
  | "generic";

export type RiskProfile = "conservative" | "balanced" | "opportunistic";

export type IncomePreference = "monthly_distribution" | "growth" | "mixed";

export type Horizon = "12m" | "24m" | "36m" | "unknown";

export type Tri = "high" | "medium" | "low";

export interface ObjectiveIntentProfile {
  productFamily: ProductFamily;
  riskProfile: RiskProfile;
  incomePreference: IncomePreference;
  horizon: Horizon;
  capitalProtectionIntent: Tri;
  liquidityPreference: Tri;
  /** Human-readable phrases that matched, deduped, in match order. */
  matchedSignals: string[];
  /** Deterministic 0..1 score — share of dimensions that matched a real signal. */
  confidence: number;
}

/** Normalise for matching: lowercase, strip accents, collapse whitespace. */
function normalise(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

interface Rule<T> {
  value: T;
  /** Any of these (word-boundary) marks a hit. EN + FR. */
  patterns: RegExp[];
  /** Label shown in matchedSignals when this rule fires. */
  label: string;
}

function firstMatch<T>(
  text: string,
  rules: Rule<T>[],
  fallback: T,
): { value: T; label: string | null } {
  for (const rule of rules) {
    if (rule.patterns.some((p) => p.test(text))) {
      return { value: rule.value, label: rule.label };
    }
  }
  return { value: fallback, label: null };
}

// ---------------------------------------------------------------------------
// Lexicon — fixed, auditable. Order matters: earlier rules win.
// ---------------------------------------------------------------------------

const FAMILY_RULES: Rule<ProductFamily>[] = [
  {
    value: "mining",
    label: "mining",
    patterns: [/\bmining\b/, /\bminer(s)?\b/, /\basic(s)?\b/, /\bhashrate\b/, /\bhashprice\b/],
  },
  {
    value: "stable_income",
    label: "stable income",
    patterns: [/\bstable\b/, /\busdc\b/, /\bstablecoin\b/, /\bt-?bill\b/, /\bcash\b/, /\bmonetaire\b/],
  },
  {
    value: "defi_yield",
    label: "defi yield",
    patterns: [/\bdefi\b/, /\byield\b/, /\blending\b/, /\baave\b/, /\bmorpho\b/, /\bcompound\b/, /\bethena\b/],
  },
  {
    value: "btc_treasury",
    label: "btc treasury",
    patterns: [/\bbtc\b/, /\bbitcoin\b/, /\btreasury\b/, /\bupside\b/, /\bhodl\b/],
  },
];

const RISK_RULES: Rule<RiskProfile>[] = [
  {
    value: "conservative",
    label: "conservative",
    patterns: [
      /\bconservative\b/, /\bcapital preservation\b/, /\bpreserv/, /\bdefensive\b/,
      /\blow risk\b/, /\bsafe\b/, /\bprudent\b/, /\bprotect/, /\bprudente?\b/,
    ],
  },
  {
    value: "opportunistic",
    label: "opportunistic",
    patterns: [
      /\bopportunistic\b/, /\baggressive\b/, /\bhigh yield\b/, /\bhigh-yield\b/,
      /\bhigh return\b/, /\bupside\b/, /\bgrowth\b/, /\bmaximis?e\b/, /\bmaximize\b/,
      /\bagressi/, /\bhaut rendement\b/,
    ],
  },
  {
    value: "balanced",
    label: "balanced",
    patterns: [/\bbalanced\b/, /\bequilibre/, /\bmoderate\b/],
  },
];

const INCOME_RULES: Rule<IncomePreference>[] = [
  {
    value: "monthly_distribution",
    label: "monthly income",
    patterns: [
      /\bmonthly\b/, /\bincome\b/, /\bdistribution(s)?\b/, /\bpayout(s)?\b/, /\byield income\b/,
      /\bmensuel/, /\brevenu/, /\bcoupon\b/,
    ],
  },
  {
    value: "growth",
    label: "growth",
    patterns: [/\bgrowth\b/, /\bappreciation\b/, /\bupside\b/, /\bcompounding\b/, /\bcroissance\b/],
  },
];

const HORIZON_RULES: Rule<Horizon>[] = [
  { value: "36m", label: "36-month horizon", patterns: [/\b36[ -]?month/, /\b3[ -]?year/, /\b36m\b/, /\b36 mois\b/] },
  { value: "24m", label: "24-month horizon", patterns: [/\b24[ -]?month/, /\b2[ -]?year/, /\b24m\b/, /\b24 mois\b/] },
  { value: "12m", label: "12-month horizon", patterns: [/\b12[ -]?month/, /\b1[ -]?year/, /\b12m\b/, /\b12 mois\b/] },
];

/**
 * Parse an objective string into a deterministic intent profile. Pure — same
 * input always yields the same output. `null`/empty → a generic/balanced default
 * with confidence 0.
 */
export function parseObjectiveProfile(objectiveRaw: string | null | undefined): ObjectiveIntentProfile {
  const text = normalise(objectiveRaw ?? "");
  const matchedSignals: string[] = [];
  const push = (label: string | null) => {
    if (label && !matchedSignals.includes(label)) matchedSignals.push(label);
  };

  const family = firstMatch(text, FAMILY_RULES, "generic");
  push(family.label);

  const risk = firstMatch(text, RISK_RULES, "balanced");
  push(risk.label);

  const income = firstMatch(text, INCOME_RULES, "mixed");
  push(income.label);

  const horizon = firstMatch(text, HORIZON_RULES, "unknown");
  push(horizon.label);

  // Derived intents (no new keywords — inferred from the classified dimensions so
  // they stay consistent with what actually matched).
  const capitalProtectionIntent: Tri =
    risk.value === "conservative" ? "high" : risk.value === "opportunistic" ? "low" : "medium";

  const liquidityPreference: Tri =
    family.value === "stable_income"
      ? "high"
      : family.value === "mining" || family.value === "btc_treasury"
        ? "low"
        : "medium";

  // Confidence = share of the 4 primary dimensions that matched a real signal.
  const dims = [family.label, risk.label, income.label, horizon.label];
  const matched = dims.filter(Boolean).length;
  const confidence = Math.round((matched / dims.length) * 100) / 100;

  return {
    productFamily: family.value,
    riskProfile: risk.value,
    incomePreference: income.value,
    horizon: horizon.value,
    capitalProtectionIntent,
    liquidityPreference,
    matchedSignals,
    confidence,
  };
}
