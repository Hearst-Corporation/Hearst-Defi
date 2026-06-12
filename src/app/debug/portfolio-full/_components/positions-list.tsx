import type { PortfolioPosition } from "@/lib/data/portfolio";
import { formatUsdCompact } from "@/lib/format/usd-compact";

import { ApyRange } from "./apy-range";
import { ProvenanceBadge } from "./provenance-badge";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const STATUS_DOT: Record<string, string> = {
  active: "var(--ct-text-strong)",
  matured: "var(--ct-surface-3)",
  exited: "var(--ct-text-muted)",
};

interface PositionsListProps {
  positions: PortfolioPosition[];
  source: "live" | "fallback";
}

export function PositionsList({ positions, source }: PositionsListProps) {
  const provenance = source === "fallback" ? "stale" : "live";

  return (
    <article 
      className="ct-kpi-glass flex flex-col relative flex-1 h-full min-h-48 p-6 overflow-hidden" 
      aria-label="Open positions"
    >
      <div className="flex justify-between items-center stat-label mb-6 shrink-0 relative z-10">
        <span>Positions</span>
        <div className="flex items-center gap-2">
          <ProvenanceBadge kind={provenance} />
          <span className="stat-label mono px-1.5 py-0.5 rounded-xs bg-(--ct-surface-2) text-(--ct-text-primary)">
            {positions.length} position{positions.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto overflow-y-auto flex-1 relative z-10">
        {positions.length === 0 ? (
          <p className="body-sm text-(--ct-text-muted) mt-2 italic">No open positions.</p>
        ) : (
          <div className="flex flex-col min-w-150 gap-2">
            <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4 pb-2 border-b border-(--ct-border-soft) stat-label">
              <span>Vault</span>
              <span className="text-right">Principal</span>
              <span className="text-right">Value</span>
              <span className="text-right">Target APY</span>
              <span className="text-right">Since</span>
            </div>

            <div className="flex flex-col gap-0.5 mt-1">
              {positions.map((p) => (
                <div
                  key={p.id}
                  className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4 items-center py-2 border-b border-(--ct-border-soft) last:border-0 hover:bg-(--ct-surface-2) -mx-2 px-2 rounded-sm transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-1.5 h-1.5 shrink-0 rounded-full"
                      style={{
                        background: STATUS_DOT[p.status] ?? "var(--ct-text-muted)",
                      }}
                    />
                    <span className="body-sm text-(--ct-text-primary) font-medium truncate">
                      {p.vaultName ?? "Unassigned vault"}
                    </span>
                  </div>

                  <span className="tabular-nums body-sm text-right text-(--ct-text-body) mono">
                    {formatUsdCompact(p.principalUsdc)}
                  </span>

                  <span className="tabular-nums body-sm text-(--ct-text-strong) font-semibold text-right mono">
                    {formatUsdCompact(p.valueUsdc)}
                  </span>

                  <div className="text-right body-sm mono">
                    {p.apyLow !== null && p.apyHigh !== null ? (
                      <ApyRange low={p.apyLow} high={p.apyHigh} precision={1} />
                    ) : (
                      <span className="body-xs text-(--ct-text-muted)">Unavailable</span>
                    )}
                  </div>

                  <span className="body-xs tabular-nums text-(--ct-text-muted) text-right mono">
                    {dateFmt.format(p.subscribedAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
