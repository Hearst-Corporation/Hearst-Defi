"use client";

import { useEffect, useRef } from "react";

import type { AgentPulse, AgentPulseState } from "@/lib/data/agent-pulse";

/**
 * Animated dice canvas for the base agents.
 *
 * Each agent is a slowly-tumbling 3D die rendered on a 2D <canvas> (isometric
 * cube faces + a pip count, with an ambient glow). Colour and motion encode the
 * live state from `loadAgentPulses`:
 *   - active  → accent green (#A7FB90), faster tumble, brighter glow
 *   - idle    → muted, slow drift
 *   - failed  → danger red, jittery
 * Honest by construction: an agent with no recent run renders idle, never lit.
 *
 * Pure presentational client component — reads its data via props, owns only an
 * rAF loop it tears down on unmount, and respects prefers-reduced-motion.
 */

interface RGB {
  r: number;
  g: number;
  b: number;
}

const COLORS: Record<AgentPulseState, RGB> = {
  // #A7FB90 accent green
  active: { r: 167, g: 251, b: 144 },
  // muted slate
  idle: { r: 122, g: 134, b: 154 },
  // danger red
  failed: { r: 232, g: 90, b: 90 },
};

const PIP_BY_STATE: Record<AgentPulseState, number> = {
  active: 6,
  idle: 3,
  failed: 1,
};

const rgba = (c: RGB, a: number): string => `rgba(${c.r},${c.g},${c.b},${a})`;

interface DieLayout {
  pulse: AgentPulse;
  cx: number;
  cy: number;
  size: number;
  phase: number;
  spin: number;
}

export function AgentDiceCanvas({ pulses }: { pulses: AgentPulse[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Keep the latest pulses in a ref so the rAF loop reads fresh data without
  // restarting the animation on every prop change.
  const pulsesRef = useRef(pulses);
  pulsesRef.current = pulses;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    let layouts: DieLayout[] = [];
    let width = 0;
    let height = 0;

    const layout = (): void => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const list = pulsesRef.current;
      const n = list.length || 1;
      // Responsive columns: fit dice on a single tidy row/grid.
      const cols = Math.min(n, width < 520 ? 2 : width < 820 ? 4 : n);
      const rows = Math.ceil(n / cols);
      const cellW = width / cols;
      const cellH = height / rows;
      const size = Math.max(28, Math.min(cellW, cellH) * 0.42);

      layouts = list.map((pulse, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        return {
          pulse,
          cx: cellW * (col + 0.5),
          cy: cellH * (row + 0.5),
          size,
          phase: (i * 1.37) % (Math.PI * 2),
          spin: 0.25 + ((i * 0.11) % 0.4),
        };
      });
    };

    /** Draws one isometric die with a tumble angle `t` and ambient glow. */
    const drawDie = (d: DieLayout, t: number): void => {
      const { cx, cy, size, pulse, phase, spin } = d;
      const color = COLORS[pulse.state];
      const active = pulse.state === "active";
      const failed = pulse.state === "failed";

      // Vertical float + a little jitter when failed.
      const float = Math.sin(t * 0.9 + phase) * (size * 0.12);
      const jitter = failed ? Math.sin(t * 14 + phase) * 1.6 : 0;
      const ox = cx + jitter;
      const oy = cy + float;

      // Tumble: rotate the top-face skew over time.
      const ang = reduceMotion ? phase : t * spin + phase;
      const skew = Math.sin(ang) * 0.5;
      const intensity = active ? 1 : pulse.state === "idle" ? 0.45 : 0.8;

      // Ambient glow halo.
      const glow = ctx.createRadialGradient(ox, oy, size * 0.2, ox, oy, size * 1.7);
      glow.addColorStop(0, rgba(color, 0.32 * intensity));
      glow.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(ox, oy, size * 1.7, 0, Math.PI * 2);
      ctx.fill();

      const h = size * 0.5;
      // Isometric cube: top rhombus + two side faces.
      const top = [
        { x: ox, y: oy - h },
        { x: ox + h, y: oy - h * 0.5 + skew * h },
        { x: ox, y: oy + skew * h },
        { x: ox - h, y: oy - h * 0.5 + skew * h },
      ];
      const leftFace = [
        top[3]!,
        { x: ox - h, y: oy + h * 0.5 + skew * h },
        { x: ox, y: oy + h },
        top[2]!,
      ];
      const rightFace = [
        top[2]!,
        { x: ox, y: oy + h },
        { x: ox + h, y: oy + h * 0.5 + skew * h },
        top[1]!,
      ];

      const poly = (pts: { x: number; y: number }[], fill: string): void => {
        ctx.beginPath();
        ctx.moveTo(pts[0]!.x, pts[0]!.y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = rgba(color, 0.55 * intensity);
        ctx.lineWidth = 1;
        ctx.stroke();
      };

      poly(leftFace, rgba(color, 0.1 * intensity));
      poly(rightFace, rgba(color, 0.18 * intensity));
      poly(top, rgba(color, 0.34 * intensity));

      // Pips on the top face — count encodes state.
      const pips = PIP_BY_STATE[pulse.state];
      ctx.fillStyle = rgba(color, 0.95 * intensity);
      const pr = Math.max(1.4, size * 0.05);
      const spread = h * 0.42;
      const offsets: Array<[number, number]> = pipOffsets(pips, spread);
      for (const [dx, dy] of offsets) {
        ctx.beginPath();
        ctx.arc(ox + dx, oy - h * 0.5 + dy, pr, 0, Math.PI * 2);
        ctx.fill();
      }

      // Label under the die.
      ctx.fillStyle = rgba(color, 0.85 * intensity);
      ctx.font = "600 10px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(shortLabel(pulse.label), cx, oy + h + size * 0.35);
    };

    const frame = (ms: number): void => {
      const t = ms / 1000;
      ctx.clearRect(0, 0, width, height);
      for (const d of layouts) drawDie(d, t);
      raf = window.requestAnimationFrame(frame);
    };

    layout();
    if (reduceMotion) {
      // Draw a single static frame.
      ctx.clearRect(0, 0, width, height);
      for (const d of layouts) drawDie(d, 0);
    } else {
      raf = window.requestAnimationFrame(frame);
    }

    const onResize = (): void => layout();
    window.addEventListener("resize", onResize);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="block h-[clamp(180px,28vw,260px)] w-full"
      role="img"
      aria-label="Animated activity dice for each base agent"
    />
  );
}

/** Pip coordinate offsets (dice faces 1–6) within a face of half-spread `s`. */
function pipOffsets(n: number, s: number): Array<[number, number]> {
  const C: [number, number] = [0, 0];
  const TL: [number, number] = [-s, -s * 0.5];
  const TR: [number, number] = [s, -s * 0.5];
  const BL: [number, number] = [-s, s * 0.5];
  const BR: [number, number] = [s, s * 0.5];
  const ML: [number, number] = [-s, 0];
  const MR: [number, number] = [s, 0];
  switch (n) {
    case 1:
      return [C];
    case 2:
      return [TL, BR];
    case 3:
      return [TL, C, BR];
    case 4:
      return [TL, TR, BL, BR];
    case 5:
      return [TL, TR, C, BL, BR];
    default:
      return [TL, TR, ML, MR, BL, BR];
  }
}

/** Compact label so it fits under a die. */
function shortLabel(label: string): string {
  const cleaned = label.replace(/\s*\(.*\)\s*/, "").trim();
  return cleaned.length > 18 ? cleaned.slice(0, 17) + "…" : cleaned;
}
