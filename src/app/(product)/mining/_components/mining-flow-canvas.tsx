// Mining Flow Canvas — institutional control-room diagram of the physical
// value chain: Mining Power → Pool → BTC Production → Reserve →
// Electricity Coverage. Pure SVG + CSS keyframes (mining.css) — no Canvas2D,
// no external animation library, no particles/glow. Renders synchronously
// (no client fetch, no layout measurement) so it never blocks first paint;
// motion is CSS-driven and respects `prefers-reduced-motion` for free
// (handled entirely in mining.css, not here).
//
// Accessibility: the SVG is `aria-hidden` and paired with a sr-only text
// summary carrying the same values, so no insight is animation/color-only
// (non-negotiable — see mission brief + CLAUDE.md WCAG AA charter).

import { cn } from "@/lib/cn";

export interface MiningFlowStage {
  id: "power" | "pool" | "production" | "reserve" | "electricity";
  label: string;
  shortLabel: string;
  value: string | null;
  /** Stage has real data flowing through it — drives the dash animation and
   *  node emphasis (works for FIXTURE data too, this is a structural signal). */
  active: boolean;
  /** Strictly `status === "LIVE"` — the ONLY thing allowed to render the
   *  accent green. Never true for fixture/demo data, even when `active`. */
  isLive: boolean;
}

interface MiningFlowCanvasProps {
  stages: MiningFlowStage[];
  fleetActive: boolean | null;
  curtailed: boolean | null;
  summaryText: string;
  className?: string;
}

const STAGE_X = [40, 190, 340, 490, 640] as const;
const NODE_Y = 60;
const VIEW_W = 680;
const VIEW_H = 130;

export function MiningFlowCanvas({
  stages,
  fleetActive,
  curtailed,
  summaryText,
  className,
}: MiningFlowCanvasProps) {
  const fleetActiveAttr = fleetActive === false ? "false" : "true";

  return (
    <div
      className={cn("mining-flow-container", className)}
    >
      <div
        className="mining-flow-canvas"
        data-fleet-active={fleetActiveAttr}
      >
        <svg
          className="mining-flow-canvas__svg"
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-hidden="true"
          focusable="false"
        >
          {/* Connectors, drawn first so nodes sit above them */}
          {STAGE_X.slice(0, -1).map((x, i) => {
            const nextX = STAGE_X[i + 1];
            if (nextX == null) return null;
            const bothActive = stages[i]?.active && stages[i + 1]?.active;
            return (
              <line
                key={`edge-${i}`}
                x1={x + 26}
                y1={NODE_Y}
                x2={nextX - 26}
                y2={NODE_Y}
                stroke="var(--ct-border-soft)"
                strokeWidth={2}
                className={cn(bothActive && "mining-flow-edge__dash")}
              />
            );
          })}

          {/* Nodes */}
          {stages.map((stage, i) => {
            const x = STAGE_X[i];
            if (x == null) return null;
            return (
              <g key={stage.id}>
                <circle
                  cx={x}
                  cy={NODE_Y}
                  r={22}
                  fill="var(--ct-surface-inset)"
                  stroke={
                    stage.isLive
                      ? "var(--ct-accent)"
                      : stage.active
                        ? "var(--ct-text-muted)"
                        : "var(--ct-border-soft)"
                  }
                  strokeWidth={2}
                />
                <circle
                  cx={x}
                  cy={NODE_Y}
                  r={5}
                  fill={
                    stage.isLive
                      ? "var(--ct-accent)"
                      : stage.active
                        ? "var(--ct-text-strong)"
                        : "var(--ct-text-faint)"
                  }
                  className={cn(stage.active && "mining-flow-node__pulse")}
                />
                <text
                  x={x}
                  y={NODE_Y + 44}
                  textAnchor="middle"
                  fill="var(--ct-text-muted)"
                  fontSize="11"
                  fontFamily="var(--font-sans, inherit)"
                >
                  {stage.shortLabel}
                </text>
                {stage.value ? (
                  <text
                    x={x}
                    y={NODE_Y - 34}
                    textAnchor="middle"
                    fill="var(--ct-text-strong)"
                    fontSize="12"
                    fontWeight={600}
                    fontFamily="var(--font-sans, inherit)"
                  >
                    {stage.value}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>

        {curtailed ? (
          <p className="body-xs ct-text-muted mt-[var(--ct-space-2)] text-center">
            Fleet output currently curtailed — flow paused, no output lost from
            the ledger.
          </p>
        ) : null}
      </div>

      {/* Text equivalent — every value the diagram encodes, readable without
          the SVG/animation/color. Screen readers get this instead of the
          aria-hidden graphic. */}
      <p className="sr-only">{summaryText}</p>
    </div>
  );
}
