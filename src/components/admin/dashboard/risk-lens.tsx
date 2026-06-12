import { DashboardPanelHeader } from "@/components/ui/system-panel";
import type { Provenance } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";
import { riskSeverityTone } from "@/lib/admin/dashboard-board-view";
import type { RiskFrameworkData } from "@/lib/data/risk-framework";

import { DashboardCommandCell } from "./command-cell";

export function RiskLens({
  risk,
  riskProvenance,
}: {
  risk: RiskFrameworkData;
  riskProvenance: Provenance;
}) {
  const ready = risk.dimensions.length > 0;

  return (
    <DashboardCommandCell
      ready={ready}
      emptyMessage="Risk lens appears once mining and vault snapshots are on file."
      emptyAriaLabel="Risk lens awaiting data"
    >
      <DashboardPanelHeader title="Risk lens" provenance={riskProvenance} tone="primary" />
      <div className="dashboard-assets-risk">
        {risk.dimensions.slice(0, 5).map((dimension) => (
          <div key={dimension.id} className="dashboard-assets-risk__row">
            <span>{dimension.label}</span>
            <div className="dashboard-assets-risk__track">
              <span
                className={cn(
                  "dashboard-assets-risk__fill",
                  toneClass(riskSeverityTone(dimension.severity)),
                )}
                style={{ width: `${Math.max(4, Math.min(100, dimension.score))}%` }}
              />
            </div>
            <strong className="tabular">{dimension.score}</strong>
          </div>
        ))}
      </div>
    </DashboardCommandCell>
  );
}

function toneClass(tone: "success" | "warning" | "danger"): string {
  if (tone === "danger") return "ct-status-danger";
  if (tone === "warning") return "ct-status-warning";
  return "ct-status-success";
}
