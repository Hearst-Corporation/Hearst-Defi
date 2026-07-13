/**
 * HcValueChart — NAV / value-over-time line chart for the /portfolio hero.
 *
 * Pure SVG (Hearst Instrument System geometry), like every other `his/` chart —
 * no charting library. The line + faded area wash live in a stretched SVG
 * (`preserveAspectRatio="none"`); the point markers and axis labels are HTML
 * overlays positioned in `%` so they NEVER shear under the stretch (the same
 * pattern as HcBarChart). The y-axis is framed on the data range (padded), not
 * baselined at 0, so a tight value band keeps its amplitude instead of
 * flattening under a full slab. Honest edges: <2 points → a sized empty surface,
 * never a fabricated line; every coordinate is finite-guarded.
 *
 * Public API unchanged (`points` / `height` / `valueFormat` / `aria-label` /
 * `showPointDots`), so every call-site is untouched. Server-renderable (no MUI,
 * no ssr:false blank-hero).
 */

import {
  formatPortfolioCurrency,
  type PortfolioChartGranularity,
  type PortfolioChartTick,
} from "@/lib/portfolio/value-series";

import { pathD, polyline, project, type PlotBox } from "./geometry";
import { HcValueChartHover, type HcValueChartHoverSample } from "./HcValueChartHover";
import type { HcPoint } from "./types";

// ── Public API (unchanged) ────────────────────────────────────────────────────

export interface HcValuePoint {
  at: Date | number | string;
  value: number;
}

export interface HcValueChartProps {
  points: readonly HcValuePoint[];
  height?: number;
  /** Compact value formatter for the y-axis (defaults to $K / $M / $B). */
  valueFormat?: (n: number) => string;
  /** Accepted for API compatibility. */
  xTicks?: readonly PortfolioChartTick[];
  /** Accepted for API compatibility. */
  granularity?: PortfolioChartGranularity;
  /** Accepted for API compatibility. */
  endpointLabel?: string;
  /** Render the per-sample dots (default true). */
  showPointDots?: boolean;
  "aria-label": string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const GRADIENT_ID = "hc-value-area-fill";

const DATE_TICK = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** Coerce a point's `at` to a millisecond timestamp. */
function toMs(at: HcValuePoint["at"]): number {
  if (typeof at === "number") return Number.isFinite(at) ? at : 0;
  if (at instanceof Date) return at.getTime();
  const t = new Date(at).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * Frame the y-axis on the data range (padded by 12%), not baselined at 0. A
 * value series in a tight band (e.g. 500k–531k) baselined at 0 renders as a
 * near-flat line; framing on [min,max] restores the amplitude. A flat series
 * (span 0) falls back to a padded domain so it never collapses to zero height.
 * Exported pure so the domain contract is testable without a DOM.
 */
export function valueYDomain(yData: readonly number[]): readonly [number, number] {
  const finite = yData.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return [0, 1];
  let min = finite[0]!;
  let max = finite[0]!;
  for (const v of finite) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = max - min;
  const pad = span > 0 ? span * 0.12 : Math.max(Math.abs(max) * 0.05, 1);
  return [Math.max(0, min - pad), max + pad];
}

/** count+1 evenly-spaced y gridline values across the domain. */
function yTicks(domain: readonly [number, number], count = 4): number[] {
  const [lo, hi] = domain;
  const span = hi - lo || 1;
  return Array.from({ length: count + 1 }, (_v, i) => lo + (span * i) / count);
}

// ── Layout constants (viewBox px) ───────────────────────────────────────────────

const VIEW_W = 1000;
const AXIS_LEFT = 64; // room for "$5.0M" labels
const AXIS_BOTTOM = 30; // room for date labels
const PAD_TOP = 16;
const PAD_RIGHT = 20;

// ── Component ──────────────────────────────────────────────────────────────────

export function HcValueChart({
  points,
  height = 220,
  valueFormat = formatPortfolioCurrency,
  showPointDots = true,
  "aria-label": ariaLabel,
}: HcValueChartProps) {
  // A single point (or none) is not a trend — honest empty surface.
  if (points.length < 2) {
    return (
      <div
        role="img"
        data-hc-empty="true"
        aria-label={ariaLabel}
        className="flex items-center justify-center rounded-xl border border-dashed border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)]"
        style={{ height }}
      >
        <span className="text-[length:var(--ct-text-nano)] ct-text-muted">
          No portfolio history yet
        </span>
      </div>
    );
  }

  const VIEW_H = height;
  const xRaw = points.map((p) => toMs(p.at));
  const yRaw = points.map((p) => (Number.isFinite(p.value) ? p.value : 0));

  const xDomain: readonly [number, number] = [xRaw[0]!, xRaw[xRaw.length - 1]!];
  const yDomain = valueYDomain(yRaw);

  // Plot box: the drawable area inside the axes (0-based; shifted into frame below).
  const plotW = VIEW_W - AXIS_LEFT - PAD_RIGHT;
  const plotH = VIEW_H - PAD_TOP - AXIS_BOTTOM;
  const box: PlotBox = { width: plotW, height: plotH, padX: 4, padY: 4 };

  const framed: HcPoint[] = points.map((_p, i) => {
    const pr = project({ x: xRaw[i]!, y: yRaw[i]! }, xDomain, yDomain, box);
    return { x: pr.x + AXIS_LEFT, y: pr.y + PAD_TOP };
  });

  const first = framed[0]!;
  const last = framed[framed.length - 1]!;
  const baseY = PAD_TOP + plotH; // bottom of the plot, where the area closes.
  const areaD = `${pathD(framed)} L${last.x.toFixed(2)} ${baseY.toFixed(2)} L${first.x.toFixed(2)} ${baseY.toFixed(2)} Z`;

  // Point markers only when the series is short enough to read them.
  const showMark = showPointDots && points.length <= 24;

  // Y gridlines + labels.
  const gy = yTicks(yDomain).map((val) => {
    const pr = project({ x: xDomain[0], y: val }, xDomain, yDomain, box);
    return { val, y: pr.y + PAD_TOP };
  });

  // X labels — cap at ~7 so they never crowd.
  const xStep = Math.max(1, Math.ceil(points.length / 7));
  const xLabels = framed
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => i % xStep === 0 || i === points.length - 1);

  // % helpers for the HTML overlays (never shear under the SVG stretch).
  const leftPct = (px: number): string => `${(px / VIEW_W) * 100}%`;
  const topPct = (py: number): string => `${(py / VIEW_H) * 100}%`;

  // Serializable feed for the client hover island — positions in %, plus the
  // value/date already formatted server-side (never pass a function to a
  // client component). The layer renders nothing until pointer-over, so the
  // static SSR markup above is unaffected.
  const hoverSamples: HcValueChartHoverSample[] = framed.map((p, i) => ({
    leftPct: (p.x / VIEW_W) * 100,
    topPct: (p.y / VIEW_H) * 100,
    valueLabel: valueFormat(yRaw[i]!),
    dateLabel: DATE_TICK.format(new Date(xRaw[i]!)),
  }));

  return (
    <div className="relative w-full" style={{ height }}>
      <svg
        role="img"
        aria-label={ariaLabel}
        width="100%"
        height="100%"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        style={{ display: "block", position: "absolute", inset: 0 }}
      >
        <defs>
          {/* Fades fast: strong near the curve, gone by ~55% — a wash, not a slab. */}
          <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ct-chart-curve-color)" stopOpacity="0.28" />
            <stop offset="55%" stopColor="var(--ct-chart-curve-color)" stopOpacity="0.06" />
            <stop offset="100%" stopColor="var(--ct-chart-curve-color)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Y gridlines */}
        {gy.map(({ y }) => (
          <line
            key={y.toFixed(2)}
            x1={AXIS_LEFT}
            y1={y}
            x2={VIEW_W - PAD_RIGHT}
            y2={y}
            stroke="var(--ct-border-soft)"
            strokeWidth={1}
            strokeDasharray="2 5"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {/* Area wash */}
        <path d={areaD} fill={`url(#${GRADIENT_ID})`} />

        {/* Line */}
        <polyline
          points={polyline(framed)}
          fill="none"
          stroke="var(--ct-chart-curve-color)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Y-axis value labels — HTML overlay so they never shear. */}
      {gy.map(({ val, y }) => (
        <span
          key={`y${y.toFixed(2)}`}
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 2,
            top: topPct(y),
            transform: "translateY(-50%)",
            fontSize: "var(--ct-text-nano)",
            fontVariantNumeric: "tabular-nums",
            color: "var(--ct-text-muted)",
            pointerEvents: "none",
          }}
        >
          {valueFormat(val)}
        </span>
      ))}

      {/* Per-sample dots — HTML overlay so they stay perfectly round. */}
      {showMark &&
        framed.map((p, i) => (
          <span
            key={`dot${i}`}
            data-hc-dot="true"
            aria-hidden="true"
            style={{
              position: "absolute",
              left: leftPct(p.x),
              top: topPct(p.y),
              width: 8,
              height: 8,
              marginLeft: -4,
              marginTop: -4,
              borderRadius: "9999px",
              background: "var(--ct-chart-curve-color)",
              boxShadow: "0 0 0 2px var(--ct-bg-deep)",
              pointerEvents: "none",
            }}
          />
        ))}

      {/* X-axis date labels. */}
      {xLabels.map(({ p, i }) => (
        <span
          key={`x${i}`}
          data-hc-xlabel="true"
          aria-hidden="true"
          style={{
            position: "absolute",
            left: leftPct(p.x),
            bottom: 0,
            transform: "translateX(-50%)",
            fontSize: "var(--ct-text-nano)",
            fontVariantNumeric: "tabular-nums",
            color: "var(--ct-text-muted)",
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          {DATE_TICK.format(new Date(xRaw[i]!))}
        </span>
      ))}

      {/* Interactive hover island — renders nothing until pointer-over, so the
          static SSR markup above (and its contract test) is untouched. */}
      <HcValueChartHover samples={hoverSamples} />
    </div>
  );
}
