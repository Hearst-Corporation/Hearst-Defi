import { AwaitingMetricState } from "@/components/portfolio/awaiting-metric-state";
import { PreviewWidgetShell } from "@/components/portfolio/preview-widget-shell";

const PREVIEW_ROWS = [
  { label: "Encryption", value: "—" },
  { label: "Custody", value: "—" },
  { label: "Smart contract audit", value: "—" },
  { label: "Monitoring", value: "—" },
] as const;

export interface SecurityPulseProps {
  /** Render structural shell at placeholder values (layout preview). */
  previewZeros?: boolean;
}

/**
 * Security posture summary. Live values require a verified backend feed;
 * layout preview shows the shell at em-dash placeholders with Stale provenance.
 */
export function SecurityPulse({ previewZeros = false }: SecurityPulseProps) {
  if (!previewZeros) {
    return (
      <AwaitingMetricState message="Security status will appear after account verification." />
    );
  }

  return (
    <PreviewWidgetShell
      title="Security posture"
      provenance="stale"
      ariaLabel="Security posture"
    >
      <ul className="flex flex-col gap-2 relative z-10 m-0 mt-3 p-0 list-none">
        {PREVIEW_ROWS.map((row) => (
          <li
            key={row.label}
            className="flex items-center justify-between gap-3 border-b border-(--ct-border-soft) pb-2 last:border-0"
          >
            <span className="body-xs ct-text-muted">{row.label}</span>
            <span className="body-xs tabular mono ct-text-faint">{row.value}</span>
          </li>
        ))}
      </ul>
      <p className="mt-auto pt-4 body-xs italic ct-text-faint">
        Status populates after account verification and audit attestation.
      </p>
    </PreviewWidgetShell>
  );
}
