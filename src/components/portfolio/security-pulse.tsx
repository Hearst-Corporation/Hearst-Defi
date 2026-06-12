import { AwaitingMetricState } from "@/components/portfolio/awaiting-metric-state";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";

export interface SecurityPulseProps {
  previewZeros?: boolean;
  embedded?: boolean;
}

const AUDIT_ROWS = [
  { label: "Smart contract audit", status: "Pending" },
  { label: "Key custody posture", status: "Pending" },
  { label: "Operational controls", status: "Pending" },
] as const;

/**
 * Security posture summary. Live values require a verified backend feed;
 * layout preview renders the checklist shell at zero (stale provenance).
 */
export function SecurityPulse({
  previewZeros = false,
  embedded = false,
}: SecurityPulseProps = {}) {
  if (!previewZeros) {
    return (
      <AwaitingMetricState message="Security status will appear after account verification." />
    );
  }

  const body = (
    <>
      {!embedded ? (
        <div className="pf-widget-header relative z-10">
          <h3 className="h3">Security audit</h3>
          <ProvenanceBadge kind="stale" />
        </div>
      ) : null}

      <ul className="flex flex-col gap-3 mt-3 relative z-10" aria-label="Security audit checklist">
        {AUDIT_ROWS.map((row) => (
          <li key={row.label} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="body-sm ct-text-muted">{row.label}</span>
              <span className="body-xs ct-text-faint tabular">{row.status}</span>
            </div>
            <div className="pf-progress-track" aria-hidden>
              <div className="pf-progress-fill pf-progress-fill--accent" style={{ width: "0%" }} />
            </div>
          </li>
        ))}
      </ul>

      <p className="body-xs ct-text-faint mt-auto pt-4 italic relative z-10">
        Preview checklist — live audit status populates after account verification.
      </p>
    </>
  );

  if (embedded) {
    return (
      <div className={cn("flex h-full flex-col")} aria-label="Security audit">
        {body}
      </div>
    );
  }

  return (
    <article className="dash-cell dash-cell-premium flex flex-col h-full" aria-label="Security audit">
      {body}
    </article>
  );
}
