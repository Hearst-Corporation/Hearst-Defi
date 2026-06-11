import Link from "next/link";

import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { ApyRange } from "@/components/ui/apy-range";
import type { PortfolioPosition } from "@/lib/data/portfolio";
import { formatUsdCompact } from "@/lib/format/usd-compact";
import { cn } from "@/lib/cn";
import { resolveProvenance } from "@/lib/data/portfolio";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const STATUS_DOT: Record<string, string> = {
  active: "var(--ct-text-strong)",
  matured: "var(--ct-surface-3)",
  exited: "var(--ct-accent-strong)",
};

/**
 * Structural constraint (not a spacing token): the 5-column table needs a hard
 * minimum width so columns never collapse into each other; below it the parent
 * `overflow-x-auto` scrolls. `36rem` is a render floor, not a design-scale value,
 * so it is an intentional arbitrary value shared by the header and data rows.
 */
const ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] gap-4 pb-2 border-b border-(--ct-border-soft) min-w-[36rem]";

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

  return (
    <article className="dash-cell" aria-label="Open positions">
      <div className="dash-label">
        <span>Positions</span>
        <span className="dash-label-meta">
          <ProvenanceBadge kind={provenance} />
          <span className="dash-trend flat">{positions.length} position{positions.length !== 1 ? "s" : ""}</span>
        </span>
      </div>

      {positions.length === 0 ? (
        <p className="body-sm ct-text-muted mt-4">
          No open positions.
        </p>
      ) : (
        <div className="flex flex-col gap-2 mt-3 overflow-x-auto min-w-0">
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
                  className="w-2 h-2 shrink-0 rounded-full"
                  style={{
                    background: STATUS_DOT[p.status] ?? "var(--ct-text-muted)",
                  }}
                />
                <Link
                  href={`/portfolio/${p.id}`}
                  className="body-md ct-text-primary min-w-0 truncate underline-offset-4 hover:underline"
                  aria-label={`Open details for ${p.vaultName}`}
                >
                  {p.vaultName}
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
                <ApyRange low={p.apyLow} high={p.apyHigh} precision={1} />
              </div>

              {/* Subscribed date */}
              <span className="body-xs tabular ct-text-muted text-right">
                {dateFmt.format(p.subscribedAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
