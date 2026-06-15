import type { MonthlyPoint } from "@/lib/engine/types";
import { ChartProvenanceCorner } from "@/components/ui/chart-provenance-corner";
import { ChartDisclaimerUnderlay } from "@/components/ui/chart-disclaimer-underlay";
import { EmptySurface } from "@/components/ui/empty-surface";

// ── ViewBox constants ──────────────────────────────────────────────────────
// Fixed 400×160 grid. Padded 16px top/bottom/left/right.
// Series normalised into this space; flat series → centre line (no div/0).

const VB_W = 400;
const VB_H = 160;
const PAD_X = 16;
const PAD_Y = 16;
const DRAW_W = VB_W - PAD_X * 2;
const DRAW_H = VB_H - PAD_Y * 2;
// Drawdown panel lives in the bottom 30% of the chart area.
const DD_PANEL_H = Math.round(DRAW_H * 0.28);
const NAV_DRAW_H = DRAW_H - DD_PANEL_H - 4; // 4px gap between panels

// ── Normalisation helpers ──────────────────────────────────────────────────

function normY(
  value: number,
  min: number,
  max: number,
  panelTop: number,
  panelH: number
): number {
  const span = max - min || 1;
  return panelTop + panelH - ((value - min) / span) * panelH;
}

function xAt(index: number, total: number): number {
  return PAD_X + (total === 1 ? DRAW_W / 2 : (index / (total - 1)) * DRAW_W);
}

function ptsToD(pts: Array<{ x: number; y: number }>): string {
  return pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");
}

function ptsToPolyline(pts: Array<{ x: number; y: number }>): string {
  return pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

// ── Data derivation ────────────────────────────────────────────────────────

interface ChartData {
  month: number;
  nav: number;
  drawdown?: number;
  distribution?: number;
}

function toChartData(series: MonthlyPoint[]): ChartData[] {
  const navValues = series.map((p) => p.valueUsdc);
  const peak: number[] = [];
  let runPeak = navValues[0] ?? 0;
  for (const v of navValues) {
    if (v > runPeak) runPeak = v;
    peak.push(runPeak);
  }
  return series.map((p, i) => {
    const pkVal = peak[i] ?? p.valueUsdc;
    const dd = pkVal === 0 ? 0 : Math.max(0, ((pkVal - p.valueUsdc) / pkVal) * 100);
    return {
      month: i + 1,
      nav: p.valueUsdc,
      drawdown: dd,
      distribution: p.distributionUsdc,
    };
  });
}

// ── BacktestChart ──────────────────────────────────────────────────────────

interface BacktestChartProps {
  series: MonthlyPoint[];
}

/** Inline SVG stacked-area NAV + drawdown overlay — no external chart library. */
export function BacktestChart({ series }: BacktestChartProps) {
  // Empty / all-zero guard
  const hasData =
    series.length > 0 && series.some((p) => p.valueUsdc !== 0);

  if (!hasData) {
    return (
      <EmptySurface
        variant="chart"
        message="Insufficient data — preview only"
        ariaLabel="Backtest chart — insufficient data"
        className="min-h-[var(--ct-chart-empty-h,8rem)]"
      />
    );
  }

  const data = toChartData(series);
  const n = data.length;

  // NAV panel — top portion
  const navTop = PAD_Y;
  const navValues = data.map((d) => d.nav);
  const navMin = Math.min(...navValues);
  const navMax = Math.max(...navValues);

  const navPts = data.map((d, i) => ({
    x: xAt(i, n),
    y: normY(d.nav, navMin, navMax, navTop, NAV_DRAW_H),
  }));

  // Area under NAV line
  const navAreaPts: string = (() => {
    const line = ptsToPolyline(navPts);
    const first = navPts[0]!;
    const last = navPts[navPts.length - 1]!;
    return `${line} ${last.x.toFixed(2)},${(navTop + NAV_DRAW_H).toFixed(2)} ${first.x.toFixed(2)},${(navTop + NAV_DRAW_H).toFixed(2)}`;
  })();

  const navLinePath = ptsToD(navPts);

  // Drawdown panel — bottom portion
  const ddTop = navTop + NAV_DRAW_H + 4;
  const ddValues = data.map((d) => d.drawdown ?? 0);
  const ddMax = Math.max(...ddValues, 0.001); // avoid flat 0

  const ddPts = data.map((d, i) => ({
    x: xAt(i, n),
    y: normY(d.drawdown ?? 0, 0, ddMax, ddTop, DD_PANEL_H),
  }));

  // Drawdown shading polygon (fill from baseline down to value)
  const ddBaselineY = ddTop + DD_PANEL_H;
  const ddAreaPts: string = (() => {
    const line = ptsToPolyline(ddPts);
    const first = ddPts[0]!;
    const last = ddPts[ddPts.length - 1]!;
    return `${line} ${last.x.toFixed(2)},${ddBaselineY.toFixed(2)} ${first.x.toFixed(2)},${ddBaselineY.toFixed(2)}`;
  })();

  // Distribution markers
  const distPts = data
    .filter((d) => (d.distribution ?? 0) > 0)
    .map((d) => {
      const i = d.month - 1;
      return {
        x: xAt(i, n),
        y: normY(d.nav, navMin, navMax, navTop, NAV_DRAW_H),
      };
    });

  // Grid lines (3 horizontal lines in each panel)
  const navGridYs = [0.25, 0.5, 0.75].map(
    (frac) => navTop + NAV_DRAW_H * (1 - frac)
  );
  const ddGridYs = [0.5].map((frac) => ddTop + DD_PANEL_H * (1 - frac));

  // Last NAV for header
  const lastNav = navValues[navValues.length - 1] ?? 0;
  const firstNav = navValues[0] ?? 0;
  const deltaPct =
    firstNav === 0 ? 0 : ((lastNav - firstNav) / firstNav) * 100;
  const maxDd = Math.max(...ddValues);

  const usdFmt = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  });

  return (
    <div className="relative flex w-full admin-doc-stack--tight">
      <ChartProvenanceCorner kind="estimated" />
      {/* Header row */}
      <div className="admin-doc-inline-row admin-doc-inline-row--between admin-doc-inline-row--start admin-doc-inline-row--relaxed">
        <div className="admin-doc-stack--micro">
          <span className="stat-label">
            NAV · Backtest series
          </span>
          <span className="tabular-nums stat-value leading-tight ct-text-primary">
            {usdFmt.format(lastNav)}
          </span>
          <span
            className={`tabular-nums body-xs ${deltaPct >= 0 ? "ct-text-accent" : "ct-status-danger"}`}
          >
            {deltaPct >= 0 ? "+" : ""}
            {deltaPct.toFixed(1)}% total · max dd {maxDd.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* SVG chart */}
      <div className="relative w-full">
        <ChartDisclaimerUnderlay />
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="xMidYMid meet"
        className="w-full"
        style={{ aspectRatio: `${VB_W} / ${VB_H}` }}
          role="img"
          aria-labelledby="bt-chart-title bt-chart-desc"
        >
          <title id="bt-chart-title">Backtest NAV and drawdown chart</title>
          <desc id="bt-chart-desc">
            {`Backtest series with ${n} monthly data points. Final NAV ${usdFmt.format(lastNav)}, total return ${deltaPct.toFixed(1)}%, max drawdown ${maxDd.toFixed(1)}%.`}
          </desc>

        {/* ── Grid lines (NAV panel) ── */}
        {navGridYs.map((gy, idx) => (
          <line
            key={`nav-grid-${idx}`}
            x1={PAD_X}
            y1={gy}
            x2={VB_W - PAD_X}
            y2={gy}
            stroke="var(--ct-border-soft)"
            strokeWidth="0.5"
            strokeDasharray="2,3"
          />
        ))}

        {/* ── Grid lines (drawdown panel) ── */}
        {ddGridYs.map((gy, idx) => (
          <line
            key={`dd-grid-${idx}`}
            x1={PAD_X}
            y1={gy}
            x2={VB_W - PAD_X}
            y2={gy}
            stroke="var(--ct-border-soft)"
            strokeWidth="0.5"
            strokeDasharray="2,3"
          />
        ))}

        {/* ── Separator between panels ── */}
        <line
          x1={PAD_X}
          y1={ddTop - 2}
          x2={VB_W - PAD_X}
          y2={ddTop - 2}
          stroke="var(--ct-border-soft)"
          strokeWidth="0.5"
        />

        {/* ── Drawdown shading ── */}
        <polygon
          points={ddAreaPts}
          fill="var(--ct-status-danger)"
          style={{ opacity: "var(--ct-opacity-15)" }}
        />

        {/* ── NAV area fill ── */}
        <polygon
          points={navAreaPts}
          fill="var(--ct-status-success)"
          style={{ opacity: "var(--ct-opacity-8)" }}
        />

        {/* ── NAV line ── */}
        <path
          d={navLinePath}
          fill="none"
          stroke="var(--ct-status-success)"
          strokeWidth="1.2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* ── Distribution markers ── */}
        {distPts.map((pt, idx) => (
          <circle
            key={`dist-${idx}`}
            cx={pt.x}
            cy={pt.y}
            r={2}
            fill="var(--ct-status-success-soft)"
            style={{ opacity: "var(--ct-opacity-80)" }}
            aria-label="Distribution event"
          />
        ))}

        {/* ── Panel labels ── */}
        <text
          x={PAD_X + 2}
          y={navTop + 7}
          className="dash-chart-svg-text-tick-sans"
          aria-hidden="true"
        >
          NAV
        </text>
        <text
          x={PAD_X + 2}
          y={ddTop + 7}
          className="dash-chart-svg-text-tick-sans"
          aria-hidden="true"
        >
          DD%
        </text>
      </svg>
      </div>

      {/* Footer disclaimer */}
      <p className="body-xs ct-text-muted leading-tight">
        Projections only. Not guaranteed. Past results do not predict future
        returns. See Methodology v1.0.
      </p>
    </div>
  );
}
