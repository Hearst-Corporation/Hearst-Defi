import type { PortfolioPosition } from "@/lib/data/portfolio";
import { formatUsdCompact } from "@/lib/format/usd-compact";

import { ProvenanceBadge } from "./provenance-badge";

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  matured: "Matured",
  exited: "Exited",
};

const STATUS_COLORS: Record<string, string> = {
  active: "var(--ct-text-primary)",
  matured: "var(--ct-accent-strong)",
  exited: "var(--ct-text-muted)",
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

  type StatusKey = "active" | "matured" | "exited";
  const grouped = new Map<StatusKey, number>();
  for (const p of positions) {
    grouped.set(p.status, (grouped.get(p.status) ?? 0) + p.valueUsdc);
  }

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

  return (
    <article 
      className="flex flex-col relative flex-1 h-full min-h-[200px] p-6 overflow-hidden" 
      style={{
        background: "color-mix(in srgb, var(--ct-surface-1) 20%, transparent)",
        backdropFilter: "blur(24px)",
        borderRadius: "var(--ct-radius-xl)",
        border: "1px solid color-mix(in srgb, var(--ct-border-soft) 50%, transparent)",
      }}
      aria-label="Portfolio allocation"
    >
      <div className="flex justify-between items-center text-micro font-medium text-(--ct-text-muted) tracking-widest uppercase mb-6 relative z-10">
        <span>Allocation by status</span>
        <ProvenanceBadge kind={provenance} />
      </div>

      <div className="flex flex-col items-center gap-4 mt-2 relative z-10">
        <div className="relative w-48 h-48 flex items-center justify-center my-2">
          <svg
            className="absolute inset-0 w-full h-full -rotate-90"
            viewBox="0 0 42 42"
            role="img"
            aria-label="Allocation by status"
          >
            <circle
              cx="21"
              cy="21"
              r="15.9155"
              stroke="var(--ct-surface-3)"
              fill="transparent"
              strokeWidth="3.5"
              strokeDasharray="100 0"
            />
            {segments.map((s) => (
              <circle
                key={s.status}
                cx="21"
                cy="21"
                r="15.9155"
                fill="transparent"
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke={STATUS_COLORS[s.status] ?? "var(--ct-text-muted)"}
                strokeDasharray={`${s.pct.toFixed(2)} ${(100 - s.pct).toFixed(2)}`}
                strokeDashoffset={s.dashOffset.toFixed(2)}
                className="transition-all duration-500 ease-in-out"
              />
            ))}
          </svg>
          <div className="flex flex-col items-center justify-center text-center z-10">
            <span className="text-3xl font-light text-(--ct-text-strong) tabular-nums">
              {totalValueUsdc > 0 ? formatUsdCompact(totalValueUsdc) : <span className="opacity-30">—</span>}
            </span>
            <span className="text-xs text-(--ct-text-muted) uppercase tracking-widest mt-1">Portfolio</span>
          </div>
        </div>

        <div className="w-full flex flex-col gap-2 mt-2">
          {segments.map((s) => (
            <div key={s.status} className="flex justify-between items-center text-sm">
              <span className="flex items-center gap-2 text-(--ct-text-primary)">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: STATUS_COLORS[s.status] ?? "var(--ct-text-muted)" }}
                />
                {STATUS_LABELS[s.status] ?? s.status}
              </span>
              <span className="text-(--ct-text-strong) tabular-nums mono text-xs">
                {s.pct.toFixed(0)}% <span className="text-(--ct-text-muted) opacity-50">·</span> {formatUsdCompact(s.valueUsdc)}
              </span>
            </div>
          ))}
          {segments.length === 0 && (
            <span className="text-sm text-(--ct-text-muted) italic">
              No positions
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
