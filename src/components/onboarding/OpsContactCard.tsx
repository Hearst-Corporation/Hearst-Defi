/**
 * OpsContactCard — Investor Relations representative (env-configured data only).
 */

interface OpsContactCardProps {
  name: string;
  title: string;
  email: string;
  calendlyHref: string;
}

export function OpsContactCard({
  name,
  title,
  email,
  calendlyHref,
}: OpsContactCardProps) {
  return (
    <section
      className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col"
      role="complementary"
      aria-label="Investor Relations contact"
    >
      <div className="flex items-end justify-between p-5 border-b border-[var(--ct-border-soft)]">
        <h2 className="text-[length:var(--ct-text-micro)] font-bold text-[var(--ct-text-muted)] uppercase tracking-[0.15em] leading-none">
          Your IR Contact
        </h2>
      </div>

      <div className="flex items-center gap-4 p-5">
        <span
          aria-hidden="true"
          className="inline-flex items-center justify-center size-11 shrink-0 rounded-full border border-[color-mix(in_srgb,var(--ct-accent)_20%,transparent)] bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] text-[length:var(--ct-text-sm)] font-semibold text-[var(--ct-accent)]"
        >
          {name.charAt(0)}
        </span>

        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <span className="text-[length:var(--ct-text-14)] font-semibold text-[var(--ct-text-strong)] tracking-tight truncate">
            {name}
          </span>
          <span className="text-[length:var(--ct-text-2xs)] text-[var(--ct-text-faint)] truncate">{title}</span>
        </div>
      </div>

      <div className="flex flex-col">
        <a
          href={`mailto:${email}`}
          className="flex items-center justify-between gap-4 px-5 py-3.5 border-t border-[var(--ct-border-soft)] text-[length:var(--ct-text-xs)] text-[var(--ct-accent)] hover:text-[var(--ct-text-strong)] transition-colors truncate"
          aria-label={`Email ${name} at ${email}`}
        >
          <span className="ct-bento-label">
            Email
          </span>
          <span className="truncate">{email}</span>
        </a>

        <a
          href={calendlyHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-4 px-5 py-3.5 border-t border-[var(--ct-border-soft)] text-[length:var(--ct-text-xs)] text-[var(--ct-accent)] hover:text-[var(--ct-text-strong)] transition-colors"
          aria-label={`Book a call with ${name} (opens in new tab)`}
        >
          <span className="ct-bento-label">
            Schedule
          </span>
          <span>Book a call ↗</span>
        </a>
      </div>
    </section>
  );
}
