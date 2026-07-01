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

function splitLabel(label: string): string[] {
  const words = label.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [label];

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= 14 || current.length === 0) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
  }

  if (current) lines.push(current);
  return lines.length <= 2 ? lines : [lines[0]!, lines.slice(1).join(" ")];
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

  const labelLines = steps.map((step) => splitLabel(step.label));
  const maxLabelLines = Math.max(1, ...labelLines.map((lines) => lines.length));
  const chartWidth = Math.max(width, steps.length * 104);
  const padX = 16;
  const padTop = 20;
  const padBottom = 30 + Math.max(0, maxLabelLines - 1) * 12;
  const innerH = height - padTop - padBottom;

  // Graphical running cumulative — purely for bar placement. Folded (no
  // render-time reassignment) so it satisfies the react-compiler lint rule.
  const layout: LaidOutStep[] = steps.reduce<{
    rows: LaidOutStep[];
    running: number;
  }>(
    (acc, s) => {
      const start = s.kind === "total" ? 0 : acc.running;
      const end = s.kind === "total" ? s.value : acc.running + s.value;
      acc.rows.push({ ...s, start, end });
      return { rows: acc.rows, running: end };
    },
    { rows: [], running: 0 },
  ).rows;

  const maxLevel = Math.max(1, ...layout.map((l) => Math.max(l.start, l.end)));
  const yOf = (v: number): number => padTop + innerH * (1 - v / maxLevel);

  const n = steps.length;
  const gap = 12;
  const barW = Math.max(16, (chartWidth - padX * 2 - gap * (n - 1)) / n);

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      width="100%"
      viewBox={`0 0 ${chartWidth} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block", minWidth: `${chartWidth}px` }}
    >
      <line
        x1={padX}
        y1={yOf(0)}
        x2={chartWidth - padX}
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
              y={height - padBottom + 14}
              textAnchor="middle"
              fontSize={10}
              fill="var(--ct-text-muted)"
            >
              {splitLabel(l.label).map((line, lineIndex) => (
                <tspan
                  key={`${l.label}-${lineIndex}`}
                  x={x + barW / 2}
                  dy={lineIndex === 0 ? 0 : 11}
                >
                  {line}
                </tspan>
              ))}
            </text>
            <text
              x={x + barW / 2}
              y={Math.max(12, yTop - 6)}
              textAnchor="middle"
              fontSize={10}
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
