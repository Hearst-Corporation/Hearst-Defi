/**
 * Bridge the deterministic ObjectiveIntentProfile (parsed from the workspace
 * objective text, see src/lib/agentic/swarm/live/objective-profile.ts) into a
 * structured StrategySelectionRequest. Pure mapping — no LLM, no invented data.
 */

import type { ObjectiveIntentProfile } from "@/lib/agentic/swarm/live/objective-profile";
import type {
  ProductFamily,
  Priority,
  RiskProfileKey,
  StrategySelectionRequest,
} from "./types";

const FAMILY_MAP: Record<ObjectiveIntentProfile["productFamily"], ProductFamily> = {
  mining: "btc_mining",
  stable_income: "stable_income",
  btc_treasury: "btc_upside",
  defi_yield: "defi_yield",
  generic: "generic",
};

const RISK_MAP: Record<ObjectiveIntentProfile["riskProfile"], RiskProfileKey> = {
  conservative: "safe",
  balanced: "balanced",
  opportunistic: "opportunistic",
};

/** Derive a priority hint from the profile's income + protection intents. */
function priorityFor(profile: ObjectiveIntentProfile): Priority | undefined {
  if (profile.incomePreference === "monthly_distribution") return "monthly_income";
  if (profile.capitalProtectionIntent === "high") return "capital_protection";
  if (profile.productFamily === "btc_treasury") return "btc_upside";
  if (profile.incomePreference === "growth") return "total_return";
  if (profile.liquidityPreference === "high") return "liquidity";
  return undefined;
}

const HORIZON_MONTHS: Record<Exclude<ObjectiveIntentProfile["horizon"], "unknown">, 12 | 24 | 36> = {
  "12m": 12,
  "24m": 24,
  "36m": 36,
};

export function objectiveProfileToSelectionRequest(
  profile: ObjectiveIntentProfile,
  note?: string,
): StrategySelectionRequest {
  const req: StrategySelectionRequest = {
    productFamily: FAMILY_MAP[profile.productFamily],
    riskProfile: RISK_MAP[profile.riskProfile],
    liquidityPreference: profile.liquidityPreference,
    incomePreference: profile.incomePreference,
  };
  const priority = priorityFor(profile);
  if (priority) req.priority = priority;
  if (profile.horizon !== "unknown") req.horizonMonths = HORIZON_MONTHS[profile.horizon];
  if (note) req.note = note;
  return req;
}
