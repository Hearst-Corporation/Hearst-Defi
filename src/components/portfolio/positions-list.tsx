import Link from "next/link";

import { EmptySurface } from "@/components/ui/empty-surface";
import {
  PfCockpitPanel,
  PfCockpitPanelHeader,
} from "@/components/portfolio/pf-cockpit-panel";
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

interface PositionsListProps {
  positions: PortfolioPosition[];
  source: "live" | "fallback";
  updatedAt?: Date;
  /** Render table shell with zero row (layout preview). */
  previewZeros?: boolean;
}

/**
 * Positions table.
 * ApyRange is used on every APY display (CLAUDE.md non-negotiable #1).
 * ProvenanceBadge on the header metric (CLAUDE.md non-negotiable #2).
 */
export function PositionsList({
  positions,
  source,
  updatedAt,
  previewZeros = false,
}: PositionsListProps) {
  const isEmpty = positions.length === 0;
  const showZeroShell = previewZeros || isEmpty;
  const provenance = showZeroShell
    ? undefined
    : resolveProvenance(source, updatedAt);

  return (
    <PfCockpitPanel variant="table" aria-label="Open positions">
      <PfCockpitPanelHeader
        title="Positions"
        provenance={provenance}
        trailing={
          !showZeroShell ? (
            <span className="body-xs ct-text-faint tabular">
              {positions.length} position{positions.length !== 1 ? "s" : ""}
            </span>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-1 overflow-x-auto min-w-0">
          {/* Header row */}
          <div className={cn("stat-label", "pf-positions-row-grid")}>
            <span>Vault</span>
            <span className="text-right">Principal</span>
            <span className="text-right">Value</span>
            <span className="text-right">Target APY</span>
            <span className="text-right">Since</span>
          </div>

          {showZeroShell && !previewZeros ? (
            <EmptySurface
              variant="inline"
              message="No active positions yet — your first deposit will appear here once confirmed on-chain."
            />
          ) : null}

          {showZeroShell && previewZeros ? (
            <div
              role="status"
              className="pf-positions-empty-row pf-table-empty-row"
            >
              <p className="pf-table-empty-title body-sm ct-text-muted font-semibold m-0">
                No open positions yet
              </p>
              <p className="pf-table-empty-copy body-xs ct-text-faint m-0">
                Your first confirmed deposit will appear here.
              </p>
            </div>
          ) : null}

          {positions.map((p) => (
            <div
              key={p.id}
              className={cn("pf-positions-row-grid", "pf-positions-row-grid--body")}
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
    </PfCockpitPanel>
  );
}
