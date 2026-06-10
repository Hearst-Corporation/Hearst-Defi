import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ChartProvenanceCorner } from "@/components/ui/chart-provenance-corner";
import { cn } from "@/lib/cn";
import type {
  RiskBand,
  RiskDimension,
  RiskFrameworkData,
  RiskSeverity,
} from "@/lib/data/risk-framework";

// ── View prop ────────────────────────────────────────────────────────────────

export type RiskFrameworkView = "bars" | "waterfall";

interface RiskFrameworkSectionProps {
  data: RiskFrameworkData;
  /** @default "waterfall" */
  view?: RiskFrameworkView;
}

// ── Severity / band maps ─────────────────────────────────────────────────────

const SEVERITY_TEXT: Record<RiskSeverity, string> = {
  low: "ct-status-glow-success",
  medium: "ct-status-glow-warning",
  high: "ct-status-glow-danger",
};

const SEVERITY_BAR: Record<RiskSeverity, string> = {
  low: "ct-status-dot-success",
  medium: "ct-status-dot-warning",
  high: "ct-status-dot-danger",
};

const SEVERITY_DOT_CLASS: Record<RiskSeverity, string> = {
  low: "ct-status-dot-success",
  medium: "ct-status-dot-warning",
  high: "ct-status-dot-danger",
};

const SEVERITY_VARIANT: Record<
  RiskSeverity,
  "success" | "warning" | "danger"
> = {
  low: "success",
  medium: "warning",
  high: "danger",
};

const BAND_VARIANT: Record<RiskBand, "success" | "warning" | "danger"> = {
  low: "success",
  medium: "warning",
  high: "danger",
};

const BAND_TEXT: Record<RiskBand, string> = {
  low: "ct-status-glow-success",
  medium: "ct-status-glow-warning",
  high: "ct-status-glow-danger",
};

const BAND_BAR: Record<RiskBand, string> = {
  low: "ct-status-dot-success",
  medium: "ct-status-dot-warning",
  high: "ct-status-dot-danger",
};

// ── Provenance mapping ───────────────────────────────────────────────────────

function provenanceFromSource(
  source: RiskFrameworkData["source"],
): import("@/components/ui/provenance-badge").Provenance {
  switch (source) {
    case "db":
      return "live";
    case "partial":
      return "partial";
    case "fallback":
      return "estimated";
  }
}

// ── Public export ────────────────────────────────────────────────────────────

export function RiskFrameworkSection({
  data,
  view = "waterfall",
}: RiskFrameworkSectionProps) {
  // Honesty rule: when zero real inputs reached the loader (no VaultSnapshot,
  // no MiningMetric), the engine still produces a number from baked fallback
  // constants — but those numbers do not describe anything real and would
  // mislead the operator. Render an empty state instead.
  if (data.source === "fallback") {
    return (
      <article className="dash-cell dash-cell-premium h-full flex flex-col relative">
        <ChartProvenanceCorner kind={provenanceFromSource(data.source)} />
        <div className="dash-label relative z-10">
          <span className="text-micro font-bold uppercase tracking-widest text-[var(--ct-text-muted)]">
            Risk Framework
          </span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center py-12 relative z-10">
          <p className="body-sm text-[var(--ct-text-muted)]">
            No risk inputs yet
          </p>
          <p className="body-xs text-[var(--ct-text-faint)] max-w-xs">
            The framework will populate after the first vault snapshot and
            mining metric are recorded.
          </p>
        </div>
      </article>
    );
  }

  return (
    <article className="dash-cell dash-cell-premium h-full flex flex-col relative">
      <ChartProvenanceCorner kind={provenanceFromSource(data.source)} />
      <div className="dash-label relative z-10">
        <span className="text-micro font-bold uppercase tracking-widest text-[var(--ct-text-muted)]">Risk Framework</span>
      </div>

      <div className="flex-1 flex flex-col mt-6 relative z-10">
        <CompositeHeader
          composite={data.composite}
          band={data.band}
          bandLabel={data.bandLabel}
        />

        {view === "waterfall" ? (
          <WaterfallChart data={data} />
        ) : (
          <ul className="mt-6 ct-divide-soft">
            {data.dimensions.map((d) => (
              <li key={d.id}>
                <RiskRow dimension={d} />
              </li>
            ))}
          </ul>
        )}

        <p
          className="mt-auto pt-6 body-xs text-[var(--ct-text-faint)] italic leading-[var(--ct-leading-relaxed)] opacity-70"
          title="Uses pre-audit baseline assumptions"
        >
          Composite score is the weighted sum of the five dimensions defined in
          Methodology v1.0. Smart-contract and counterparty dimensions use
          pre-audit baseline assumptions, and the volatility input is a fixed
          proxy. Conditional projection — not guaranteed.
        </p>
      </div>
    </article>
  );
}

// ── Composite header (shared by both views) ──────────────────────────────────

interface CompositeHeaderProps {
  composite: number;
  band: RiskBand;
  bandLabel: string;
}

function CompositeHeader({ composite, band, bandLabel }: CompositeHeaderProps) {
  return (
    <div className="flex flex-col gap-4 rounded-xl bg-[var(--ct-bg-deep)]/50 border border-[var(--ct-border-soft)]/50 px-5 py-5 sm:flex-row sm:items-center sm:justify-between relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--ct-accent)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      <div className="flex items-baseline gap-3 relative z-10">
        <span className="text-micro font-bold uppercase tracking-widest text-[var(--ct-text-muted)]">Composite</span>
        <span className={cn("text-3xl font-light tracking-tighter tabular-nums", BAND_TEXT[band])}>
          {composite}
          <span className="text-sm font-medium opacity-50 ml-1 text-[var(--ct-text-faint)]">/ 100</span>
        </span>
      </div>
      <div className="flex items-center gap-4 sm:min-w-60 relative z-10">
        <div className="flex-1 h-1.5 bg-[var(--ct-bg-deep)] rounded-full overflow-hidden border border-[var(--ct-border-soft)]">
          <div 
            className={cn("h-full transition-all duration-1000 ease-out", BAND_BAR[band])}
            style={{ width: `${composite}%`, boxShadow: "0 0 12px var(--ct-accent-glow)" }}
          />
        </div>
        <Badge variant={BAND_VARIANT[band]} className="font-bold tracking-wider">{bandLabel}</Badge>
      </div>
    </div>
  );
}

// ── Waterfall chart ───────────────────────────────────────────────────────────
//
// ViewBox: 300 × 140.
// Layout:
//   - Left axis labels: x=0–28, text-anchor=end
//   - Chart area: x=32 … 300
//   - Baseline bar starts at y=100 (score 100 at y=8, score 0 at y=108)
//   - Each step bar drops by `contribution` units
//   - Final composite bar uses ct-warning
//
// Colour convention (all tokens, no hex):
//   baseline           → var(--ct-surface-3)
//   negative contrib   → var(--ct-status-danger)
//   positive contrib   → var(--ct-accent)
//   final composite    → var(--ct-warning)   (medium band)
//   connector dashed   → var(--ct-border-soft)

// SVG geometry constants
const VB_W = 300;
const VB_H = 140;
const CHART_LEFT = 36; // x where bars start (after y-axis labels)
const CHART_RIGHT = 290; // x where bars end
const CHART_TOP = 8; // y for score=100
const CHART_BOTTOM = 108; // y for score=0
const CHART_H = CHART_BOTTOM - CHART_TOP; // 100px = 1px per risk point

/** Convert a risk score (0–100) to an SVG y coordinate. */
function scoreToY(score: number): number {
  return CHART_TOP + (1 - score / 100) * CHART_H;
}

export interface WaterfallStep {
  key: string;
  label: string;
  /** Abbreviated label for x-axis tick. */
  tick: string;
  /** Top y of this bar segment. */
  y1: number;
  /** Bottom y of this bar segment (y1 < y2 because SVG y increases downward). */
  y2: number;
  /** Fill colour token expression (already a CSS var() string). */
  fill: string;
  /** Score value displayed in tooltip. */
  score: number;
  /** Short description for tooltip. */
  detail: string;
  /** Whether this is the final composite bar. */
  isFinal?: boolean;
}

interface WaterfallChartProps {
  data: RiskFrameworkData;
}

// Abbreviated tick labels for x axis (max 6 chars to fit in narrow columns)
const TICK_ABBREV: Partial<Record<string, string>> = {
  smart_contract: "Cntrct",
  mining: "Mining",
  counterparty: "Cntrp",
  market: "Market",
  liquidity: "Liquid",
};

/** Exported for unit-testing only. Do not use in application code. */
export function buildWaterfallSteps(data: RiskFrameworkData): WaterfallStep[] {
  return buildSteps(data);
}

function buildSteps(data: RiskFrameworkData): WaterfallStep[] {
  const steps: WaterfallStep[] = [];

  // Baseline bar: from 100 down to 100 (full height, no contribution yet)
  // We show it as a solid bar from score=100 to score=100, so it's really just
  // the "ceiling" marker. We make it a thin bar from 100→100 representing the
  // starting score. The first real bar starts at 100 and gets eroded.
  let runningScore = 100;

  // Baseline
  steps.push({
    key: "baseline",
    label: "Baseline",
    tick: "Base",
    y1: scoreToY(100),
    y2: CHART_BOTTOM,
    fill: "var(--ct-surface-3)",
    score: 100,
    detail: "Perfect score baseline",
  });

  // Each dimension erodes the running score
  for (const dim of data.dimensions) {
    const contribution = Math.min(dim.score, runningScore);
    const prevScore = runningScore;
    runningScore = Math.max(0, runningScore - contribution);

    const isPositive = contribution < 0; // rare upward adjustment
    const fill = isPositive
      ? "var(--ct-accent)"
      : "var(--ct-status-danger)";

    steps.push({
      key: dim.id,
      label: dim.label,
      tick: TICK_ABBREV[dim.id] ?? dim.label.slice(0, 6),
      y1: scoreToY(prevScore),
      y2: scoreToY(runningScore),
      fill,
      score: dim.score,
      detail: dim.detail,
    });
  }

  // Final composite bar
  steps.push({
    key: "composite",
    label: "Composite",
    tick: "=",
    y1: scoreToY(data.composite),
    y2: CHART_BOTTOM,
    fill: "var(--ct-warning)",
    score: data.composite,
    detail: `${data.bandLabel} risk band`,
    isFinal: true,
  });

  return steps;
}

function WaterfallChart({ data }: WaterfallChartProps) {
  const steps = buildSteps(data);
  const n = steps.length; // baseline + 5 dims + composite = 7
  const colW = (CHART_RIGHT - CHART_LEFT) / n;
  const barW = Math.max(colW * 0.55, 8);
  const barOffset = (colW - barW) / 2;

  // Y-axis grid lines at 0, 20, 40, 60, 80, 100
  const yGridLines = [0, 20, 40, 60, 80, 100];

  return (
    <div className="mt-6 overflow-x-auto">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full"
        style={{ minWidth: "240px", height: "auto" }}
        role="img"
        aria-label={`Risk attribution waterfall chart. Composite score: ${data.composite} — ${data.bandLabel}`}
      >
        {/* ── Y-axis grid lines ── */}
        {yGridLines.map((score) => {
          const y = scoreToY(score);
          return (
            <g key={`grid-${score}`}>
              <line
                x1={CHART_LEFT}
                x2={CHART_RIGHT}
                y1={y}
                y2={y}
                stroke="var(--ct-border-soft)"
                strokeWidth="0.4"
                strokeDasharray={score === 0 ? "none" : "1.5,2"}
              />
              <text
                x={CHART_LEFT - 3}
                y={y + 1}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="4.5"
                fill="var(--ct-text-muted)"
                fontFamily="var(--font-mono, monospace)"
              >
                {score}
              </text>
            </g>
          );
        })}

        {/* ── Bars + connectors ── */}
        {steps.map((step, i) => {
          const cx = CHART_LEFT + i * colW;
          const bx = cx + barOffset;
          const barH = Math.max(step.y2 - step.y1, 1);

          // Connector dashed line from this bar's top-right to next bar's top-left
          const nextStep = steps[i + 1];
          const connectorY = step.isFinal ? undefined : step.y2;

          return (
            <g
              key={step.key}
              role="img"
              aria-label={`${step.label}: score ${step.score}, ${step.detail}`}
              style={{ cursor: "pointer" }}
            >
              {/* Bar rect */}
              <rect
                x={bx}
                y={step.y1}
                width={barW}
                height={barH}
                fill={step.fill}
                rx="1"
                opacity="0.85"
              />

              {/* Hover overlay for tooltip target (transparent, full column height) */}
              <rect
                x={cx}
                y={CHART_TOP}
                width={colW}
                height={CHART_H}
                fill="transparent"
              >
                <title>{`${step.label}: ${step.score}${step.isFinal ? "" : ` (−${step.score})`} — ${step.detail}`}</title>
              </rect>

              {/* Score label on top of bar */}
              {!step.isFinal && (
                <text
                  x={bx + barW / 2}
                  y={step.y1 - 2}
                  textAnchor="middle"
                  fontSize="4"
                  fill="var(--ct-text-muted)"
                  fontFamily="var(--font-mono, monospace)"
                >
                  -{step.score}
                </text>
              )}

              {/* Final composite: show score above bar */}
              {step.isFinal && (
                <text
                  x={bx + barW / 2}
                  y={step.y1 - 2}
                  textAnchor="middle"
                  fontSize="4.5"
                  fontWeight="600"
                  fill="var(--ct-warning)"
                  fontFamily="var(--font-mono, monospace)"
                >
                  {step.score}
                </text>
              )}

              {/* X-axis tick label */}
              <text
                x={cx + colW / 2}
                y={CHART_BOTTOM + 6}
                textAnchor="middle"
                fontSize="4"
                fill="var(--ct-text-muted)"
                fontFamily="var(--font-sans, sans-serif)"
              >
                {step.tick}
              </text>

              {/* Dashed connector to next bar */}
              {connectorY !== undefined && nextStep !== undefined && (
                <line
                  x1={bx + barW}
                  x2={CHART_LEFT + (i + 1) * colW + barOffset}
                  y1={connectorY}
                  y2={connectorY}
                  stroke="var(--ct-border-soft)"
                  strokeWidth="0.6"
                  strokeDasharray="1.5,1.5"
                />
              )}
            </g>
          );
        })}

        {/* ── Bottom axis line ── */}
        <line
          x1={CHART_LEFT}
          x2={CHART_RIGHT}
          y1={CHART_BOTTOM}
          y2={CHART_BOTTOM}
          stroke="var(--ct-border-soft)"
          strokeWidth="0.6"
        />
      </svg>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-4 px-1">
        <LegendDot
          color="var(--ct-surface-3)"
          label="Baseline (100)"
        />
        <LegendDot
          color="var(--ct-status-danger)"
          label="Negative contribution"
        />
        <LegendDot
          color="var(--ct-accent)"
          label="Positive contribution"
        />
        <LegendDot
          color="var(--ct-warning)"
          label={`Composite (${data.composite})`}
        />
      </div>
    </div>
  );
}

interface LegendDotProps {
  color: string;
  label: string;
}

function LegendDot({ color, label }: LegendDotProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        aria-hidden
        style={{ background: color }}
        className="inline-block h-2 w-2 rounded-sm shrink-0 opacity-85"
      />
      <span className="body-xs ct-text-muted">{label}</span>
    </div>
  );
}

// ── Bars view (legacy, exposed via view="bars") ───────────────────────────────

interface RiskRowProps {
  dimension: RiskDimension;
}

function RiskRow({ dimension }: RiskRowProps) {
  const { label, status, score, severity, detail } = dimension;
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-4 group">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          aria-hidden
          className={cn(
            "mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full",
            SEVERITY_DOT_CLASS[severity],
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="body-sm font-medium ct-text-primary group-hover:ct-text-body transition-colors">
              {label}
            </span>
            <Badge variant={SEVERITY_VARIANT[severity]}>{status}</Badge>
          </div>
          <p className="mt-1 body-xs ct-text-muted group-hover:ct-text-body transition-colors">
            {detail}
          </p>
        </div>
      </div>
      {/* sm:w-[11.25rem] conservé — 11.25rem = 180px, pas de step natif Tailwind (w-44=176px trop étroit, w-48=192px trop large) */}
      <div className="flex items-center gap-4 sm:w-[11.25rem] sm:justify-end">
        <span
          className={cn(
            "body-lg font-semibold leading-[var(--ct-leading-none)] w-9 text-right tabular-nums",
            SEVERITY_TEXT[severity],
          )}
        >
          {score}
        </span>
        <Progress
          value={score}
          fillClassName={SEVERITY_BAR[severity]}
          /* 6.25rem = 100px ; pas de step 25 dans la spacing scale Tailwind v4 par défaut */
          className="h-1.5 w-20 sm:w-[6.25rem]"
          label={`${label} risk score ${score} of 100, ${status}`}
        />
      </div>
    </div>
  );
}
