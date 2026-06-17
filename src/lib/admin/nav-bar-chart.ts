import type { NavPoint } from "@/lib/data/dashboard";

/** Minimum NAV points before the bar chart renders (matches `nav-slot` placeholder). */
export const MIN_NAV_CHART_POINTS = 2;

export interface NavBarSlice {
  date: string;
  aum_usdc: number;
  /** Bar height as a percentage of the chart cell (0–100). */
  heightPct: number;
}

const NAV_MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
});

/** Neutral mid-line when NAV is flat across the window. */
const FLAT_HEIGHT_PCT = 50;

/**
 * Maps NAV points to bar heights. Heights are scaled from **change vs period
 * start** (first point = 0 % change) so the sparkline shape aligns with the
 * first→last delta in the footer. Flat series render at {@link FLAT_HEIGHT_PCT}.
 */
export function computeNavBarHeights(points: NavPoint[]): NavBarSlice[] {
  if (points.length === 0) return [];

  const values = points.map((point) => point.aum_usdc);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);

  if (minVal === maxVal) {
    return points.map((point) => ({
      date: point.date,
      aum_usdc: point.aum_usdc,
      heightPct: FLAT_HEIGHT_PCT,
    }));
  }

  const first = values[0] ?? 0;
  if (first === 0) {
    return computeMinMaxHeights(points);
  }

  const relChanges = values.map((value) => (value - first) / first);
  const minRel = Math.min(0, ...relChanges);
  const maxRel = Math.max(0, ...relChanges);
  const spanRel = maxRel - minRel;

  if (spanRel === 0) {
    return points.map((point) => ({
      date: point.date,
      aum_usdc: point.aum_usdc,
      heightPct: FLAT_HEIGHT_PCT,
    }));
  }

  return points.map((point, index) => {
    const normalized = (relChanges[index]! - minRel) / spanRel;
    return {
      date: point.date,
      aum_usdc: point.aum_usdc,
      heightPct: Math.round(normalized * 100),
    };
  });
}

function computeMinMaxHeights(points: NavPoint[]): NavBarSlice[] {
  const values = points.map((point) => point.aum_usdc);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;

  return points.map((point) => ({
    date: point.date,
    aum_usdc: point.aum_usdc,
    heightPct: Math.round(((point.aum_usdc - min) / span) * 100),
  }));
}

/** Accessible summary for the bar chart container. */
export function navBarChartAriaLabel(points: NavPoint[]): string {
  if (points.length === 0) return "NAV trend — no data";
  if (points.length === 1) return `NAV trend, 1 day (${points[0]!.date})`;
  const first = points[0]!.date;
  const last = points[points.length - 1]!.date;
  return `NAV trend, ${points.length} days from ${first} to ${last}`;
}

/**
 * Axis month labels for the NAV bars.
 * Returns one label per point when the series is dense enough to justify an axis.
 */
export function resolveNavMonthLabels(points: NavPoint[]): string[] | null {
  if (points.length < MIN_NAV_CHART_POINTS) return null;

  const labels = points.map((point) => {
    const date = new Date(`${point.date}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return NAV_MONTH_LABEL_FORMATTER.format(date);
  });

  return labels.every((label): label is string => label !== null) ? labels : null;
}
