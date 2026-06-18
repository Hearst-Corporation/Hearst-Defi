import Link from "next/link";

import {
  PfCockpitPanel,
  PfCockpitPanelHeader,
} from "@/components/portfolio/pf-cockpit-panel";
import { EmptySurface } from "@/components/ui/empty-surface";
import { ApyRange } from "@/components/ui/apy-range";
import type { PortfolioPosition } from "@/lib/data/portfolio";
import { formatUsdCompact } from "@/lib/vaults/product-display";
import { cn } from "@/lib/cn";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import { PortfolioLeafLink } from "@/components/portfolio/portfolio-leaf-link";

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
  /** Hub-only link to the focused leaf page. */
  leafHref?: string;
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
  leafHref,
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
          leafHref ? (
            <PortfolioLeafLink href={leafHref} />
          ) : !showZeroShell ? (
            <span className="body-xs ct-text-faint tabular">
              {positions.length} position{positions.length !== 1 ? "s" : ""}
            </span>
          ) : undefined
        }
      />

      <div className="pf-positions-scroll-wrap">
        <div className={cn("pf-positions-table", showZeroShell && "pf-positions-table--zero")}>
          {/* Header row — hidden in zero/preview state (no table to head) */}
          {!showZeroShell ? (
            <div className={cn("stat-label", "pf-positions-row-grid", "pf-positions-row-grid--header")}>
              <div className="pf-position-vault-cell pf-position-vault-cell--header pf-positions-cell--header">
                Vault
              </div>
              <div className="pf-positions-cell--right">Principal</div>
              <div className="pf-positions-cell--right">Value</div>
              <div className="pf-positions-cell--right">APY range</div>
              <div className="pf-positions-cell--right">Since</div>
            </div>
          ) : null}

          {showZeroShell ? (
            <div className={cn("pf-positions-row-grid", "pf-positions-row-grid--empty")}>
              <div className="pf-positions-empty-cell">
                <div className="pf-positions-empty-row">
                  <EmptySurface
                    variant="inline"
                    message="No active positions yet"
                    detail="Your first deposit will appear here once confirmed on-chain."
                    role="status"
                  />
                  <Link
                    href="/vaults"
                    className="body-xs ct-text-accent underline underline-offset-2 decoration-[var(--ct-border-soft)] hover:decoration-[var(--ct-accent)] transition-colors"
                    style={{ marginTop: "var(--ct-space-1_5)" }}
                  >
                    Explore available vaults →
                  </Link>
                </div>
              </div>
            </div>
          ) : null}

          {positions.map((p) => (
            <div
              key={p.id}
              className={cn("pf-positions-row-grid", "pf-positions-row-grid--body")}
            >
              {/* Vault name + status */}
              <div className="pf-position-vault-cell">
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
              <div className="tabular body-md pf-positions-cell--right ct-text-body">
                {formatUsdCompact(p.principalUsdc)}
              </div>

              {/* Current value */}
              <div className="tabular body-md ct-text-strong font-semibold pf-positions-cell--right">
                {formatUsdCompact(p.valueUsdc)}
              </div>

              {/* APY range — non-negotiable #1 */}
              <div className="pf-positions-cell--right">
                {p.apyLow !== null && p.apyHigh !== null ? (
                  <ApyRange
                    low={p.apyLow}
                    high={p.apyHigh}
                    precision={1}
                    className="body-sm font-semibold"
                  />
                ) : (
                  <span className="body-xs ct-text-faint">Unavailable</span>
                )}
              </div>

              {/* Subscribed date */}
              <div className="body-xs tabular ct-text-muted pf-positions-cell--right">
                {dateFmt.format(p.subscribedAt)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PfCockpitPanel>
  );
}
