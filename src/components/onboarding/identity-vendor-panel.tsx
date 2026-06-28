/**
 * Shown when the KYC vendor (Sumsub) is not configured — honest empty state,
 * no fake iframe.
 */
export function IdentityVendorPanel({ isProduction }: { isProduction: boolean }) {
  return (
    <div
      className="rounded-2xl border border-white/10 bg-surface-card shadow-sm overflow-hidden flex flex-col"
      role="region"
      aria-label="Identity verification unavailable"
    >
      <div className="p-5 border-b border-white/5 flex items-center justify-between gap-4">
        <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-[0.15em]">
          Identity verification
        </h2>
        {!isProduction ? (
          <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
            Verification pending
          </span>
        ) : null}
      </div>

      <div className="p-5 flex flex-col gap-2" role="note">
        <p className="text-[13px] text-zinc-400 m-0">
          Identity verification is not yet available for your account
        </p>
        <p className="text-[12px] text-zinc-600 leading-relaxed m-0">
          {isProduction
            ? "Contact Investor Relations to complete identity review manually."
            : "Identity verification will be available shortly. You can continue your onboarding now and complete verification at any time."}
        </p>
      </div>
    </div>
  );
}
