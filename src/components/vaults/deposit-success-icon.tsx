/** Success checkmark for deposit confirmation header. */
export function DepositSuccessIcon() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-[var(--ct-status-success-border)] bg-[var(--ct-status-success-soft)] shadow-[var(--ct-glow-soft)]"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M5 12l5 5L19 7"
          stroke="var(--ct-status-success)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
