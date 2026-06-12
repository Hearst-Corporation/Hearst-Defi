import { AwaitingMetricState } from "@/components/portfolio/awaiting-metric-state";

/**
 * SecurityPulse — Trust-building component summarizing active security measures.
 *
 * Values (AES-256, Hardened, Spearbit, Active) are not yet sourced from a
 * verified backend feed — until they are, render a light empty surface instead
 * of a fake active card with static marketing copy.
 */

export function SecurityPulse() {
  return (
    <AwaitingMetricState message="Security status will appear after account verification." />
  );
}
