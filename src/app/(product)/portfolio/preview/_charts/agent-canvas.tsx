/**
 * AgentCanvas — the orchestration graph for the /portfolio/preview sandbox.
 *
 * The real deterministic rebalancing engine (src/lib/inngest/functions/rebalancing-signal.ts —
 * Chainlink-fed, rules R1–R5 + R-BTC-1..6, NO LLM) sits at the centre; the four real advisory agents
 * (Margin / Risk / Electricity / Take-Profit, = SIGNALS[0..3]) plus the oracle inlet feed it (pips flow
 * IN), and it emits exactly ONE pending proposal OUT to a human / multisig gate. Motion is CSS-only
 * stroke-dashoffset on normalized (pathLength=100) connectors, so every pip glides at the same visual
 * speed regardless of edge length. Nothing auto-executes: agents OBSERVE, the engine EVALUATES, a human
 * GATE executes (ADR-012 / ADR-017). Advisory · deterministic · simulated (sandbox). Green (accent) is
 * reserved for the one genuinely-Live oracle heartbeat; amber = review (never red). Token-only (consumes
 * --ct-*, edits none). Server component — no state/effects/handlers, every motion is a keyframe and the
 * only per-node dynamism (animationDelay) is a static inline style emitted at render. Mirrors sibling
 * _charts/* JSDoc.
 */
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";

import type {
  OrchestrationDecision,
  OrchestrationEdge,
  OrchestrationNode,
  OrchestrationSeverity,
} from "../_data/mock";

/** Severity → token. green = health/Live (resolves to accent), amber = review, info = neutral blue.
 *  Record over the full literal union → indexing is total (no possibly-undefined). No red here. */
const SEV: Record<OrchestrationSeverity, string> = {
  green: "var(--ct-status-success)",
  amber: "var(--ct-status-warning)",
  info: "var(--ct-status-info)",
};

interface AgentCanvasProps {
  readonly nodes: readonly OrchestrationNode[];
  readonly edges: readonly OrchestrationEdge[];
  readonly latest: OrchestrationDecision;
}

/** One node's glyph: engine = neutral deterministic core, oracle = the sole Live pulse, gate = an
 *  outlined stop (a proposal, not a "go"), agent = a severity dot (amber breathes to draw the eye).
 *  Each dot's glow (--ct-glow-dot = 0 0 10px currentColor) is tinted to its own colour via `color`. */
function NodeGlyph({ node }: { node: OrchestrationNode }) {
  const color = SEV[node.severity];

  if (node.kind === "engine") {
    return (
      <span
        aria-hidden
        className="hyv-breathe grid h-8 w-8 place-items-center rounded-[9px] border border-[var(--ct-border)] bg-[var(--ct-surface-inset)]"
        style={{ animationDelay: "400ms" }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--ct-text-secondary)" }}
        />
      </span>
    );
  }

  if (node.kind === "gate") {
    return (
      <span
        aria-hidden
        className="block h-3.5 w-3.5 rotate-45 rounded-[3px] border"
        style={{ borderColor: "var(--ct-border)", background: "var(--ct-surface-inset)" }}
      />
    );
  }

  // oracle = the one genuinely-Live surface (hyv-pulse, accent); agent = static dot, amber breathes.
  const live = node.kind === "oracle";
  const breathe = !live && node.severity === "amber";
  const dot = live ? "var(--ct-accent)" : color;
  return (
    <span
      aria-hidden
      className={cn("inline-block h-2 w-2 rounded-full", live && "hyv-pulse", breathe && "hyv-breathe")}
      style={{ background: dot, color: dot, boxShadow: "var(--ct-glow-dot)" }}
    />
  );
}

export function AgentCanvas({ nodes, edges, latest }: AgentCanvasProps) {
  const byId = new Map(nodes.map((n) => [n.id, n] as const));

  return (
    <div className="flex flex-1 flex-col">
      {/* ── graph body (fills the card's stretch) ── */}
      <div
        role="img"
        aria-label={`Orchestration graph — ${nodes.length} nodes observing and feeding a deterministic engine that emits one pending proposal to a human multisig gate. Advisory, simulated.`}
        className="relative min-h-[220px] flex-1"
      >
        {/* connectors (SVG; pips travel via stroke-dashoffset). preserveAspectRatio="none" makes the
            0–100 viewBox map 1:1 to the node %-positions below, so endpoints always meet the HTML dots. */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
          focusable="false"
        >
          {edges.map((e) => {
            const a = byId.get(e.from);
            const b = byId.get(e.to); // both guarded (noUncheckedIndexedAccess)
            if (!a || !b) return null;
            const stroke = e.dir === "out" ? "var(--ct-status-info)" : SEV[a.severity];
            return (
              <g key={`${e.from}-${e.to}`}>
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="var(--ct-border-soft)"
                  strokeWidth={0.6}
                  vectorEffect="non-scaling-stroke"
                />
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  pathLength={100}
                  stroke={stroke}
                  strokeWidth={1.4}
                  strokeLinecap="round"
                  strokeDasharray="3 97"
                  vectorEffect="non-scaling-stroke"
                  className={e.dir === "out" ? "hyv-flow-out" : "hyv-flow-in"}
                  style={{ animationDelay: `${e.delayMs}ms`, opacity: 0.9 }}
                />
              </g>
            );
          })}
        </svg>

        {/* nodes (HTML over SVG so labels use ct-* typography, never SVG <text>) */}
        {nodes.map((n) => (
          <div
            key={n.id}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 text-center"
            style={{ left: `${n.x}%`, top: `${n.y}%` }}
          >
            <NodeGlyph node={n} />
            <span className="ct-metric-caption whitespace-nowrap text-[length:var(--ct-text-nano)] leading-none">
              {n.label}
            </span>
          </div>
        ))}
      </div>

      {/* ── latest decision (footer) — advisory, held, never executed ── */}
      <div className="flex items-start gap-2 border-t border-[var(--ct-border-soft)] px-5 py-3">
        <span
          aria-hidden
          className="hyv-breathe mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: "var(--ct-status-warning)" }}
        />
        <span className="ct-metric-caption min-w-0 flex-1 text-[length:var(--ct-text-nano)] leading-snug">
          <span className="ct-text-body">{latest.agent}</span> — {latest.action}{" "}
          <span className="ct-text-muted">Held for multisig · never auto-executed.</span>
        </span>
        <ProvenanceBadge kind={latest.provenance} variant="compact" />
      </div>
    </div>
  );
}
