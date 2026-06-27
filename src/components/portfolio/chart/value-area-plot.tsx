"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import type { PlotGeometry } from "@/lib/portfolio/geometry/value-plot-geometry";

const PAD = { top: 10, right: 8, bottom: 4, left: 8 };

function readCssColor(canvas: HTMLCanvasElement, token: string, fallback: string): string {
  const raw = getComputedStyle(canvas).getPropertyValue(token).trim();
  return raw || fallback;
}

function plotPoint(
  coord: { x: number; y: number },
  width: number,
  height: number,
): { px: number; py: number } {
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  return {
    px: PAD.left + coord.x * innerW,
    py: PAD.top + coord.y * innerH,
  };
}

function drawPlot(
  ctx: CanvasRenderingContext2D,
  geometry: PlotGeometry,
  width: number,
  height: number,
  accent: string,
  accentSoft: string,
  grid: string,
) {
  ctx.clearRect(0, 0, width, height);

  const { coords } = geometry;
  if (coords.length < 2) return;

  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const baselineY = PAD.top + innerH;

  // Subtle horizontal guides
  ctx.strokeStyle = grid;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 6]);
  for (const frac of [0.25, 0.5, 0.75]) {
    const y = PAD.top + frac * innerH;
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + innerW, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  const pixels = coords.map((c) => plotPoint(c, width, height));

  // Area fill
  const areaGrad = ctx.createLinearGradient(0, PAD.top, 0, baselineY);
  areaGrad.addColorStop(0, accentSoft);
  areaGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.beginPath();
  ctx.moveTo(pixels[0]!.px, baselineY);
  ctx.lineTo(pixels[0]!.px, pixels[0]!.py);
  for (let i = 1; i < pixels.length; i++) {
    ctx.lineTo(pixels[i]!.px, pixels[i]!.py);
  }
  ctx.lineTo(pixels[pixels.length - 1]!.px, baselineY);
  ctx.closePath();
  ctx.fillStyle = areaGrad;
  ctx.fill();

  // Curve stroke
  ctx.beginPath();
  ctx.moveTo(pixels[0]!.px, pixels[0]!.py);
  for (let i = 1; i < pixels.length; i++) {
    ctx.lineTo(pixels[i]!.px, pixels[i]!.py);
  }
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();

  // End cap
  const last = pixels[pixels.length - 1]!;
  ctx.beginPath();
  ctx.arc(last.px, last.py, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

interface ValueAreaPlotProps {
  geometry: PlotGeometry;
  className?: string;
}

export function ValueAreaPlot({ geometry, className }: ValueAreaPlotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // Stable identity for geometry to prevent re-render loops
  const geometryRef = useRef(geometry);
  if (geometry.coords.length >= 2) {
    geometryRef.current = geometry;
  }
  const stableGeometry = geometryRef.current;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || stableGeometry.coords.length < 2) return;

    const render = () => {
      const rect = wrap.getBoundingClientRect();
      const cssW = Math.max(rect.width, 1);
      const cssH = Math.max(rect.height, 1);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      // Guard against zero-size containers
      if (cssW < 2 || cssH < 2) return;

      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const accent = readCssColor(canvas, "--ct-accent", "#A7FB90");
      const accentSoft = readCssColor(
        canvas,
        "--ct-chart-area-top",
        "color-mix(in srgb, #A7FB90 28%, transparent)",
      );
      const grid = readCssColor(
        canvas,
        "--ct-graphite-border-nested",
        "rgba(255,255,255,0.08)",
      );

      drawPlot(ctx, stableGeometry, cssW, cssH, accent, accentSoft, grid);
    };

    render();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(render);
      ro.observe(wrap);
    }
    return () => {
      if (ro) ro.disconnect();
    };
  }, [stableGeometry]);

  if (geometry.coords.length < 2) return null;

  return (
    <div ref={wrapRef} className={cn("pf-vc-plot", className)}>
      <canvas
        ref={canvasRef}
        className="pf-vc-plot__canvas"
        role="img"
        aria-label="Portfolio value over time"
      />
      <div className="pf-vc-plot__x-axis" aria-hidden>
        {geometry.xLabels.map((tick) => (
          <span
            key={`${tick.x}-${tick.label}`}
            className="pf-vc-plot__x-tick"
            style={{ left: `${tick.x * 100}%` }}
          >
            {tick.label}
          </span>
        ))}
      </div>
    </div>
  );
}
