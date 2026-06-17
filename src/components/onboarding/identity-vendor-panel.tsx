import { AwaitingMetricState } from "@/components/ui/awaiting-metric-state";
import { Badge } from "@/components/ui/badge";

/**
 * Shown when Persona is not configured — honest empty state, no fake iframe.
 */
export function IdentityVendorPanel({ isProduction }: { isProduction: boolean }) {
  return (
    <div
      className="product-doc-stack--relaxed"
      role="region"
      aria-label="Identity verification unavailable"
    >
      <AwaitingMetricState
        variant="inline"
        message="Identity verification is not available in this workspace yet"
        detail={
          isProduction
            ? "Contact Investor Relations to complete identity review manually."
            : "Review mode is active until the embedded identity flow is enabled for this workspace."
        }
      />
      {!isProduction ? (
        <Badge variant="warning">Review mode</Badge>
      ) : null}
    </div>
  );
}
