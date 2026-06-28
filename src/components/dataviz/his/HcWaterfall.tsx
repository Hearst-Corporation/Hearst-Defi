/**
 * HcWaterfall — P/L, fees→net, and payout-bridge bridges.
 *
 * Positive deltas read success, negative deltas read danger, and `total`
 * anchors read graphite neutral. The only computation here is the graphical
 * running cumulative used to stack the floating bars — no business math, no
 * invented totals; callers pass pre-computed steps.
 */

export interface HcWaterfallStep {
  label: string;
  /** Signed delta for `delta` steps; absolute level for `total` anchors. */
  value: number;
  kind: "delta" | "total";
}

export interface HcWaterfallProps {
  steps: readonly HcWaterfallStep[];
  width?: number;
  height?: number;
  /** Server-provided formatter (no business logic here). */
  format?: (n: number) => string;
  "aria-label": string;
}

const defaultFormat = (n: number): string =>
  n.toLocaleString("en-US", { maximumFractionDigits: 0 });

interface LaidOutStep extends HcWaterfallStep {
  start: number;
  end: number;
}

export function HcWaterfall({
  steps,
  width = 560,
  height = 280,
  format = defaultFormat,
  ...rest
}: HcWaterfallProps) {
  const ariaLabel = rest["aria-label"];

  if (steps.length === 0) {
    return (
      <div
        role="img"
        aria-label={ariaLabel}
        data-hc-empty="true"
        style={{
          height,
          borderRadius: "var(--ct-radius-md)",
          border: "1px dashed var(--ct-border)",
        }}
      />
    );
  }

  const padX = 8;
  const padTop = 16;
  const padBottom = 28;
  const innerH = height - padTop - padBottom;

  // Graphical running cumulative — purely for bar placement.
  let running = 0;
  const layout: LaidOutStep[] = steps.map((s) => {
    const start = s.kind === "total" ? 0 : running;
    const end = s.kind === "total" ? s.value : running + s.value;
    running = s.kind === "total" ? s.value : running + s.value;
    return { ...s, start, end };
  });

  const maxLevel = Math.max(1, ...layout.map((l) => Math.max(l.start, l.end)));
  const yOf = (v: number): number => padTop + innerH * (1 - v / maxLevel);

  const n = steps.length;
  const gap = 12;
  const barW = Math.max(8, (width - padX * 2 - gap * (n - 1)) / n);

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <line
        x1={padX}
        y1={yOf(0)}
        x2={width - padX}
        y2={yOf(0)}
        stroke="var(--ct-border-strong)"
        strokeWidth={1}
      />
      {layout.map((l, i) => {
        const x = padX + i * (barW + gap);
        const yTop = yOf(Math.max(l.start, l.end));
        const barH = Math.max(2, Math.abs(yOf(l.start) - yOf(l.end)));
        const fill =
          l.kind === "total"
            ? "var(--ct-chart-neutral)"
            : l.value >= 0
              ? "var(--ct-status-success)"
              : "var(--ct-status-danger)";
        const prev = i > 0 ? layout[i - 1]! : null;
        const sign = l.kind === "delta" && l.value >= 0 ? "+" : "";

        return (
          <g key={l.label} data-hc-step={l.kind}>
            {prev && (
              <line
                x1={x - gap}
                y1={yOf(prev.end)}
                x2={x}
                y2={yOf(prev.end)}
                stroke="var(--ct-border-soft)"
                strokeWidth={1}
                strokeDasharray="2 2"
              />
            )}
            <rect
              x={x}
              y={yTop}
              width={barW}
              height={barH}
              rx={2}
              fill={fill}
              opacity={l.kind === "total" ? 0.9 : 0.85}
            />
            <text
              x={x + barW / 2}
              y={height - 14}
              textAnchor="middle"
              fontSize={9}
              fill="var(--ct-text-muted)"
            >
              {l.label}
            </text>
            <text
              x={x + barW / 2}
              y={yTop - 4}
              textAnchor="middle"
              fontSize={9}
              fill="var(--ct-text-body)"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {sign}
              {format(l.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
