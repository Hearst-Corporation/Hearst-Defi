import { NestedPanel } from "@/components/ui/nested-panel";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Tooltip } from "@/components/ui/tooltip";
import { AwaitingMetricState } from "@/components/portfolio/awaiting-metric-state";
import { cn } from "@/lib/cn";
import { resolveProvenance } from "@/lib/portfolio/provenance";

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
  updatedAt?: Date;
  /** Render full risk shell at 0 (layout preview). */
  previewZeros?: boolean;
  /** Inside MergedSurface — parent supplies section label; no nested dash-cell. */
  embedded?: boolean;
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
      return "ct-status-success";
    case "Low–Moderate":
      return "ct-text-accent";
    case "Moderate":
      return "ct-status-warning";
    case "Elevated":
    case "High":
      return "ct-status-danger";
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
      colorClass: "ct-status-danger",
      ariaLabel: `rising +${delta}`,
    };
  }
  if (delta < 0) {
    return {
      icon: "▼",
      colorClass: "ct-status-success",
      ariaLabel: `falling ${delta}`,
    };
  }
  return {
    icon: "━━",
    colorClass: "ct-text-faint",
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
    <span className={cn("body-xs tabular font-medium", colorClass)}>
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
    <li role="group" aria-labelledby={rowId} className="pf-risk-row">
      <span id={rowId} className="body-sm min-w-0 truncate ct-text-muted">
        {label}
      </span>

      <span
        className="body-sm tabular font-semibold ct-text-primary text-right"
        aria-label={
          item.score > 0
            ? `${label} score ${String(item.score)} out of 100`
            : `${label} score not available`
        }
      >
        {item.score > 0 ? item.score : "N/A"}
      </span>

      {item.series30d !== undefined && item.series30d.length >= 2 ? (
        <Sparkline
          series={item.series30d}
          label={`${label} 30-day trend sparkline`}
        />
      ) : (
        <span aria-hidden />
      )}

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
    ? "pending"
    : trend === "rising"
      ? "▲ rising"
      : trend === "falling"
        ? "▼ falling"
        : "━━ stable";

  const ariaLabel = noData
    ? "Composite risk score not available, no data"
    : `Composite risk score ${String(composite)} out of 100, ${compositeLabel ?? "unknown"}, 30-day trend ${trend}`;

  const valueColor = noData
    ? "ct-text-faint"
    : compositeLabelColor(compositeLabel as CompositeLabel);

  const labelColor = noData
    ? "ct-text-faint"
    : compositeLabelColor(compositeLabel as CompositeLabel);

  return (
    <NestedPanel
      role="status"
      className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:py-4"
      aria-label={ariaLabel}
    >
      <div className="flex items-baseline gap-2 min-w-0">
        <span className="stat-label shrink-0">Composite</span>
        <span
          className={cn(
            "stat-value tabular leading-none",
            valueColor,
          )}
        >
          {noData ? "Awaiting" : composite}
          <span className="body-sm font-medium ct-text-faint">
            {noData ? "" : " / 100"}
          </span>
        </span>
      </div>

      <div className="flex flex-col items-start gap-1 min-w-0 sm:items-end sm:shrink-0">
        <span
          className={cn(
            "body-xs font-semibold ct-tracking-wide",
            labelColor,
          )}
        >
          {noData ? "Awaiting snapshot" : compositeLabel}
        </span>
        <span className="body-xs ct-text-faint">
          30d trend{" "}
          <span aria-hidden>{trendIcon}</span>
        </span>
      </div>
    </NestedPanel>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function RiskPulse({
  scores,
  composite,
  compositeLabel,
  composite30dTrend,
  source = "live",
  updatedAt,
  previewZeros = false,
  embedded = false,
}: RiskPulseProps) {
  // No-data: every sub-score is 0, composite is 0, and the loader did not
  // assign a label. Showing "Low" here would be a misleading positive signal
  // on an empty DB — render em-dashes instead.
  const noData =
    compositeLabel === undefined &&
    composite === 0 &&
    scores.every((s) => s.score === 0);

  // Per-dimension sub-scores are not yet persisted; a 0 means "not available",
  // not "low risk".
  const dimensionsAvailable = scores.some((s) => s.score > 0);

  // Use centralized provenance resolver
  const badgeKind = resolveProvenance(
    source === "stale" || noData || !dimensionsAvailable ? "stale" : source,
    updatedAt,
    "estimated", // Risk is always an estimation
  );

  // Layout preview at zero → awaiting surface only (no N/A rows or fake scores).
  if (previewZeros) {
    return (
      <AwaitingMetricState message="Risk scores will appear after the first snapshot." />
    );
  }

  // No snapshot yet → render a LIGHT empty surface, not a full dash-cell-premium
  // with header + Stale badge + placeholder (which reads as a big black box).
  // The outer section already labels this slot "Risk profile".
  if (noData) {
    return (
      <AwaitingMetricState message="Risk scores will appear after the first snapshot." />
    );
  }

  const body = (
    <>
      {!embedded ? (
        <div className="pf-widget-header relative z-10">
          <Tooltip content="Composite risk score based on market, mining, liquidity, smart contract, and counterparty risks">
            <h3 className="h3 cursor-help border-b border-dotted border-(--ct-border-soft)">
              Risk pulse
            </h3>
          </Tooltip>
          <ProvenanceBadge kind={badgeKind} />
        </div>
      ) : null}

      <ul className="relative z-10" aria-label="Risk dimension scores">
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

      <p className="mt-auto pt-4 body-xs italic leading-(--ct-leading-relaxed) relative z-10 opacity-70">
        Scores are 0–100 (higher = more risk). Composite is the weighted sum of
        the five dimensions per Methodology v1.0. Conditional projection — not
        guaranteed.
      </p>
    </>
  );

  if (embedded) {
    return (
      <div className="flex h-full flex-col" aria-label="Risk pulse">
        {body}
      </div>
    );
  }

  return (
    <article className="dash-cell dash-cell-premium h-full flex flex-col">
      {body}
    </article>
  );
}
