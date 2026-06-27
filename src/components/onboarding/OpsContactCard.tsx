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
      className="rounded-2xl border border-white/10 bg-black shadow-sm overflow-hidden flex flex-col"
      role="complementary"
      aria-label="Investor Relations contact"
    >
      <div className="flex items-end justify-between p-5 border-b border-white/5">
        <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-[0.15em] leading-none">
          Your IR Contact
        </h2>
      </div>

      <div className="flex items-center gap-4 p-5">
        <span
          aria-hidden="true"
          className="inline-flex items-center justify-center size-11 shrink-0 rounded-full border border-[#A7FB90]/20 bg-[#A7FB90]/10 text-[15px] font-semibold text-[#A7FB90]"
        >
          {name.charAt(0)}
        </span>

        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <span className="text-[14px] font-semibold text-white tracking-tight truncate">
            {name}
          </span>
          <span className="text-[12px] text-zinc-500 truncate">{title}</span>
        </div>
      </div>

      <div className="flex flex-col">
        <a
          href={`mailto:${email}`}
          className="flex items-center justify-between gap-4 px-5 py-3.5 border-t border-white/5 text-[13px] text-[#A7FB90] hover:text-white transition-colors truncate"
          aria-label={`Email ${name} at ${email}`}
        >
          <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">
            Email
          </span>
          <span className="truncate">{email}</span>
        </a>

        <a
          href={calendlyHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-4 px-5 py-3.5 border-t border-white/5 text-[13px] text-[#A7FB90] hover:text-white transition-colors"
          aria-label={`Book a call with ${name} (opens in new tab)`}
        >
          <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">
            Schedule
          </span>
          <span>Book a call ↗</span>
        </a>
      </div>
    </section>
  );
}
