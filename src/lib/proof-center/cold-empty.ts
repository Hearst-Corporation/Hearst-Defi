/** True when the LP proof center has no live artefacts yet (cold testnet / fresh install). */
export function isProofCenterColdEmpty(input: {
  demo: boolean;
  hasAttestation: boolean;
  proofsCount: number;
  onChainEventsCount: number;
  distributionsCount: number;
  rebalancesCount: number;
  timelockCount: number;
}): boolean {
  if (input.demo) return false;
  return (
    !input.hasAttestation &&
    input.proofsCount === 0 &&
    input.onChainEventsCount === 0 &&
    input.distributionsCount === 0 &&
    input.rebalancesCount === 0 &&
    input.timelockCount === 0
  );
}
