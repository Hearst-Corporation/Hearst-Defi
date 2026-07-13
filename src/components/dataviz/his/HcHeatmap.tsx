/**
 * HcHeatmap — HIS activity heatmap (calendar-style day × period grid).
 *
 * A grid of cells whose green LUMINANCE encodes intensity (uptime %, blocks
 * found, kWh…) — the "something is happening" instrument. Pure server render,
 * token-only, zero charting dep:
 *  - cells are an HTML overlay (not stretched SVG) so they stay perfectly square;
 *  - intensity buckets onto the four `--ct-chart-series-*` accent stops;
 *  - IDLE / no-data cells are `--ct-surface-inset` (neutral), NEVER the faintest
 *    green — a blank day must not read as "a little active" (honesty invariant);
 *  - each cell carries a native `<title>` (label + value) for accessible,
 *    zero-JS hover;
 *  - an all-idle / empty grid renders an explicit empty state, never a field of
 *    fake activity.
 *
 * Colour comes from `--ct-chart-*` tokens only. Wrap in `HcChartCard` for the
 * surface, header, source badge and disclaimer.
 */

import { extent } from "./geometry";
import { HcPlotEmpty } from "./HcPlotEmpty";

export interface HcHeatCell {
  /** Column index (0-based), e.g. week-of-period. */
  col: number;
  /** Row index (0-based), e.g. day-of-week (0 = Mon … 6 = Sun). */
  row: number;
  /** Raw intensity. Non-finite / ≤ 0 is treated as no-data (idle). */
  value: number;
  /** Pre-formatted tooltip value; else `valueFormat(value)` is used. */
  tooltip?: string;
  /** Optional label (e.g. date) surfaced in the `<title>`. */
  label?: string;
}

/** 4 active accent stops (faint → full) — matches `--ct-chart-series-4..1`. */
const HEAT_RAMP = [
  "var(--ct-chart-series-4)",
  "var(--ct-chart-series-3)",
  "var(--ct-chart-series-2)",
  "var(--ct-chart-series-1)",
] as const;
const IDLE_FILL = "var(--ct-surface-inset)";

export interface HcHeatmapProps {
  cells: readonly HcHeatCell[];
  /** Grid width. Defaults to `max(col) + 1`. */
  cols?: number;
  /** Grid height. Defaults to `max(row) + 1`. */
  rows?: number;
  height?: number;
  /** Row-axis labels (sparse ok), e.g. ["Mon","","Wed","","Fri","",""]. */
  rowLabels?: readonly string[];
  /** Column-axis labels (sparse ok), e.g. month initials. */
  colLabels?: readonly string[];
  /** Format for the default tooltip / legend ends. Default: integer. */
  valueFormat?: (v: number) => string;
  /** Domain override [min, max]; else derived from finite positive values. */
  domain?: readonly [number, number];
  /** Show the Less → More luminance legend below the grid. Default true. */
  showLegend?: boolean;
  emptyMessage?: string;
  "aria-label": string;
}

const defaultFormat = (v: number): string => `${Math.round(v)}`;

export function HcHeatmap({
  cells,
  cols,
  rows,
  height = 200,
  rowLabels,
  colLabels,
  valueFormat = defaultFormat,
  domain,
  showLegend = true,
  emptyMessage = "No activity yet",
  ...rest
}: HcHeatmapProps) {
  const ariaLabel = rest["aria-label"];
  const active = cells.filter((c) => Number.isFinite(c.value) && c.value > 0);

  // Honest empty state — an all-idle grid does not fake activity.
  if (cells.length === 0 || active.length === 0) {
    return (
      <HcPlotEmpty message={emptyMessage} height={height} aria-label={ariaLabel} />
    );
  }

  const nCols = cols ?? Math.max(...cells.map((c) => c.col)) + 1;
  const nRows = rows ?? Math.max(...cells.map((c) => c.row)) + 1;
  const [lo, hi] = domain ?? extent(active.map((c) => c.value));
  const spread = hi - lo || 1;

  // Bucket an intensity into [0..3]; idle handled separately.
  const bucket = (v: number): number => {
    const t = Math.max(0, Math.min(1, (v - lo) / spread));
    return Math.min(HEAT_RAMP.length - 1, Math.floor(t * HEAT_RAMP.length));
  };

  // O(1) cell lookup by "row:col".
  const byKey = new Map<string, HcHeatCell>();
  for (const c of cells) byKey.set(`${c.row}:${c.col}`, c);

  return (
    <div className="flex w-full flex-col gap-[var(--ct-space-2)]" style={{ minHeight: height }}>
      <div className="flex w-full flex-1 gap-[var(--ct-space-2)]">
        {/* Row labels */}
        {rowLabels ? (
          <div
            aria-hidden="true"
            className="grid shrink-0"
            style={{ gridTemplateRows: `repeat(${nRows}, 1fr)`, rowGap: "var(--ct-space-1)" }}
          >
            {Array.from({ length: nRows }, (_, r) => (
              <span
                key={r}
                className="flex items-center text-[length:var(--ct-text-nano)] text-[var(--ct-text-muted)]"
              >
                {rowLabels[r] ?? ""}
              </span>
            ))}
          </div>
        ) : null}

        {/* Cell grid — square cells, HTML overlay so they never shear. */}
        <div className="flex w-full flex-col gap-[var(--ct-space-1)]">
          <div
            className="grid w-full flex-1"
            style={{
              gridTemplateColumns: `repeat(${nCols}, 1fr)`,
              gridTemplateRows: `repeat(${nRows}, 1fr)`,
              gap: "var(--ct-space-1)",
            }}
          >
            {Array.from({ length: nRows }, (_, r) =>
              Array.from({ length: nCols }, (_, col) => {
                const cell = byKey.get(`${r}:${col}`);
                const v = cell && Number.isFinite(cell.value) ? cell.value : 0;
                const idle = v <= 0;
                const fill = idle ? IDLE_FILL : HEAT_RAMP[bucket(v)];
                const title = cell
                  ? `${cell.label ? `${cell.label}: ` : ""}${cell.tooltip ?? valueFormat(v)}`
                  : "No data";
                return (
                  <div
                    key={`${r}:${col}`}
                    className="aspect-square w-full rounded-[var(--ct-radius-xs)]"
                    style={{ background: fill }}
                    title={title}
                    data-hc-cell={idle ? "idle" : "active"}
                  />
                );
              }),
            )}
          </div>

          {/* Column labels */}
          {colLabels ? (
            <div
              aria-hidden="true"
              className="grid w-full"
              style={{ gridTemplateColumns: `repeat(${nCols}, 1fr)`, gap: "var(--ct-space-1)" }}
            >
              {Array.from({ length: nCols }, (_, col) => (
                <span
                  key={col}
                  className="truncate text-center text-[length:var(--ct-text-nano)] text-[var(--ct-text-muted)]"
                >
                  {colLabels[col] ?? ""}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Luminance legend */}
      {showLegend ? (
        <div
          aria-hidden="true"
          className="flex items-center gap-[var(--ct-space-1_5)] self-end"
        >
          <span className="text-[length:var(--ct-text-nano)] text-[var(--ct-text-muted)]">
            {valueFormat(lo)}
          </span>
          <span
            className="h-2.5 w-2.5 rounded-[var(--ct-radius-xs)]"
            style={{ background: IDLE_FILL }}
          />
          {HEAT_RAMP.map((c, i) => (
            <span
              key={i}
              className="h-2.5 w-2.5 rounded-[var(--ct-radius-xs)]"
              style={{ background: c }}
            />
          ))}
          <span className="text-[length:var(--ct-text-nano)] text-[var(--ct-text-muted)]">
            {valueFormat(hi)}
          </span>
        </div>
      ) : null}
    </div>
  );
}
