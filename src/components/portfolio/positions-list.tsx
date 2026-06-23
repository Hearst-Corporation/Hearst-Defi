import Link from "next/link";

import { ApyRange } from "@/components/ui/apy-range";
import { type PortfolioPosition, POSITION_STATUS_CONFIG } from "@/lib/data/portfolio";
import { formatUsdCompact } from "@/lib/vaults/product-display";
import { cn } from "@/lib/cn";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import { PortfolioLeafLink } from "@/components/portfolio/portfolio-leaf-link";
import {
  PfCockpitPanel,
  PfCockpitPanelHeader,
} from "@/components/portfolio/pf-cockpit-panel";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

interface PositionsListProps {
  positions: PortfolioPosition[];
  source: "live" | "fallback";
  updatedAt?: Date;
  leafHref?: string;
  embedded?: boolean;
}

/**
 * Positions — clean ledger table.
 * Header row + one row per position: vault (status dot + link), principal,
 * current value (bright), APY range (#1), since. Honest empty placeholder when
 * no positions exist yet. Provenance on header (#2).
 */
export function PositionsList({
  positions,
  source,
  updatedAt,
  leafHref,
  embedded = false,
}: PositionsListProps) {
  const hasPositions = positions.length > 0;
  const provenance = hasPositions ? resolveProvenance(source, updatedAt) : undefined;

  const trailing = leafHref ? (
    <PortfolioLeafLink href={leafHref} />
  ) : hasPositions ? (
    <span className="body-xs ct-text-tertiary tabular">
      {positions.length} position{positions.length !== 1 ? "s" : ""}
    </span>
  ) : undefined;

  if (!hasPositions) {
    return (
      <PfCockpitPanel
        variant="table"
        chrome={embedded ? "embedded" : "panel"}
        aria-label="Open positions — awaiting first position"
      >
        <PfCockpitPanelHeader
          title="Positions"
          titleVariant="primary"
          trailing={trailing}
        />
        {/* Zero-state skeleton — the ledger frame with muted placeholder rows.
           Fills in with real positions as soon as the first one is confirmed. */}
        <div className="pf-positions pf-positions--skeleton" aria-label="No positions yet">
          <div className="pf-positions__row pf-positions__row--head stat-label">
            <span>Vault</span>
            <span className="pf-positions__num opacity-0">Principal</span>
            <span className="pf-positions__num opacity-0">Value</span>
            <span className="pf-positions__num">Range</span>
            <span className="pf-positions__num">Since</span>
          </div>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="pf-positions__row pf-positions__row--body pf-positions__row--skeleton py-4" aria-hidden>
              <span className="pf-positions__vault">
                <span className="pf-status-dot pf-skeleton-dot" />
                <span className="pf-skeleton-bar pf-skeleton-bar--vault" />
              </span>
              <span className="pf-positions__num"><span className="pf-skeleton-bar pf-skeleton-bar--num" /></span>
              <span className="pf-positions__num"><span className="pf-skeleton-bar pf-skeleton-bar--num" /></span>
              <span className="pf-positions__num"><span className="pf-skeleton-bar pf-skeleton-bar--num" /></span>
              <span className="pf-positions__num"><span className="pf-skeleton-bar pf-skeleton-bar--num" /></span>
            </div>
          ))}
        </div>
      </PfCockpitPanel>
    );
  }

  return (
    <PfCockpitPanel
      variant="table"
      chrome={embedded ? "embedded" : "panel"}
      aria-label="Open positions"
    >
      <PfCockpitPanelHeader
        title="Positions"
        titleVariant="primary"
        provenance={provenance}
        trailing={trailing}
      />
      <div className="pf-positions">
        <div className="pf-positions__row pf-positions__row--head stat-label">
          <span>Vault</span>
          <span className="pf-positions__num">Principal</span>
          <span className="pf-positions__num">Value</span>
          <span className="pf-positions__num">Range</span>
          <span className="pf-positions__num">Since</span>
        </div>

        {positions.map((p) => {
          const statusConfig = POSITION_STATUS_CONFIG[p.status];
          return (
            <div key={p.id} className="pf-positions__row pf-positions__row--body">
              <span className="pf-positions__vault">
                <span
                  className={cn("pf-status-dot", statusConfig.dot)}
                  aria-hidden
                />
                <Link
                  href={`/portfolio/${p.id}`}
                  className="body-sm ct-text-strong min-w-0 truncate underline-offset-4 hover:underline font-medium"
                  aria-label={`Open details for ${p.vaultName ?? "unassigned vault"}`}
                >
                  {p.vaultName ?? "Unassigned vault"}
                </Link>
              </span>

            <span className="pf-positions__num tabular body-sm ct-text-body">
              {formatUsdCompact(p.principalUsdc)}
            </span>

            <span className="pf-positions__num tabular body-sm ct-text-strong font-bold text-(--ct-accent)">
              {formatUsdCompact(p.valueUsdc)}
            </span>

            <span className="pf-positions__num">
              {p.apyLow !== null && p.apyHigh !== null ? (
                <ApyRange low={p.apyLow} high={p.apyHigh} precision={1} className="body-xs font-semibold ct-text-secondary" />
              ) : (
                <span className="body-xs ct-text-tertiary">Unavailable</span>
              )}
            </span>

            <span className="pf-positions__num body-xs tabular ct-text-tertiary opacity-70">
              {dateFmt.format(p.subscribedAt)}
            </span>
          </div>
        );
      })}
    </div>
  </PfCockpitPanel>
);
}
