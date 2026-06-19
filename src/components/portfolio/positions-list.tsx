import Link from "next/link";

import { ApyRange } from "@/components/ui/apy-range";
import type { PortfolioPosition } from "@/lib/data/portfolio";
import { formatUsdCompact } from "@/lib/vaults/product-display";
import { cn } from "@/lib/cn";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import { resolveWidgetView } from "@/lib/portfolio/view-state";
import { PortfolioLeafLink } from "@/components/portfolio/portfolio-leaf-link";
import { WidgetShell } from "@/components/portfolio/widget-shell";

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

interface PositionsListProps {
  positions: PortfolioPosition[];
  source: "live" | "fallback";
  updatedAt?: Date;
  previewZeros?: boolean;
  leafHref?: string;
}

/**
 * Positions — recoded from scratch as a clean ledger table.
 * Header row + one row per position: vault (status dot + link), principal,
 * current value (bright), APY range (#1), since. Honest left-aligned zero-state.
 * Provenance via WidgetShell header (#2).
 */
export function PositionsList({
  positions,
  source,
  updatedAt,
  previewZeros = false,
  leafHref,
}: PositionsListProps) {
  const view = resolveWidgetView({
    previewZeros,
    hasData: positions.length > 0,
    provenance: resolveProvenance(source, updatedAt),
  });

  const trailing = leafHref ? (
    <PortfolioLeafLink href={leafHref} />
  ) : view.mode !== "zero" ? (
    <span className="body-xs ct-text-faint tabular">
      {positions.length} position{positions.length !== 1 ? "s" : ""}
    </span>
  ) : undefined;

  const zeroSlot = (
    <div className="pf-positions-empty">
      <p className="pf-positions-empty__lead body-sm ct-text-muted m-0">
        No active positions yet
      </p>
      <p className="pf-positions-empty__hint body-xs ct-text-faint m-0">
        Your first deposit will appear here once confirmed on-chain.
      </p>
      <Link href="/vaults" className="pf-positions-empty-link">
        Explore available vaults →
      </Link>
    </div>
  );

  const liveContent = (
    <div className="pf-positions">
      <div className="pf-positions__row pf-positions__row--head stat-label">
        <span>Vault</span>
        <span className="pf-positions__num">Principal</span>
        <span className="pf-positions__num">Value</span>
        <span className="pf-positions__num">APY range</span>
        <span className="pf-positions__num">Since</span>
      </div>

      {positions.map((p) => (
        <div key={p.id} className="pf-positions__row pf-positions__row--body">
          <span className="pf-positions__vault">
            <span
              className={cn("pf-status-dot", STATUS_DOT[p.status] ?? "pf-status-dot--default")}
              aria-hidden
            />
            <Link
              href={`/portfolio/${p.id}`}
              className="body-md ct-text-primary min-w-0 truncate underline-offset-4 hover:underline"
              aria-label={`Open details for ${p.vaultName ?? "unassigned vault"}`}
            >
              {p.vaultName ?? "Unassigned vault"}
            </Link>
          </span>

          <span className="pf-positions__num tabular body-md ct-text-body">
            {formatUsdCompact(p.principalUsdc)}
          </span>

          <span className="pf-positions__num tabular body-md ct-text-strong font-semibold">
            {formatUsdCompact(p.valueUsdc)}
          </span>

          <span className="pf-positions__num">
            {p.apyLow !== null && p.apyHigh !== null ? (
              <ApyRange low={p.apyLow} high={p.apyHigh} precision={1} className="body-sm font-semibold" />
            ) : (
              <span className="body-xs ct-text-faint">Unavailable</span>
            )}
          </span>

          <span className="pf-positions__num body-xs tabular ct-text-muted">
            {dateFmt.format(p.subscribedAt)}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <WidgetShell
      variant="table"
      ariaLabel="Open positions"
      title="Positions"
      view={view}
      trailing={trailing}
      zeroSlot={zeroSlot}
    >
      {liveContent}
    </WidgetShell>
  );
}
