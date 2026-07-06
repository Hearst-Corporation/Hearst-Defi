/**
 * HcProductionBars — operation-level BTC produced per period, compact calendar-style bars.
 *
 * Same discreet treatment as the distribution calendar: thin monthly bars, month labels, no
 * heavy cumulative overlay. Realized months read accent-green; a not-yet-closed (estimated)
 * month reads GREY graphite — never a barred/hatched fill — so a placeholder can never look
 * attested. Pure SVG, token-only, fills its fixed-height box (preserveAspectRatio="none").
 * GENERAL/operation-level — not per-investor.
 */
export interface HcProductionDatum {
  label: string;
  btc: number;
  /** Not-yet-closed period → greyed, not accent. */
  estimated?: boolean;
}

export interface HcProductionBarsProps {
  data: readonly HcProductionDatum[];
  height?: number;
  "aria-label": string;
}

export function HcProductionBars({
  data,
  height = 150,
  ...rest
}: HcProductionBarsProps) {
  const ariaLabel = rest["aria-label"];
  const n = data.length;

  if (n === 0) {
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

  const width = n * 40;
  const padX = 14;
  const padTop = 14;
  const padBottom = 24;
  const innerH = height - padTop - padBottom;
  const maxBtc = Math.max(1, ...data.map((d) => d.btc));
  const gap = 14;
  const barW = Math.max(8, (width - padX * 2 - gap * (n - 1)) / n);

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ display: "block" }}
    >
      {/* zero baseline */}
      <line
        x1={padX}
        y1={padTop + innerH}
        x2={width - padX}
        y2={padTop + innerH}
        stroke="var(--ct-border-soft)"
        strokeWidth={1}
      />

      {data.map((d, i) => {
        const h = Math.max(2, innerH * (d.btc / maxBtc));
        const x = padX + i * (barW + gap);
        const y = padTop + innerH - h;
        return (
          <g key={d.label}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={2}
              fill={
                d.estimated
                  ? "color-mix(in srgb, var(--ct-text-strong) 18%, transparent)"
                  : "var(--ct-accent)"
              }
              opacity={d.estimated ? 1 : 0.9}
            />
            <text
              x={x + barW / 2}
              y={height - padBottom + 15}
              textAnchor="middle"
              fontSize={9}
              fill="var(--ct-text-muted)"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
