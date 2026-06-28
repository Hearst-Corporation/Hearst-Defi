import type {
  SourceTruthStatus,
  SourceTruthSummary,
} from "@/lib/projection/source-truth-summary";

/**
 * Source-truth badge + summary for /admin/projection. Makes provenance legible:
 * an admin sees instantly what is LIVE vs FALLBACK / CONFIGURED / UNAUDITED /
 * MOCK / MIXED. Pure presentational. Never relabels fallback/mock as live.
 */

const TONE: Record<SourceTruthStatus, string> = {
  LIVE: "border-[color-mix(in_srgb,var(--ct-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] text-[var(--ct-accent)]",
  FALLBACK: "border-amber-400/30 bg-amber-400/10 text-amber-400",
  CONFIGURED: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  MOCK: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
  DEMO: "border-amber-400/30 bg-amber-400/10 text-amber-400",
  UNAUDITED: "border-rose-400/30 bg-rose-400/10 text-rose-400",
  PARTIAL: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  MIXED: "border-[var(--ct-border-strong)] bg-white/5 text-zinc-300",
};

export function SourceTruthBadge({
  status,
  children,
}: {
  status: SourceTruthStatus;
  children?: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${TONE[status]}`}
    >
      {children ?? status}
    </span>
  );
}

const ORDER: SourceTruthStatus[] = [
  "LIVE",
  "CONFIGURED",
  "UNAUDITED",
  "FALLBACK",
  "PARTIAL",
  "MOCK",
  "DEMO",
  "MIXED",
];

export function ProjectionSourceSummary({
  summary,
}: {
  summary: SourceTruthSummary;
}) {
  const present = ORDER.filter((s) => summary.counts[s] > 0);
  const inputs = summary.rows.filter((r) => r.kind === "input");
  const outputs = summary.rows.filter((r) => r.kind === "output");

  return (
    <div className="rounded-2xl border border-[var(--ct-border)] bg-[#15191C] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[length:var(--ct-text-micro)] font-bold uppercase tracking-[0.15em] text-zinc-500">
          Source truth
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SourceTruthBadge status="MIXED">{`Overall: ${summary.overall}`}</SourceTruthBadge>
          {present.map((s) => (
            <SourceTruthBadge key={s} status={s}>{`${summary.counts[s]} ${s}`}</SourceTruthBadge>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SourceColumn title="Inputs" rows={inputs} />
        <SourceColumn title="Outputs" rows={outputs} />
      </div>

      <p className="mt-3 border-t border-[var(--ct-border-soft)] pt-3 text-[length:var(--ct-text-micro)] italic text-zinc-600">
        Projection methodology : live inputs + configured assumptions. Not
        guaranteed. Admin validation required — {summary.verdict}.
      </p>
    </div>
  );
}

function SourceColumn({
  title,
  rows,
}: {
  title: string;
  rows: SourceTruthSummary["rows"];
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-600">
        {title}
      </div>
      <ul className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-2">
            <span className="text-[length:var(--ct-text-2xs)] text-zinc-300">
              {r.label}
              {r.detail ? (
                <span className="ml-1.5 tabular-nums text-zinc-500">{r.detail}</span>
              ) : null}
              {r.reason ? (
                <span className="ml-1.5 text-[length:var(--ct-text-micro)] italic text-zinc-600">
                  ({r.reason})
                </span>
              ) : null}
            </span>
            <SourceTruthBadge status={r.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}
