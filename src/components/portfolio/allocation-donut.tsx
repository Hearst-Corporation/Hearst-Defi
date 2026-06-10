import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import type { PortfolioPosition } from "@/lib/data/portfolio";
import { formatUsdCompact } from "@/lib/format/usd-compact";

/**
 * Allocation donut — SVG arcs grouped by position status (active / matured /
 * exited). Canonical convention (r=15.9155 → C=100, dashArray `${pct} ${100-pct}`,
 * cumulative dashOffset). Strokes via `.dash-chart-circle.color-*` (charts-shared.css,
 * tokens only). Mirrors the dashboard donut pattern.
 */

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  matured: "Matured",
  exited: "Exited",
};

const STATUS_LEGEND_TONE: Record<string, "primary" | "accent" | "accent-raw"> = {
  active: "primary",
  matured: "accent",
  exited: "accent-raw",
};

interface AllocationDonutProps {
  positions: PortfolioPosition[];
  totalValueUsdc: number;
  source: "live" | "fallback";
}

export function AllocationDonut({
  positions,
  totalValueUsdc,
  source,
}: AllocationDonutProps) {
  const provenance = source === "fallback" ? "stale" : "live";

  // Group by status for the donut arcs.
  type StatusKey = "active" | "matured" | "exited";
  const grouped = new Map<StatusKey, number>();
  for (const p of positions) {
    grouped.set(p.status, (grouped.get(p.status) ?? 0) + p.valueUsdc);
  }

  // Canonical donut convention (r=15.9155 → C=100, pct maps 1:1 to dasharray):
  // dashArray = `${pct} ${100 - pct}`, dashOffset = -running cumulative.
  // Derived immutably so each arc starts where the previous ended.
  const segments: Array<{
    status: StatusKey;
    pct: number;
    valueUsdc: number;
    dashOffset: number;
  }> = [];

  let cumulative = 0;
  for (const [status, value] of grouped.entries()) {
    const pct = totalValueUsdc > 0 ? (value / totalValueUsdc) * 100 : 0;
    segments.push({ status, pct, valueUsdc: value, dashOffset: -cumulative });
    cumulative += pct;
  }

  const hasAllocation = totalValueUsdc > 0 && segments.length > 0;

  return (
    <article className="dash-cell dash-cell-premium" aria-label="Portfolio allocation">
      <div className="dash-label relative z-10">
        <span>Allocation by position status</span>
        <ProvenanceBadge kind={provenance} />
      </div>

      <div className="flex flex-col items-center gap-4 mt-2 relative z-10">
        <div className="dash-chart-container relative mt-0 w-(--ct-donut-size) h-(--ct-donut-size)">
          {!hasAllocation && (
            <div
              className="absolute inset-0 flex items-center justify-center rounded-full border border-dashed border-(--ct-border-soft) ct-surface-1 p-4 text-center"
              aria-label="No allocation data yet"
            >
              <span className="body-xs ct-text-muted">
                Allocation starts after the first active position.
              </span>
            </div>
          )}
          <svg
            className="dash-chart-svg w-full h-full"
            viewBox="0 0 42 42"
            role="img"
            aria-label="Allocation by status"
            aria-hidden={!hasAllocation}
          >
            <circle
              className="dash-chart-circle"
              cx="21"
              cy="21"
              r="15.9155"
              stroke="var(--ct-surface-3)"
              strokeDasharray="100 0"
            />
            {segments.map((s) => (
              <circle
                key={s.status}
                className={`dash-chart-circle color-${STATUS_LEGEND_TONE[s.status] ?? "muted"}`}
                cx="21"
                cy="21"
                r="15.9155"
                strokeDasharray={`${s.pct.toFixed(2)} ${(100 - s.pct).toFixed(2)}`}
                strokeDashoffset={s.dashOffset.toFixed(2)}
              />
            ))}
          </svg>
          {hasAllocation && (
            <div className="donut-center">
              <span className="donut-val">
                {formatUsdCompact(totalValueUsdc)}
              </span>
              <span className="donut-lbl">Portfolio</span>
            </div>
          )}
        </div>

        <div className="dash-legend w-full mt-0">
          {hasAllocation
            ? segments.map((s) => (
                <div key={s.status} className="dash-legend-row">
                  <span className="dash-legend-left">
                    <span
                      className={`dash-legend-dot dot-${STATUS_LEGEND_TONE[s.status] ?? "muted"}`}
                    />
                    {STATUS_LABELS[s.status] ?? s.status}
                  </span>
                  <span className="dash-legend-val">
                    {s.pct.toFixed(0)}% · {formatUsdCompact(s.valueUsdc)}
                  </span>
                </div>
              ))
            : null}
          {!hasAllocation && (
            <span className="dash-legend-left text-(--ct-text-muted)">
              No position allocation yet
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
