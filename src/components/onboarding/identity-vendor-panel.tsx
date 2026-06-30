/**
 * Shown when the KYC vendor (Sumsub) is not configured — honest empty state,
 * no fake iframe.
 */
export function IdentityVendorPanel({ isProduction }: { isProduction: boolean }) {
  return (
    <div
      className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col"
      role="region"
      aria-label="Identity verification unavailable"
    >
      <div className="p-5 border-b border-[var(--ct-border-soft)] flex items-center justify-between gap-4">
        <h2 className="ct-bento-label">Identity verification</h2>
        {!isProduction ? (
          <span className="ct-bento-label ct-status-warning-bg inline-flex items-center rounded-full px-2.5 py-0.5">
            Verification pending
          </span>
        ) : null}
      </div>

      <div className="p-5 flex flex-col gap-2" role="note">
        <p className="body-sm m-0">
          Identity verification is not yet available for your account
        </p>
        <p className="body-xs m-0">
          {isProduction
            ? "Contact Investor Relations to complete identity review manually."
            : "Identity verification will be available shortly. You can continue your onboarding now and complete verification at any time."}
        </p>
      </div>
    </div>
  );
}
