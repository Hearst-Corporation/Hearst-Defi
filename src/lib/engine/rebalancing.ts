import type { VaultMode } from "./types";

const DEFENSIVE_RISK_THRESHOLD = 65;
const DEFENSIVE_MARGIN_THRESHOLD = 50;
const OPPORTUNISTIC_RISK_THRESHOLD = 40;
const OPPORTUNISTIC_MARGIN_THRESHOLD = 75;

export function decideMode(
  riskScore: number,
  marginScore: number,
): VaultMode {
  if (
    riskScore >= DEFENSIVE_RISK_THRESHOLD ||
    marginScore < DEFENSIVE_MARGIN_THRESHOLD
  ) {
    return "defensive";
  }
  if (
    riskScore <= OPPORTUNISTIC_RISK_THRESHOLD &&
    marginScore >= OPPORTUNISTIC_MARGIN_THRESHOLD
  ) {
    return "opportunistic";
  }
  return "balanced";
}
