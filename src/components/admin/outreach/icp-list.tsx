import { BentoBadge as Badge } from "@/components/catalyst/bento-badge";
import { BentoPanel } from "@/components/catalyst/bento";
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
    <div className="flex flex-col gap-3">
      {icps.map((icp) => (
        <BentoPanel key={icp.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="ct-metric-value">{icp.name}</span>
                <Badge variant={icp.active ? "success" : "default"}>
                  {icp.persona}
                </Badge>
                <span className="ct-metric-caption">
                  {icp.prospectCount} sourced
                </span>
              </div>
              <p className="ct-metric-caption m-0">
                {[
                  icp.titles.length > 0 ? icp.titles.join(", ") : null,
                  icp.locations.length > 0 ? icp.locations.join(", ") : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "No filters set"}
              </p>
              <p className="ct-metric-caption m-0">
                Tiers — Prime ≥ {icp.tierAMin} · Warm ≥ {icp.tierBMin} · Cold ≥{" "}
                {icp.tierCMin} · {icp.language.toUpperCase()}
              </p>
            </div>
            <SourceMoreButton icpId={icp.id} />
          </div>
        </BentoPanel>
      ))}
    </div>
  );
}
