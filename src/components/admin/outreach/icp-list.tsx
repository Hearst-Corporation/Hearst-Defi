import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SourceMoreButton } from "@/components/admin/outreach/source-more-button";
import type { IcpRow } from "@/lib/data/outreach";

/**
 * Renders the defined ICPs with their filter summary, tier thresholds, and a
 * "Source more" trigger each. Presentational server component; the trigger is a
 * client island. Shown only when at least one ICP exists.
 */
export function IcpList({ icps }: { icps: IcpRow[] }) {
  if (icps.length === 0) return null;

  return (
    <div className="admin-doc-stack admin-doc-stack--actions">
      {icps.map((icp) => (
        <Card
          key={icp.id}
          className="admin-card--snug"
          hoverOverlay={false}
        >
          <div className="admin-doc-inline-row admin-doc-inline-row--between">
            <div className="admin-doc-stack admin-doc-stack--tight">
              <div className="admin-doc-inline-row admin-doc-inline-row--tight">
                <span className="ct-text-strong body-sm">{icp.name}</span>
                <Badge variant={icp.active ? "success" : "default"}>
                  {icp.persona}
                </Badge>
                <span className="body-xs ct-text-muted">
                  {icp.prospectCount} sourced
                </span>
              </div>
              <p className="body-xs ct-text-muted m-0">
                {[
                  icp.titles.length > 0 ? icp.titles.join(", ") : null,
                  icp.locations.length > 0 ? icp.locations.join(", ") : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "No filters set"}
              </p>
              <p className="body-xs ct-text-muted m-0">
                Tiers — Prime ≥ {icp.tierAMin} · Warm ≥ {icp.tierBMin} · Cold ≥{" "}
                {icp.tierCMin} · {icp.language.toUpperCase()}
              </p>
            </div>
            <SourceMoreButton icpId={icp.id} />
          </div>
        </Card>
      ))}
    </div>
  );
}
