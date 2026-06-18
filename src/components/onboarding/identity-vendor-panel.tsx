import { EmptySurface } from "@/components/ui/empty-surface";
import { Badge } from "@/components/ui/badge";

/**
 * Shown when the KYC vendor (Sumsub) is not configured — honest empty state,
 * no fake iframe.
 */
export function IdentityVendorPanel({ isProduction }: { isProduction: boolean }) {
  return (
    <div
      className="product-doc-stack--relaxed"
      role="region"
      aria-label="Identity verification unavailable"
    >
      <EmptySurface
        live
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
