// AccumulationFlowCanvas — Mining-generated + Strategic exposure = Total BTC.

import { cn } from "@/lib/cn";

interface AccumulationFlowCanvasProps {
  miningBtc: string | null;
  strategicBtc: string | null;
  totalBtc: string | null;
  className?: string;
}

export function AccumulationFlowCanvas({
  miningBtc,
  strategicBtc,
  totalBtc,
  className,
}: AccumulationFlowCanvasProps) {
  const summary = [
    miningBtc ? `Mining-generated BTC: ${miningBtc}` : null,
    strategicBtc ? `Strategic BTC exposure: ${strategicBtc}` : null,
    totalBtc ? `Total BTC accumulated: ${totalBtc}` : null,
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <div className={cn("iw-strategy-flow iw-surface-primary p-[var(--ct-space-4)]", className)}>
      <span className="stat-label ct-text-muted">Accumulation sources</span>
      <svg
        className="iw-strategy-flow__svg mt-[var(--ct-space-3)]"
        viewBox="0 0 480 140"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        <g>
          <rect x={24} y={40} width={120} height={44} rx={8} fill="var(--ct-surface-inset)" stroke="var(--ct-border-soft)" />
          <text x={84} y={58} textAnchor="middle" className="iw-strategy-flow__node-value" fill="var(--ct-text-strong)">
            Mining
          </text>
          <text x={84} y={74} textAnchor="middle" className="iw-strategy-flow__node-label">
            {miningBtc ?? "—"}
          </text>

          <rect x={180} y={40} width={120} height={44} rx={8} fill="var(--ct-surface-inset)" stroke="var(--ct-border-soft)" />
          <text x={240} y={58} textAnchor="middle" className="iw-strategy-flow__node-value" fill="var(--ct-text-strong)">
            Strategic
          </text>
          <text x={240} y={74} textAnchor="middle" className="iw-strategy-flow__node-label">
            {strategicBtc ?? "—"}
          </text>

          <text x={168} y={68} textAnchor="middle" fontSize="18" fill="var(--ct-text-muted)">
            +
          </text>

          <path d="M 84 84 Q 84 100 240 100" className="iw-strategy-flow__edge iw-strategy-flow__edge--active" />
          <path d="M 240 84 L 240 100" className="iw-strategy-flow__edge iw-strategy-flow__edge--active" />

          <circle cx={240} cy={118} r={18} fill="var(--ct-surface-inset)" stroke="var(--ct-accent)" strokeWidth={1.5} />
          <text x={240} y={123} textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--ct-text-strong)">
            ₿
          </text>
          <text x={360} y={122} className="iw-strategy-flow__node-value">
            {totalBtc ?? "—"} total
          </text>
        </g>
      </svg>
      <p className="sr-only">{summary}</p>
    </div>
  );
}
