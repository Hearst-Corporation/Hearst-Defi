import { PreviewModeChip } from "@/components/portfolio/layout-preview-banner";
import { ModuleChrome } from "@/components/ui/module-chrome";
import { WidgetPanelHeader } from "@/components/ui/widget-panel-header";

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
    <ModuleChrome aria-label="Security audit">
      <WidgetPanelHeader
        title="Security audit"
        trailing={
          <PreviewModeChip
            label={previewZeros ? "Preview mode" : "Awaiting first position"}
          />
        }
      />

      <ul
        className="flex flex-col gap-3 mt-3 relative z-10"
        aria-label="Security audit checklist"
      >
        {AUDIT_ROWS.map((row) => (
          <li key={row.label} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="body-sm ct-text-muted">{row.label}</span>
              <span className="body-xs ct-text-faint tabular">{row.status}</span>
            </div>
            <div className="pf-progress-track" aria-hidden>
              <div
                className="pf-progress-fill pf-progress-fill--accent"
                style={{ width: "0%" }}
              />
            </div>
          </li>
        ))}
      </ul>

      <p className="body-xs ct-text-faint mt-auto pt-4 italic relative z-10">
        Preview checklist — live audit status populates after account verification.
      </p>
    </ModuleChrome>
  );
}
