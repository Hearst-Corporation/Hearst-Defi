import { AwaitingMetricState } from "@/components/ui/awaiting-metric-state";

/**
 * Security posture summary. Live values require a verified backend feed.
 */
export function SecurityPulse() {
  return (
    <AwaitingMetricState message="Security status will appear after account verification." />
  );
}
