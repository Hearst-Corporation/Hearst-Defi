import type { RiskPulseProps } from "@/components/portfolio/risk-pulse";
import type { ProofPulseProps } from "@/components/portfolio/proof-pulse";

/** Invest route used by cold-start surfaces (e.g. proof center). */
export const PORTFOLIO_ONBOARDING_INVEST_HREF = "/vaults/hearst-yield-vault/invest";

/** Composite must not display when every dimension is still N/A. */
export function isRiskCompositeUnavailable(props: RiskPulseProps): boolean {
  const dimensionsPopulated = props.scores.some((s) => s.score > 0);
  return isRiskPulseEmpty(props) || !dimensionsPopulated;
}

export function isRiskPulseEmpty(props: RiskPulseProps): boolean {
  return (
    props.compositeLabel === undefined &&
    props.composite === 0 &&
    props.scores.every((s) => s.score === 0)
  );
}

export function isProofPulseEmpty(props: ProofPulseProps): boolean {
  return (
    props.lastPor.statedTvlUsdc === 0 && props.lastPor.onChainTvlUsdc === 0
  );
}
