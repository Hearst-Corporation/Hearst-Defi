import {
  PfCockpitPanel,
  PfCockpitPanelHeader,
} from "@/components/portfolio/pf-cockpit-panel";

export interface SecurityPulseProps {
  previewZeros?: boolean;
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
}: SecurityPulseProps = {}) {
  return (
    <PfCockpitPanel variant="compact" aria-label="Security audit">
      <PfCockpitPanelHeader title="Security audit" />

      <ul className="pf-checklist-list" aria-label="Security audit checklist">
        {AUDIT_ROWS.map((row) => (
          <li key={row.label} className="pf-checklist-row">
            <span className="body-sm ct-text-muted">{row.label}</span>
            <span className="pf-checklist-row__status body-xs ct-text-faint">
              <span
                className="pf-status-dot pf-status-dot--default opacity-50"
                aria-hidden
              />
              {row.status}
            </span>
          </li>
        ))}
      </ul>

      {!previewZeros ? (
        <p className="pf-panel-footnote body-xs ct-text-faint">
          Live status after account verification.
        </p>
      ) : null}
    </PfCockpitPanel>
  );
}
