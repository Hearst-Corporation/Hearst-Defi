import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";

// ── Types ────────────────────────────────────────────────────────────────────

export interface RiskScore {
  dimension:
    | "market"
    | "mining"
    | "liquidity"
    | "smart_contract"
    | "counterparty";
  score: number; // 0–100
  delta30d: number; // can be negative
  series30d?: number[]; // optional 30-point sparkline
}

export type CompositeLabel =
  | "Low"
  | "Low–Moderate"
  | "Moderate"
  | "Elevated"
  | "High";

export interface RiskPulseProps {
  scores: RiskScore[]; // expects 5 entries
  composite: number; // 0–100
  /**
   * When all sub-scores are 0 and there is no underlying snapshot, the
   * loader passes `undefined` here — the UI renders an em-dash placeholder
   * instead of "Low", which would be a misleading positive signal on a
   * no-data state.
   */
  compositeLabel: CompositeLabel | undefined;
  composite30dTrend: "rising" | "stable" | "falling";
  /**
   * Provenance of the underlying snapshot. "stale" when no data backs the
   * scores — the header badge reflects this instead of a fixed "live".
   */
  source?: "live" | "stale";
}

// ── Helpers (exported for unit tests) ────────────────────────────────────────

const DIMENSION_LABEL: Record<RiskScore["dimension"], string> = {
  market: "Market",
  mining: "Mining",
  liquidity: "Liquidity",
  smart_contract: "Smart contract",
  counterparty: "Counterparty",
};

/** Map composite label → CSS token colour class for the composite value. */
export function compositeLabelColor(label: CompositeLabel): string {
  switch (label) {
    case "Low":
      return "text-[var(--ct-status-success)]";
    case "Low–Moderate":
      return "text-[var(--ct-accent)]";
    case "Moderate":
      return "text-[var(--ct-status-warning)]";
    case "Elevated":
    case "High":
      return "text-[var(--ct-status-danger)]";
  }
}

/**
 * Given a delta30d value, return the icon character and colour class.
 *
 * Risk semantics: rising risk (delta > 0) = bad → danger.
 *                 falling risk (delta < 0) = good → success.
 */
export function trendMeta(delta: number): {
  icon: string;
  colorClass: string;
  ariaLabel: string;
} {
  if (delta > 0) {
    return {
      icon: "▲",
      colorClass: "text-[var(--ct-status-danger)]",
      ariaLabel: `rising +${delta}`,
    };
  }
  if (delta < 0) {
    return {
      icon: "▼",
      colorClass: "text-[var(--ct-status-success)]",
      ariaLabel: `falling ${delta}`,
    };
  }
  return {
    icon: "━━",
    colorClass: "text-[var(--ct-text-faint)]",
    ariaLabel: "stable",
  };
}

/** Build a minimal inline SVG sparkline from a series of 0–100 values. */
export function buildSparklinePath(series: number[]): string {
  if (series.length < 2) return "";
  const w = 64;
  const h = 20;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const points = series.map((v, i) => {
    const x = (i / (series.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `M ${points.join(" L ")}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface TrendIndicatorProps {
  delta: number;
}

function TrendIndicator({ delta }: TrendIndicatorProps) {
  const { icon, colorClass, ariaLabel } = trendMeta(delta);
  const numericLabel =
    delta === 0
      ? "0"
      : delta > 0
        ? `+${String(delta)}`
        : String(delta);

  return (
    <span className={cn("tabular font-medium text-xs", colorClass)}>
      <span aria-hidden>{icon}</span>{" "}
      <span className="sr-only">{ariaLabel}</span>
      {numericLabel}
    </span>
  );
}

interface SparklineProps {
  series: number[];
  label: string;
}

function Sparkline({ series, label }: SparklineProps) {
  const d = buildSparklinePath(series);
  if (!d) return null;
  return (
    <svg
      width={64}
      height={20}
      aria-label={label}
      role="img"
      className="shrink-0"
      viewBox="0 0 64 20"
      fill="none"
    >
      <path
        d={d}
        stroke="var(--ct-text-faint)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface ScoreRowProps {
  item: RiskScore;
}

function ScoreRow({ item }: ScoreRowProps) {
  const label = DIMENSION_LABEL[item.dimension];
  const rowId = `risk-pulse-row-${item.dimension}`;

  return (
    <li
      role="group"
      aria-labelledby={rowId}
      className="flex items-center gap-3 py-2.5 ct-divide-soft"
    >
      {/* Dimension label */}
      <span
        id={rowId}
        className="body-sm min-w-[7.5rem] text-[var(--ct-text-muted)]"
      >
        {label}
      </span>

      {/* Score — em-dash when no real sub-score is stored (0 = not available) */}
      <span
        className="tabular font-semibold text-sm text-[var(--ct-text-primary)] w-7 text-right shrink-0"
        aria-label={
          item.score > 0
            ? `${label} score ${String(item.score)} out of 100`
            : `${label} score not available`
        }
      >
        {item.score > 0 ? item.score : "—"}
      </span>

      {/* Optional sparkline */}
      {item.series30d !== undefined && item.series30d.length >= 2 ? (
        <Sparkline
          series={item.series30d}
          label={`${label} 30-day trend sparkline`}
        />
      ) : (
        /* Placeholder gap so columns stay aligned when no sparkline */
        <span className="w-16 shrink-0" aria-hidden />
      )}

      {/* Delta / trend */}
      <TrendIndicator delta={item.delta30d} />
    </li>
  );
}

interface CompositeSectionProps {
  composite: number;
  compositeLabel: CompositeLabel | undefined;
  trend: RiskPulseProps["composite30dTrend"];
  noData: boolean;
}

function CompositeSection({
  composite,
  compositeLabel,
  trend,
  noData,
}: CompositeSectionProps) {
  const trendIcon = noData
    ? "—"
    : trend === "rising"
      ? "▲ rising"
      : trend === "falling"
        ? "▼ falling"
        : "━━ stable";

  const ariaLabel = noData
    ? "Composite risk score not available, no data"
    : `Composite risk score ${String(composite)} out of 100, ${compositeLabel ?? "unknown"}, 30-day trend ${trend}`;

  const valueColor = noData
    ? "text-[var(--ct-text-faint)]"
    : compositeLabelColor(compositeLabel as CompositeLabel);

  const labelColor = noData
    ? "text-[var(--ct-text-faint)]"
    : compositeLabelColor(compositeLabel as CompositeLabel);

  return (
    <div
      role="status"
      aria-label={ariaLabel}
      className="mt-5 flex items-center justify-between rounded-[var(--ct-radius-lg)] border border-[var(--ct-border-soft)] bg-[var(--ct-surface-1)] px-4 py-4"
    >
      <div className="flex items-baseline gap-2">
        <span aria-hidden className="text-[var(--ct-accent)] text-lg leading-none">
          ◆
        </span>
        <span className="stat-label">Composite</span>
        <span
          className={cn(
            "tabular font-extrabold text-xl leading-none",
            valueColor,
          )}
        >
          {noData ? "—" : composite}
          <span className="text-sm font-medium text-[var(--ct-text-faint)]">
            {" "}/ 100
          </span>
        </span>
      </div>

      <div className="flex flex-col items-end gap-1">
        <span
          className={cn(
            "text-xs font-semibold tracking-wide",
            labelColor,
          )}
        >
          {noData ? "—" : compositeLabel}
        </span>
        <span className="text-xs text-[var(--ct-text-faint)]">
          30d trend{" "}
          <span aria-hidden>{trendIcon}</span>
        </span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function RiskPulse({
  scores,
  composite,
  compositeLabel,
  composite30dTrend,
  source = "live",
}: RiskPulseProps) {
  // No-data: every sub-score is 0, composite is 0, and the loader did not
  // assign a label. Showing "Low" here would be a misleading positive signal
  // on an empty DB — render em-dashes instead.
  const noData =
    compositeLabel === undefined &&
    composite === 0 &&
    scores.every((s) => s.score === 0);

  // Per-dimension sub-scores are not yet persisted; a 0 means "not available",
  // not "low risk". The badge is only "live" when the snapshot is live AND at
  // least one real sub-score exists — otherwise "stale".
  const dimensionsAvailable = scores.some((s) => s.score > 0);
  const badgeKind: "live" | "stale" =
    source === "stale" || noData || !dimensionsAvailable ? "stale" : "live";

  return (
    <article className="dash-cell dash-cell-premium h-full flex flex-col">
      <div className="dash-label relative z-10">
        <span className="font-semibold text-[var(--ct-text-strong)]">Risk Pulse</span>
        <ProvenanceBadge kind={badgeKind} />
      </div>

      <ul className="ct-divide-soft relative z-10" aria-label="Risk dimension scores">
        {scores.map((item) => (
          <ScoreRow key={item.dimension} item={item} />
        ))}
      </ul>

      <CompositeSection
        composite={composite}
        compositeLabel={compositeLabel}
        trend={composite30dTrend}
        noData={noData}
      />

      <p className="mt-auto pt-4 body-xs italic leading-[var(--ct-leading-relaxed)] relative z-10 opacity-70">
        Scores are 0–100 (higher = more risk). Composite is the weighted sum of
        the five dimensions per Methodology v1.0. Conditional projection — not
        guaranteed.
      </p>
    </article>
  );
}
