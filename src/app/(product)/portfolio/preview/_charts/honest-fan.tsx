"use client";
/**
 * HcHonestFan — projection fan done honestly (the fix the shipped HcFanChart still needs).
 *
 * Graded density: an outer p5–p95 band and an inner, denser p25–p75 band (BoE/Fed), fill
 * fading with horizon so far-out uncertainty visibly dissolves. The median p50 is drawn MUTED
 * and dashed — NEVER accent green (green-as-guaranteed is forbidden). Reserve accent for
 * realized history only. Footer stamps the seed + "not guaranteed". Pure SVG, token-only.
 *
 * Hover reveals the value at the hovered horizon: a subtle vertical guide snaps to the nearest
 * band and a token-only tooltip surfaces the horizon, the median p50 and the p25–p75 range —
 * all muted (the median stays muted here too, never green-as-guaranteed). When the unit is "%"
 * and a base amount is provided, the median is also expressed as a USDC-equivalent estimate.
 */
import { useState, type PointerEvent } from "react";
import { extent, project, polyline, pathD, type PlotBox } from "@/components/dataviz/his";
import type { HcPoint } from "@/components/dataviz/his";

export interface HcHonestBand {
  /** Horizon position (e.g. month index). */
  m: number;
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}

export interface HcHonestFanProps {
  bands: readonly HcHonestBand[];
  width?: number;
  height?: number;
  unit?: string;
  seedLabel?: string;
  /**
   * Optional base amount (deposit). When set AND `unit === "%"`, the hover tooltip also
   * shows a USDC-equivalent of the median: base × (1 + p50/100), rounded, thousands-separated.
   */
  baseUsd?: number;
  /** Optional label for a horizon index (e.g. `(m) => "Month " + m`). Defaults to `"month " + m`. */
  monthLabel?: (m: number) => string;
  "aria-label": string;
}

export function HcHonestFan({
  bands,
  width = 560,
  height = 180,
  unit = "%",
  seedLabel,
  baseUsd,
  monthLabel,
  ...rest
}: HcHonestFanProps) {
  const ariaLabel = rest["aria-label"];
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  if (bands.length < 2) {
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

  const box: PlotBox = { width, height, padX: 40, padY: 18 };
  const first = bands[0]!;
  const last = bands[bands.length - 1]!;
  const xDomain: readonly [number, number] = [first.m, last.m];
  const yDomain = extent(bands.flatMap((b) => [b.p5, b.p95]));

  const proj = (m: number, y: number): HcPoint =>
    project({ x: m, y }, xDomain, yDomain, box);

  const bandPath = (
    lo: (b: HcHonestBand) => number,
    hi: (b: HcHonestBand) => number,
  ): string => {
    const upper = bands.map((b) => proj(b.m, hi(b)));
    const lower = [...bands].reverse().map((b) => proj(b.m, lo(b)));
    return `${pathD(upper)} ${lower
      .map((p) => `L${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(" ")} Z`;
  };

  const outer = bandPath((b) => b.p5, (b) => b.p95);
  const inner = bandPath((b) => b.p25, (b) => b.p75);
  const median: HcPoint[] = bands.map((b) => proj(b.m, b.p50));

  const yTicks = [yDomain[0], (yDomain[0] + yDomain[1]) / 2, yDomain[1]];
  const unitSuffix = unit === "%" ? "%" : "";
  // Left gutter (as a % of width) matching where the gridlines start, so HTML labels sit just
  // inside it and scale with the container — no SVG <text> (which distorts under aspect="none").
  const leftGutterPct = (box.padX / width) * 100;

  // ── Hover: snap to the nearest band by horizon (x), independent of vertical position ─────
  const unitLabel = unit === "%" ? "%" : ` ${unit}`;
  const fmt = (v: number): string => `${v.toFixed(1)}${unitLabel}`;

  const handlePointer = (e: PointerEvent<HTMLDivElement>): void => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const px = ((e.clientX - rect.left) / rect.width) * width;
    let best = Infinity;
    let idx = 0;
    bands.forEach((b, i) => {
      const d = Math.abs(proj(b.m, b.p50).x - px);
      if (d < best) {
        best = d;
        idx = i;
      }
    });
    setActiveIdx(idx);
  };

  const active = activeIdx != null ? bands[activeIdx] : undefined;
  const guideX = active ? proj(active.m, active.p50).x : 0;
  const activeFracPct = active ? (guideX / width) * 100 : 0;
  const activeDot = active ? proj(active.m, active.p50) : null;
  const horizonLabel = active
    ? monthLabel
      ? monthLabel(active.m)
      : `Month ${active.m}`
    : "";
  const usdEquiv =
    active && unit === "%" && typeof baseUsd === "number"
      ? `≈ $${Math.round(baseUsd * (1 + active.p50 / 100)).toLocaleString("en-US")} USDC est.`
      : null;
  // Anchor the tooltip so it never spills past the plot edges.
  const tooltipAnchor =
    activeFracPct < 22
      ? "translateX(0)"
      : activeFracPct > 78
        ? "translateX(-100%)"
        : "translateX(-50%)";

  return (
    <div role="img" aria-label={ariaLabel} className="relative w-full" style={{ height }}>
      <svg
        aria-hidden="true"
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        style={{ display: "block", position: "absolute", inset: 0 }}
      >
        <defs>
          {/* neutral graphite fill fading toward the far horizon (growing uncertainty) —
              a projection is uncertain, so it is NOT blue and NOT green-as-guaranteed */}
          <linearGradient id="hc-fan-fade" x1="0" y1="0" x2="1" y2="0">
            <stop
              offset="0%"
              stopColor="color-mix(in srgb, var(--ct-text-strong) 14%, transparent)"
            />
            <stop
              offset="100%"
              stopColor="color-mix(in srgb, var(--ct-text-strong) 4%, transparent)"
            />
          </linearGradient>
        </defs>

        {yTicks.map((t, i) => {
          const y = proj(xDomain[0], t).y;
          return (
            <line
              key={i}
              x1={box.padX}
              y1={y}
              x2={width - box.padX}
              y2={y}
              stroke="var(--ct-border-soft)"
              strokeWidth={1}
              opacity="0.4"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}

        {/* p5–p95 outer band (neutral graphite, faded with horizon) */}
        <path d={outer} fill="url(#hc-fan-fade)" data-hc-band="p5-p95" />
        {/* p25–p75 inner band (denser graphite) */}
        <path
          d={inner}
          fill="color-mix(in srgb, var(--ct-text-strong) 20%, transparent)"
          data-hc-band="p25-p75"
        />
        {/* p50 median — MUTED + dashed, never accent green */}
        <polyline
          points={polyline(median)}
          fill="none"
          stroke="var(--ct-text-muted)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          data-hc-line="p50"
        />

        {/* hover guide + median marker at the snapped horizon (muted, never green) */}
        {active && activeDot ? (
          <g data-hc-guide="true">
            <line
              x1={guideX}
              y1={box.padY}
              x2={guideX}
              y2={height - box.padY}
              stroke="var(--ct-text-muted)"
              strokeWidth={1}
              strokeDasharray="2 3"
              opacity="0.55"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={activeDot.x}
              cy={activeDot.y}
              r={3}
              fill="var(--ct-text-body)"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ) : null}
      </svg>

      {/* crisp HTML axis labels (never distorted) */}
      {yTicks.map((t, i) => {
        const topPct = (proj(xDomain[0], t).y / height) * 100;
        return (
          <span
            key={i}
            aria-hidden="true"
            className="pointer-events-none absolute -translate-y-1/2 text-right text-[length:var(--ct-text-nano)] ct-text-muted tabular-nums"
            style={{ left: 0, width: `calc(${leftGutterPct}% - 6px)`, top: `${topPct}%` }}
          >
            {t.toFixed(1)}
            {unitSuffix}
          </span>
        );
      })}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-1 right-2 max-w-[calc(100%-1rem)] truncate text-[length:var(--ct-text-nano)] ct-text-faint"
      >
        {seedLabel ? `seed: ${seedLabel} · ` : ""}p5/p25/p50/p75/p95 · not guaranteed
      </span>

      {/* pointer capture layer (transparent) — mouse + touch */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ touchAction: "none", cursor: "crosshair" }}
        onPointerMove={handlePointer}
        onPointerDown={handlePointer}
        onPointerLeave={() => setActiveIdx(null)}
        onPointerCancel={() => setActiveIdx(null)}
      />

      {/* token-only hover tooltip — the value at the hovered horizon */}
      {active ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute z-10 flex min-w-[7.5rem] flex-col gap-1 tabular-nums"
          style={{
            left: `${activeFracPct}%`,
            top: 6,
            transform: tooltipAnchor,
            padding: "0.375rem 0.5rem",
            borderRadius: "var(--ct-radius-sm)",
            background: "var(--ct-surface-inset)",
            border: "1px solid var(--ct-border)",
            boxShadow: "var(--ct-shadow-depth)",
          }}
        >
          <span className="ct-text-strong text-[length:var(--ct-text-micro)] font-semibold leading-none">
            {horizonLabel}
          </span>
          <span className="flex items-baseline justify-between gap-3 leading-none">
            <span className="ct-text-faint text-[length:var(--ct-text-nano)]">median</span>
            <span className="ct-text-body text-[length:var(--ct-text-micro)] font-semibold">
              {fmt(active.p50)}
            </span>
          </span>
          <span className="flex items-baseline justify-between gap-3 leading-none">
            <span className="ct-text-faint text-[length:var(--ct-text-nano)]">p25–p75</span>
            <span className="ct-text-muted text-[length:var(--ct-text-micro)]">
              {fmt(active.p25)}–{fmt(active.p75)}
            </span>
          </span>
          {usdEquiv ? (
            <span className="ct-text-faint text-[length:var(--ct-text-nano)] leading-none">
              {usdEquiv}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
