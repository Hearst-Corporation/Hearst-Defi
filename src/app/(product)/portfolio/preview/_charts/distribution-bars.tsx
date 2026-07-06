/**
 * HcDistributionBars — status-driven monthly USDC distribution calendar (not boolean forecast).
 *
 * Sharesight status taxonomy → three visual weights: attested = solid green, pending/announced =
 * low-opacity green, estimated = hatched + dashed outline (dual-signal, so a forecast never reads
 * as paid). A "today" divider splits solid-history (left) from projection (right), per FT. Bars
 * carry the magnitude truth. Pure SVG, token-only.
 */
export type DistStatus = "attested" | "pending" | "estimated";

export interface DistMonth {
  label: string;
  amountUsdc: number;
  status: DistStatus;
}

export interface HcDistributionBarsProps {
  months: readonly DistMonth[];
  /** Index of the last realized month; the divider is drawn to its right. */
  todayIndex: number;
  height?: number;
  "aria-label": string;
}

export function HcDistributionBars({
  months,
  todayIndex,
  height = 160,
  ...rest
}: HcDistributionBarsProps) {
  const ariaLabel = rest["aria-label"];
  const n = months.length;

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
  const maxAmt = Math.max(1, ...months.map((m) => m.amountUsdc));
  const gap = 12;
  const barW = Math.max(10, (width - padX * 2 - gap * (n - 1)) / n);

  const dividerX =
    padX + (todayIndex + 1) * (barW + gap) - gap / 2;

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

      {/* "today" divider */}
      {todayIndex >= 0 && todayIndex < n - 1 ? (
        <g>
          <line
            x1={dividerX}
            y1={padTop - 4}
            x2={dividerX}
            y2={padTop + innerH}
            stroke="var(--ct-border-strong)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <text
            x={dividerX + 4}
            y={padTop + 4}
            fontSize={9}
            fill="var(--ct-text-faint)"
          >
            today
          </text>
        </g>
      ) : null}

      {months.map((m, i) => {
        const h = Math.max(2, innerH * (m.amountUsdc / maxAmt));
        const x = padX + i * (barW + gap);
        const y = padTop + innerH - h;
        // Realized month = accent green; anything not-yet-real (pending / future
        // estimate) = greyed graphite, never barred/hatched (institutional, honest).
        const fill =
          m.status === "attested"
            ? "var(--ct-accent)"
            : m.status === "pending"
              ? "color-mix(in srgb, var(--ct-text-strong) 30%, transparent)"
              : "color-mix(in srgb, var(--ct-text-strong) 16%, transparent)";
        const opacity = m.status === "attested" ? 0.9 : 1;
        return (
          <g key={m.label}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={2}
              fill={fill}
              opacity={opacity}
            />
            <text
              x={x + barW / 2}
              y={height - padBottom + 14}
              textAnchor="middle"
              fontSize={9}
              fill="var(--ct-text-muted)"
            >
              {m.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
