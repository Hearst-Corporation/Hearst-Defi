import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartProvenanceCorner } from "@/components/ui/chart-provenance-corner";
import { ChartDisclaimerUnderlay } from "@/components/ui/chart-disclaimer-underlay";
import type { ScenarioOutput } from "@/lib/engine/types";

// ── NAV projection series ─────────────────────────────────────────────────────
//
// Renders a 12-month projected NAV fan chart from the engine's apy_range.
// LOW → p5, MID → p50, HIGH → p95. Band p25-p75 derived as inner ±25% of span.
// All math is purely display formatting of the engine's output numbers —
// compound interest layout for rendering only (no new business logic).
// NOTE: display proxy only — percentile-like bands are derived from APY range.

const INITIAL_NAV = 1_000_000; // illustrative $1M notional
const MONTHS = 12;

// ViewBox constants — compact 100×40 grid, matching timeseries-section.tsx.
const VB_W = 100;
const VB_H = 40;
const PAD = 2;

interface NavProjection {
  month: number;
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}

function buildNavSeries(
  apyLow: number,
  apyHigh: number,
): NavProjection[] {
  const midApy = (apyLow + apyHigh) / 2;
  const p25Apy = apyLow + (apyHigh - apyLow) * 0.25;
  const p75Apy = apyLow + (apyHigh - apyLow) * 0.75;

  const monthlyP5  = Math.pow(1 + apyLow / 100,  1 / 12) - 1;
  const monthlyP25 = Math.pow(1 + p25Apy / 100,  1 / 12) - 1;
  const monthlyP50 = Math.pow(1 + midApy / 100,  1 / 12) - 1;
  const monthlyP75 = Math.pow(1 + p75Apy / 100,  1 / 12) - 1;
  const monthlyP95 = Math.pow(1 + apyHigh / 100, 1 / 12) - 1;

  const series: NavProjection[] = [];
  let navP5  = INITIAL_NAV;
  let navP25 = INITIAL_NAV;
  let navP50 = INITIAL_NAV;
  let navP75 = INITIAL_NAV;
  let navP95 = INITIAL_NAV;

  for (let m = 1; m <= MONTHS; m++) {
    navP5  *= 1 + monthlyP5;
    navP25 *= 1 + monthlyP25;
    navP50 *= 1 + monthlyP50;
    navP75 *= 1 + monthlyP75;
    navP95 *= 1 + monthlyP95;
    series.push({ month: m, p5: navP5, p25: navP25, p50: navP50, p75: navP75, p95: navP95 });
  }
  return series;
}

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(3)}M`;
  return `$${(n / 1_000).toFixed(0)}K`;
}

// ── SVG helpers ───────────────────────────────────────────────────────────────

function pts(arr: Array<{ x: number; y: number }>): string {
  return arr.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

// ── Fan chart SVG ─────────────────────────────────────────────────────────────

interface FanChartProps {
  series: NavProjection[];
  ariaLabel: string;
}

function FanChart({ series, ariaLabel: _ariaLabel }: FanChartProps) {
  // All values across all percentile bands — needed for unified normalisation.
  const allValues = series.flatMap((d) => [d.p5, d.p25, d.p50, d.p75, d.p95]);
  // Prepend INITIAL_NAV so the chart always starts at the flat origin.
  allValues.push(INITIAL_NAV);
  const globalMin = Math.min(...allValues);
  const globalMax = Math.max(...allValues);

  // Prepend origin point (month 0 = INITIAL_NAV) to each band.
  const allMonths = [0, ...series.map((d) => d.month)];
  const bandData = <K extends keyof NavProjection>(key: K): number[] =>
    [INITIAL_NAV, ...series.map((d) => d[key] as number)];

  const xAt = (i: number) =>
    allMonths.length === 1 ? VB_W / 2 : (i / (allMonths.length - 1)) * VB_W;

  const yAt = (v: number): number => {
    const span = globalMax - globalMin || 1;
    const innerH = VB_H - PAD * 2;
    return PAD + innerH - ((v - globalMin) / span) * innerH;
  };

  const toCoords = (values: number[]): Array<{ x: number; y: number }> =>
    values.map((v, i) => ({ x: xAt(i), y: yAt(v) }));

  const p5Coords  = toCoords(bandData("p5"));
  const p25Coords = toCoords(bandData("p25"));
  const p50Coords = toCoords(bandData("p50"));
  const p75Coords = toCoords(bandData("p75"));
  const p95Coords = toCoords(bandData("p95"));

  // Outer band p5→p95 polygon: trace p95 forward, p5 reversed.
  const outerBand = `${pts(p95Coords)} ${pts([...p5Coords].reverse())}`;
  // Inner band p25→p75 polygon.
  const innerBand = `${pts(p75Coords)} ${pts([...p25Coords].reverse())}`;

  // Target line: horizontal at the p50 final value (rough "mid" target).
  const targetY = yAt(series[series.length - 1]?.p75 ?? globalMax);

  // Unique IDs for SVG defs (stable, deterministic).
  const titleId = "nav-sparkline-title";
  const descId  = "nav-sparkline-desc";

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      className="w-full h-full"
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
    >
      <title id={titleId}>12-Month NAV Projection Fan Chart</title>
      <desc id={descId}>
        Fan chart showing projected NAV over 12 months with p5/p50/p95 proxy bands.
        Bands are derived from the APY range, not from a Monte Carlo simulation.
      </desc>

      {/* Outer band p5-p95 */}
      <polygon
        points={outerBand}
        fill="var(--ct-accent-soft)"
        opacity="0.18"
      />

      {/* Inner band p25-p75 */}
      <polygon
        points={innerBand}
        fill="var(--ct-accent-soft)"
        opacity="0.45"
      />

      {/* High-band edge (p95) */}
      <polyline
        points={pts(p95Coords)}
        fill="none"
        stroke="var(--ct-accent)"
        strokeWidth="0.4"
        strokeOpacity="0.4"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* Low-band edge (p5) */}
      <polyline
        points={pts(p5Coords)}
        fill="none"
        stroke="var(--ct-accent)"
        strokeWidth="0.4"
        strokeOpacity="0.4"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* Median line (p50) */}
      <polyline
        points={pts(p50Coords)}
        fill="none"
        stroke="var(--ct-accent)"
        strokeWidth="1.0"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* Target line — p75 dashed indicator */}
      <line
        x1="0"
        y1={targetY.toFixed(2)}
        x2={VB_W.toString()}
        y2={targetY.toFixed(2)}
        stroke="var(--ct-status-warning)"
        strokeWidth="0.5"
        strokeDasharray="2 1.5"
        strokeOpacity="0.55"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface NavSparklineProps {
  output: ScenarioOutput;
}

export function NavSparkline({ output }: NavSparklineProps) {
  const series = buildNavSeries(output.apy_range.low, output.apy_range.high);
  const last = series[series.length - 1];

  return (
    <Card className="relative">
      <ChartProvenanceCorner kind="estimated" />
      <CardHeader className="mb-3">
        <CardTitle>12-Month NAV Projection</CardTitle>
      </CardHeader>

      <div className="mb-3 flex flex-wrap items-end gap-6 text-sm">
        <div className="flex flex-col gap-0.5">
          <span className="stat-label text-micro">Low band</span>
          <span className="mono font-bold ct-text-body">
            {last ? formatUsd(last.p5) : "—"}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="stat-label text-micro">Midpoint</span>
          <span className="mono font-bold ct-text-strong">
            {last ? formatUsd(last.p50) : "—"}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="stat-label text-micro">High band</span>
          <span className="mono font-bold ct-text-body">
            {last ? formatUsd(last.p95) : "—"}
          </span>
        </div>
        <div className="ml-auto text-micro ct-text-muted">
          Notional $1M · 12 months
        </div>
      </div>

      {/* Fan chart — real SVG, percentile-like proxy bands from APY range.
          Sized as the second main result block, not a cramped sparkline. */}
      <div className="relative h-44 w-full overflow-hidden sm:h-56">
        <ChartDisclaimerUnderlay />
        {series.length > 0 ? (
          <FanChart
            series={series}
            ariaLabel={`NAV fan chart, 12 months, midpoint ${last ? formatUsd(last.p50) : "n/a"}`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-micro ct-text-muted">
            No projection data
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-micro ct-text-muted">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-4 rounded-full bg-[var(--ct-accent)]"
          />
          Median (p50)
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-4 rounded-sm bg-[var(--ct-accent-soft)] opacity-45"
          />
          p25–p75
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-4 rounded-sm bg-[var(--ct-accent-soft)] opacity-18"
          />
          p5–p95
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-4 border-t border-dashed border-[var(--ct-status-warning)]"
          />
          High target
        </span>
        <span className="ml-auto italic">
          proxy bands derived from APY range
        </span>
      </div>
    </Card>
  );
}
