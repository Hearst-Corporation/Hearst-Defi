// StrategyFlowCanvas — Capital → Mining Power / Bitcoin Reserve / Operating Reserve
// → Bitcoin accumulated. Animated SVG flux, compact (240–320px desktop).

import { cn } from "@/lib/cn";
import type { AllocationPocketViewModel } from "@/features/investor-ui/types/dashboard";

const POCKET_LABELS: Record<string, string> = {
  B1: "Mining Power",
  B2: "Bitcoin Reserve",
  B3: "Operating Reserve",
};

interface StrategyFlowCanvasProps {
  pockets: readonly AllocationPocketViewModel[] | null;
  btcAccumulated: string | null;
  miningActive: boolean;
  className?: string;
}

const VIEW_W = 520;
const VIEW_H = 200;

export function StrategyFlowCanvas({
  pockets,
  btcAccumulated,
  miningActive,
  className,
}: StrategyFlowCanvasProps) {
  const b1 = pockets?.find((p) => p.pocket === "B1");
  const b2 = pockets?.find((p) => p.pocket === "B2");
  const b3 = pockets?.find((p) => p.pocket === "B3");

  const branches = [
    { x: 130, label: POCKET_LABELS.B1, pct: b1?.targetBps, sub: "→ BTC produced", active: miningActive },
    { x: 260, label: POCKET_LABELS.B2, pct: b2?.targetBps, sub: "→ BTC held", active: true },
    { x: 390, label: POCKET_LABELS.B3, pct: b3?.targetBps, sub: "→ Electricity + protection", active: true },
  ] as const;

  const summary = [
    "Capital allocated splits across three strategy pockets.",
    b1 ? `${POCKET_LABELS.B1} ${(b1.targetBps / 100).toFixed(0)}%` : null,
    b2 ? `${POCKET_LABELS.B2} ${(b2.targetBps / 100).toFixed(0)}%` : null,
    b3 ? `${POCKET_LABELS.B3} ${(b3.targetBps / 100).toFixed(0)}%` : null,
    btcAccumulated ? `Bitcoin accumulated: ${btcAccumulated}` : null,
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <div className={cn("iw-strategy-flow iw-surface-primary p-[var(--ct-space-4)]", className)}>
      <div className="mb-[var(--ct-space-2)] flex items-center justify-between gap-[var(--ct-space-2)]">
        <span className="stat-label ct-text-muted">Strategy flow</span>
        <span className="body-xs ct-text-faint">Capital → accumulation</span>
      </div>
      <svg
        className="iw-strategy-flow__svg"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        {/* Capital source */}
        <rect
          x={VIEW_W / 2 - 44}
          y={12}
          width={88}
          height={28}
          rx={6}
          fill="var(--ct-surface-inset)"
          stroke="var(--ct-border-soft)"
        />
        <text
          x={VIEW_W / 2}
          y={30}
          textAnchor="middle"
          className="iw-strategy-flow__node-value"
          fill="var(--ct-text-strong)"
        >
          Capital
        </text>

        {/* Convergence target */}
        <circle
          cx={VIEW_W / 2}
          cy={VIEW_H - 28}
          r={22}
          fill="var(--ct-surface-inset)"
          stroke={miningActive ? "var(--ct-accent)" : "var(--ct-border-soft)"}
          strokeWidth={1.5}
        />
        <text
          x={VIEW_W / 2}
          y={VIEW_H - 24}
          textAnchor="middle"
          fontSize="14"
          fontWeight="700"
          fill="var(--ct-text-strong)"
        >
          ₿
        </text>
        <text
          x={VIEW_W / 2}
          y={VIEW_H - 4}
          textAnchor="middle"
          className="iw-strategy-flow__node-label"
        >
          BTC accumulated
        </text>
        {btcAccumulated ? (
          <text
            x={VIEW_W / 2}
            y={VIEW_H + 12}
            textAnchor="middle"
            className="iw-strategy-flow__node-value"
          >
            {btcAccumulated}
          </text>
        ) : null}

        {branches.map((b) => (
          <g key={b.label}>
            <path
              d={`M ${VIEW_W / 2} 40 Q ${b.x} 80 ${b.x} 100`}
              className={cn("iw-strategy-flow__edge", b.active && "iw-strategy-flow__edge--active")}
            />
            <path
              d={`M ${b.x} 120 Q ${b.x} 150 ${VIEW_W / 2} ${VIEW_H - 50}`}
              className={cn("iw-strategy-flow__edge", b.active && "iw-strategy-flow__edge--active")}
            />
            <rect
              x={b.x - 52}
              y={100}
              width={104}
              height={36}
              rx={6}
              fill="var(--ct-surface-inset)"
              stroke="var(--ct-border-soft)"
            />
            <text x={b.x} y={116} textAnchor="middle" className="iw-strategy-flow__node-value">
              {b.label}
            </text>
            <text x={b.x} y={130} textAnchor="middle" className="iw-strategy-flow__node-label">
              {b.pct != null ? `${(b.pct / 100).toFixed(0)}%` : "—"} · {b.sub}
            </text>
          </g>
        ))}
      </svg>
      <p className="sr-only">{summary}</p>
    </div>
  );
}
