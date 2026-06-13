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
        message="Identity verification not configured"
        detail={
          isProduction
            ? "KYC is not available in this environment yet. Contact Investor Relations for assistance."
            : "Set NEXT_PUBLIC_PERSONA_TEMPLATE_ID to enable the Persona embed in local development."
        }
      />
      {!isProduction ? (
        <Badge variant="warning">Vendor not configured — dev only</Badge>
      ) : null}
    </div>
  );
}
