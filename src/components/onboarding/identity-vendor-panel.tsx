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
        message="Identity verification is not yet available for your account"
        detail={
          isProduction
            ? "Contact Investor Relations to complete identity review manually."
            : "Identity verification will be available shortly. You can continue your onboarding now and complete verification at any time."
        }
      />
      {!isProduction ? (
        <Badge variant="warning">Verification pending</Badge>
      ) : null}
    </div>
  );
}
