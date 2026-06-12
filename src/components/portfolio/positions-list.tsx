import Link from "next/link";

import { AwaitingMetricState } from "@/components/portfolio/awaiting-metric-state";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { ApyRange } from "@/components/ui/apy-range";
import type { PortfolioPosition } from "@/lib/data/portfolio";
import { formatUsdCompact } from "@/lib/format/usd-compact";
import { cn } from "@/lib/cn";
import { resolveProvenance } from "@/lib/portfolio/provenance";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const STATUS_DOT_CLASS: Record<string, string> = {
  active: "pf-status-dot--active",
  matured: "pf-status-dot--matured",
  exited: "pf-status-dot--exited",
};

const ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_minmax(4.5rem,auto)_minmax(4.5rem,auto)_minmax(5rem,auto)_minmax(5.5rem,auto)] gap-3 pb-2 border-b border-(--ct-border-soft) last:border-0 min-w-0";

interface PositionsListProps {
  positions: PortfolioPosition[];
  source: "live" | "fallback";
  updatedAt?: Date;
}

/**
 * Positions table.
 * ApyRange is used on every APY display (CLAUDE.md non-negotiable #1).
 * ProvenanceBadge on the header metric (CLAUDE.md non-negotiable #2).
 */
export function PositionsList({ positions, source, updatedAt }: PositionsListProps) {
  const provenance = resolveProvenance(source, updatedAt);

  if (positions.length === 0) {
    return (
      <AwaitingMetricState message="No open positions." />
    );
  }

  return (
    <article className="dash-cell dash-cell-premium flex flex-col" aria-label="Open positions">
      <div className="pf-widget-header">
        <span className="dash-label">
          <span>Positions</span>
        </span>
        <span className="dash-label-meta">
          <ProvenanceBadge kind={provenance} />
          <span className="body-xs ct-text-muted tabular">
            {positions.length} position{positions.length !== 1 ? "s" : ""}
          </span>
        </span>
      </div>

      <div className="flex flex-col gap-1 mt-3 overflow-x-auto min-w-0">
          {/* Header row */}
          <div className={cn("stat-label", ROW_GRID)}>
            <span>Vault</span>
            <span className="text-right">Principal</span>
            <span className="text-right">Value</span>
            <span className="text-right">Target APY</span>
            <span className="text-right">Since</span>
          </div>

          {positions.map((p) => (
            <div
              key={p.id}
              className={cn(ROW_GRID, "items-center")}
            >
              {/* Vault name + status */}
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={cn(
                    "pf-status-dot",
                    STATUS_DOT_CLASS[p.status] ?? "pf-status-dot--default",
                  )}
                  aria-hidden
                />
                <Link
                  href={`/portfolio/${p.id}`}
                  className="body-md ct-text-primary min-w-0 truncate underline-offset-4 hover:underline"
                  aria-label={`Open details for ${p.vaultName ?? "unassigned vault"}`}
                >
                  {p.vaultName ?? "Unassigned vault"}
                </Link>
              </div>

              {/* Principal */}
              <span className="tabular body-md text-right ct-text-body">
                {formatUsdCompact(p.principalUsdc)}
              </span>

              {/* Current value */}
              <span className="tabular body-md ct-text-strong font-semibold text-right">
                {formatUsdCompact(p.valueUsdc)}
              </span>

              {/* APY range — non-negotiable #1 */}
              <div className="text-right">
                {p.apyLow !== null && p.apyHigh !== null ? (
                  <ApyRange low={p.apyLow} high={p.apyHigh} precision={1} />
                ) : (
                  <span className="body-xs ct-text-faint">Unavailable</span>
                )}
              </div>

              {/* Subscribed date */}
              <span className="body-xs tabular ct-text-muted text-right">
                {dateFmt.format(p.subscribedAt)}
              </span>
            </div>
          ))}
        </div>
    </article>
  );
}
