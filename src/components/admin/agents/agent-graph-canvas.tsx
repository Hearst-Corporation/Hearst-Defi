"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import type {
  AgentGraph,
  AgentGraphNode,
  GraphNodeState,
} from "@/lib/data/agent-graph";

/**
 * Live orchestration graph of the agents.
 *
 * Nodes (data sources → LLM agents → outputs) are wired by their real Inngest
 * edges. Particles flow along "hot" edges (target ran recently); nodes pulse by
 * live state. The graph auto-refreshes by polling /api/admin/agents/graph, and
 * clicking a node opens a runtime detail panel (recent runs, latency, cost,
 * errors). Pure presentational + a poll loop; respects prefers-reduced-motion.
 */

interface RGB { r: number; g: number; b: number; }
const STATE_COLOR: Record<GraphNodeState, RGB> = {
  active: { r: 167, g: 251, b: 144 }, // #A7FB90 accent
  idle: { r: 122, g: 134, b: 154 },
  failed: { r: 232, g: 90, b: 90 },
};
const rgba = (c: RGB, a: number) => `rgba(${c.r},${c.g},${c.b},${a})`;

const POLL_MS = 5_000;

interface Placed extends AgentGraphNode {
  x: number;
  y: number;
  r: number;
}

export function AgentGraphCanvas({ initialGraph }: { initialGraph: AgentGraph }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [graph, setGraph] = useState<AgentGraph>(initialGraph);
  const [selected, setSelected] = useState<string | null>(null);
  const graphRef = useRef(graph);
  graphRef.current = graph;
  const placedRef = useRef<Placed[]>([]);

  // Auto-refresh: poll the live graph (paused when the tab is hidden).
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await fetch("/api/admin/agents/graph", { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as AgentGraph;
        if (!cancelled && Array.isArray(next.nodes)) setGraph(next);
      } catch {
        /* transient — keep last graph */
      }
    };
    const id = setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Canvas render loop (layout + edges + particles + nodes).
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
    let width = 0;
    let height = 0;

    const layout = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const nodes = graphRef.current.nodes;
      const cols = Math.max(1, ...nodes.map((n) => n.column + 1));
      const padX = 70;
      const padY = 34;
      const colGap = (width - padX * 2) / Math.max(1, cols - 1);
      const byCol = new Map<number, AgentGraphNode[]>();
      for (const n of nodes) {
        const arr = byCol.get(n.column) ?? [];
        arr.push(n);
        byCol.set(n.column, arr);
      }
      placedRef.current = nodes.map((n) => {
        const colNodes = byCol.get(n.column) ?? [n];
        const idx = colNodes.indexOf(n);
        const rows = colNodes.length;
        const rowGap = (height - padY * 2) / Math.max(1, rows);
        const x = padX + n.column * colGap;
        const y = padY + rowGap * (idx + 0.5);
        return { ...n, x, y, r: Math.max(16, Math.min(26, width / 36)) };
      });
    };

    const nodeById = (id: string) => placedRef.current.find((p) => p.id === id);

    const frame = (ms: number) => {
      const t = ms / 1000;
      ctx.clearRect(0, 0, width, height);
      const g = graphRef.current;

      // Edges (curved) + flowing particles on hot edges.
      for (const e of g.edges) {
        const a = nodeById(e.from);
        const b = nodeById(e.to);
        if (!a || !b) continue;
        const midX = (a.x + b.x) / 2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.bezierCurveTo(midX, a.y, midX, b.y, b.x, b.y);
        ctx.strokeStyle = e.hot
          ? rgba(STATE_COLOR.active, 0.4)
          : "rgba(255,255,255,0.08)";
        ctx.lineWidth = e.hot ? 1.6 : 1;
        ctx.stroke();

        if (e.hot && !reduceMotion) {
          for (let k = 0; k < 3; k++) {
            const p = ((t * 0.4 + k / 3) % 1);
            const pt = bezier(a.x, a.y, midX, a.y, midX, b.y, b.x, b.y, p);
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 2.2, 0, Math.PI * 2);
            ctx.fillStyle = rgba(STATE_COLOR.active, 0.9 * (1 - p) + 0.2);
            ctx.fill();
          }
        }
      }

      // Nodes: glow + disc + pulse + label.
      for (const n of placedRef.current) {
        const color = STATE_COLOR[n.state];
        const active = n.state === "active";
        const pulse = active && !reduceMotion ? 1 + Math.sin(t * 3) * 0.08 : 1;
        const r = n.r * pulse;
        const isSel = selected === n.id;

        const glow = ctx.createRadialGradient(n.x, n.y, r * 0.3, n.x, n.y, r * 2.4);
        glow.addColorStop(0, rgba(color, active ? 0.34 : 0.16));
        glow.addColorStop(1, rgba(color, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 2.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = rgba(color, n.kind === "agent" ? 0.22 : 0.12);
        ctx.fill();
        ctx.lineWidth = isSel ? 2.5 : 1.4;
        ctx.strokeStyle = rgba(color, isSel ? 1 : 0.7);
        ctx.stroke();

        // kind glyph: source ◆, agent ●, output ▮
        ctx.fillStyle = rgba(color, 0.95);
        ctx.font = "600 11px ui-sans-serif, system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(n.kind === "source" ? "◆" : n.kind === "output" ? "▮" : "●", n.x, n.y);

        ctx.fillStyle = "rgba(255,255,255,0.78)";
        ctx.font = "500 10px ui-sans-serif, system-ui";
        ctx.textBaseline = "top";
        ctx.fillText(n.label, n.x, n.y + r + 5);
      }

      raf = window.requestAnimationFrame(frame);
    };

    layout();
    raf = window.requestAnimationFrame(frame);
    const onResize = () => layout();
    window.addEventListener("resize", onResize);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [selected]);

  // Re-layout when the graph node set changes (poll result).
  useEffect(() => {
    window.dispatchEvent(new Event("resize"));
  }, [graph.nodes.length]);

  const onCanvasClick = useCallback((ev: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = ev.clientX - rect.left;
    const my = ev.clientY - rect.top;
    const hit = placedRef.current.find(
      (p) => Math.hypot(p.x - mx, p.y - my) <= p.r + 4,
    );
    setSelected(hit ? hit.id : null);
  }, []);

  const selectedNode = graph.nodes.find((n) => n.id === selected) ?? null;

  return (
    <div className="grid gap-[var(--ct-space-4)] lg:grid-cols-[1fr_280px]">
      <canvas
        ref={canvasRef}
        onClick={onCanvasClick}
        className="block h-[clamp(280px,40vw,420px)] w-full cursor-pointer"
        role="img"
        aria-label="Live agent orchestration graph — click a node for runtime detail"
      />
      <RuntimePanel node={selectedNode} onClear={() => setSelected(null)} />
    </div>
  );
}

function RuntimePanel({
  node,
  onClear,
}: {
  node: AgentGraphNode | null;
  onClear: () => void;
}) {
  if (!node) {
    return (
      <div className="rounded-lg border border-(--ct-border-soft) ct-surface-1 p-[var(--ct-space-4)] body-xs ct-text-muted">
        Clique un nœud pour voir son runtime (derniers runs, latence, coût,
        erreurs).
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-(--ct-border-soft) ct-surface-1 p-[var(--ct-space-4)] admin-doc-stack admin-doc-stack--tight">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="body-sm ct-text-strong m-0">{node.label}</p>
          <p className="body-[10px] uppercase tracking-wide ct-text-faint">
            {node.kind} · {node.state}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="body-xs ct-text-muted hover:ct-text-strong"
          aria-label="Clear selection"
        >
          ✕
        </button>
      </div>
      <div className="body-xs ct-text-muted">
        {node.agentName
          ? `${node.recentRuns} run(s) · 24 h`
          : "Surface non-LLM (orchestration / sortie)"}
      </div>
      {node.samples.length > 0 ? (
        <div className="admin-doc-stack admin-doc-stack--tight">
          {node.samples.map((s, i) => (
            <div
              key={`${s.atIso}-${i}`}
              className="flex items-center justify-between gap-2 border-b border-(--ct-border-soft) py-1 last:border-0 body-xs"
            >
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 body-[10px] uppercase",
                  s.status === "success"
                    ? "ct-status-success"
                    : s.status === "failed" || s.status === "timeout"
                      ? "ct-status-danger"
                      : "ct-text-muted",
                )}
              >
                {s.status}
              </span>
              <span className="ct-text-faint">
                {s.latencyMs != null ? `${s.latencyMs} ms` : "—"}
                {s.costUsd != null ? ` · $${s.costUsd.toFixed(4)}` : ""}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="body-xs ct-text-faint">Aucun run récent.</p>
      )}
    </div>
  );
}

/** Cubic-bezier point at parameter `p`. */
function bezier(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
  p: number,
): { x: number; y: number } {
  const u = 1 - p;
  const a = u * u * u;
  const b = 3 * u * u * p;
  const c = 3 * u * p * p;
  const d = p * p * p;
  return {
    x: a * x0 + b * x1 + c * x2 + d * x3,
    y: a * y0 + b * y1 + c * y2 + d * y3,
  };
}
