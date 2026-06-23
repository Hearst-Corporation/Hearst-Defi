import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import Link from "next/link";

import { ApyRange } from "@/components/ui/apy-range";
import type { PortfolioPosition } from "@/lib/data/portfolio";
import { formatUsdCompact } from "@/lib/vaults/product-display";
import { cn } from "@/lib/cn";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import { PortfolioLeafLink } from "@/components/portfolio/portfolio-leaf-link";
import {
  PfCockpitPanel,
} from "@/components/portfolio/pf-cockpit-panel";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const STATUS_DOT: Record<string, string> = {
  active: "pf-status-dot--active",
  matured: "pf-status-dot--matured",
  exited: "pf-status-dot--exited",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  matured: "Matured",
  exited: "Exited",
};

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
  const totalPortfolioValue = positions.reduce((sum, pos) => sum + pos.valueUsdc, 0);

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
        <DashboardPanelHeader
          title="Positions"
          tone="primary"
          trailing={trailing}
        />
        {/* Zero-state skeleton — the ledger frame with muted placeholder rows.
           Fills in with real positions as soon as the first one is confirmed. */}
        <div className="pf-positions-empty">
          <span className="pf-positions-empty__lead">No active positions</span>
          <span className="pf-positions-empty__hint ct-text-muted">
            Your portfolio will display your active vault subscriptions here.
          </span>
        </div>
      </PfCockpitPanel>
    );
  }

  if (embedded) {
    return (
      <PfCockpitPanel
        variant="table"
        chrome="embedded"
        aria-label="Open positions"
      >
        <DashboardPanelHeader
          title="Positions"
          tone="primary"
          provenance={provenance}
          trailing={trailing}
        />
        <div className="pf-positions-summary">
          {positions.map((p) => {
            const sharePct = totalPortfolioValue > 0 ? (p.valueUsdc / totalPortfolioValue) * 100 : 0;

            return (
              <article key={p.id} className="pf-position-summary">
                <div className="pf-position-summary__main">
                  <div className="pf-position-summary__identity">
                    <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-ct-surface-2 border border-ct-border-base">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 ct-text-secondary">
                        <path d="M3 21h18M3 10h18M5 10V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3M7 21v-4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4" />
                      </svg>
                      <span
                        className={cn("absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-ct-surface-1", STATUS_DOT[p.status] ?? "pf-status-dot--default")}
                        aria-hidden
                      />
                    </div>
                    <div className="pf-position-summary__copy">
                      <Link
                        href={`/portfolio/${p.id}`}
                        className="pf-position-summary__vault-link body-md ct-text-primary min-w-0 truncate underline-offset-4 hover:underline font-semibold flex items-center gap-1.5 group"
                        aria-label={`Open details for ${p.vaultName ?? "unassigned vault"}`}
                      >
                        <span>{p.vaultName ?? "Unassigned vault"}</span>
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
                        >
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </Link>
                      <span className="pf-position-summary__status">
                        {STATUS_LABEL[p.status] ?? "Position"} position
                      </span>
                    </div>
                  </div>
                  <dl className="pf-position-summary__meta">
                    <div className="pf-position-summary__meta-item">
                      <dt>Principal</dt>
                      <dd>{formatUsdCompact(p.principalUsdc)}</dd>
                    </div>
                    <div className="pf-position-summary__meta-item">
                      <dt>APY</dt>
                      <dd>
                        {p.apyLow !== null && p.apyHigh !== null ? (
                          <ApyRange low={p.apyLow} high={p.apyHigh} precision={1} className="body-sm font-semibold" />
                        ) : (
                          <span className="body-xs ct-text-tertiary">Unavailable</span>
                        )}
                      </dd>
                    </div>
                    <div className="pf-position-summary__meta-item">
                      <dt>Since</dt>
                      <dd>{dateFmt.format(p.subscribedAt)}</dd>
                    </div>
                  </dl>
                </div>
                <div className="pf-position-summary__aside">
                  <span className="pf-position-summary__value-label">Current value</span>
                  <span className="pf-position-summary__value">{formatUsdCompact(p.valueUsdc)}</span>
                  <span className="pf-position-summary__share">{sharePct.toFixed(1)}% of portfolio</span>
                </div>
              </article>
            );
          })}
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
      <DashboardPanelHeader
        title="Positions"
        tone="primary"
        provenance={provenance}
        trailing={trailing}
      />
      <div className="pf-positions">
        <div className="pf-positions__row pf-positions__row--head stat-label uppercase tracking-widest">
          <span>Vault</span>
          <span className="pf-positions__num">Principal</span>
          <span className="pf-positions__num">Value</span>
          <span className="pf-positions__num">Share</span>
          <span className="pf-positions__num">APY range</span>
          <span className="pf-positions__num">Since</span>
        </div>

        {positions.map((p) => {
          const sharePct = totalPortfolioValue > 0 ? (p.valueUsdc / totalPortfolioValue) * 100 : 0;

          return (
            <div key={p.id} className="pf-positions__row pf-positions__row--body group/row">
              <span className="pf-positions__vault">
                <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-ct-surface-2 border border-ct-border-base group-hover/row:border-ct-accent/30 transition-colors">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 ct-text-secondary group-hover/row:ct-text-accent transition-colors">
                    <path d="M3 21h18M3 10h18M5 10V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3M7 21v-4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4" />
                  </svg>
                  <span
                    className={cn("absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-ct-surface-1", STATUS_DOT[p.status] ?? "pf-status-dot--default")}
                    aria-hidden
                  />
                </div>
                <div className="pf-positions__vault-copy">
                  <Link
                    href={`/portfolio/${p.id}`}
                    className="pf-positions__vault-link body-md ct-text-primary min-w-0 truncate underline-offset-4 hover:underline font-semibold flex items-center gap-1.5 group"
                    aria-label={`Open details for ${p.vaultName ?? "unassigned vault"}`}
                  >
                    <span>{p.vaultName ?? "Unassigned vault"}</span>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
                    >
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </span>

              <span className="pf-positions__num tabular body-md ct-text-body font-mono">
                {formatUsdCompact(p.principalUsdc)}
              </span>

              <span className="pf-positions__num tabular body-md ct-text-strong font-mono font-bold">
                {formatUsdCompact(p.valueUsdc)}
              </span>

              <span className="pf-positions__num tabular body-sm ct-text-secondary font-mono">
                {sharePct.toFixed(1)}%
              </span>

              <span className="pf-positions__num">
                {p.apyLow !== null && p.apyHigh !== null ? (
                  <ApyRange low={p.apyLow} high={p.apyHigh} precision={1} className="body-sm font-mono font-semibold" />
                ) : (
                  <span className="body-xs ct-text-tertiary">Unavailable</span>
                )}
              </span>

              <span className="pf-positions__num tabular body-sm ct-text-muted font-mono">
                {dateFmt.format(p.subscribedAt)}
              </span>
            </div>
          );
        })}
      </div>
    </PfCockpitPanel>
  );
}
