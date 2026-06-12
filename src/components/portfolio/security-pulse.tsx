import { AwaitingMetricState } from "@/components/portfolio/awaiting-metric-state";

export interface SecurityPulseProps {
  /** @deprecated Layout preview uses the same awaiting surface — kept for call-site compat. */
  previewZeros?: boolean;
  /** Inside MergedSurface — parent supplies section label. */
  embedded?: boolean;
}

/**
 * Security posture summary. Live values require a verified backend feed;
 * until then, render DS §9.3 awaiting surface only (no fake audit rows).
 */
export function SecurityPulse({ previewZeros = false }: SecurityPulseProps = {}) {
  return (
    <AwaitingMetricState
      message="Security status will appear after account verification."
      className={previewZeros ? "pf-zero-await" : undefined}
    />
  );
}
