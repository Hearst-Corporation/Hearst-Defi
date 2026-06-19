"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import type {
  AgentGraphNode,
  AgentGraphView,
  AgentGraphViews,
  AgentGraphViewId,
  GraphNodeKind,
  GraphNodeState,
  NodeBindingKind,
} from "@/lib/data/agent-graph";

/**
 * Live, multi-view orchestration graph of the agents.
 *
 * Tabs switch between views (orchestration / master-agent / instruments). In
 * each, nodes are wired by their real edges; particles flow along "hot" edges
 * (target ran recently); bound nodes pulse by live state while static wiring
 * stays neutral. Auto-refreshes by polling /api/admin/agents/graph; clicking a
 * node opens a runtime detail panel (provenance, recent runs, latency, cost,
 * errors). Pure presentational + a poll loop; respects prefers-reduced-motion.
 */

interface RGB { r: number; g: number; b: number; }
const STATE_COLOR: Record<GraphNodeState, RGB> = {
  active: { r: 167, g: 251, b: 144 }, // #A7FB90 accent
  idle: { r: 122, g: 134, b: 154 },
  failed: { r: 232, g: 90, b: 90 },
  static: { r: 96, g: 110, b: 140 },
};
const rgba = (c: RGB, a: number) => `rgba(${c.r},${c.g},${c.b},${a})`;

/** Kind glyph drawn at a node's center. */
const KIND_GLYPH: Record<GraphNodeKind, string> = {
  source: "◆",
  agent: "●",
  tool: "▲",
  guard: "◇",
  method: "○",
  output: "▮",
};

const BINDING_LABEL: Record<NodeBindingKind, string> = {
  llm: "LlmRun · live",
  tool: "AdminToolRun · live",
  "tool-group": "AdminToolRun · live (aggregate)",
  static: "Static wiring",
};

const POLL_MS = 5_000;

interface Placed extends AgentGraphNode {
  x: number;
  y: number;
  r: number;
}

export function AgentGraphCanvas({ initialViews }: { initialViews: AgentGraphViews }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [views, setViews] = useState<AgentGraphView[]>(initialViews.views);
  const [activeViewId, setActiveViewId] = useState<AgentGraphViewId>(
    initialViews.views[0]?.id ?? "orchestration",
  );
  const [selected, setSelected] = useState<string | null>(null);

  const activeView = useMemo(
    () => views.find((v) => v.id === activeViewId) ?? views[0] ?? null,
    [views, activeViewId],
  );

  const viewRef = useRef<AgentGraphView | null>(activeView);
  viewRef.current = activeView;
  const placedRef = useRef<Placed[]>([]);

  // Auto-refresh: poll the live graph (paused when the tab is hidden).
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await fetch("/api/admin/agents/graph", { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as AgentGraphViews;
        if (!cancelled && Array.isArray(next.views)) setViews(next.views);
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

  // Clear selection when switching views (ids differ across views).
  useEffect(() => {
    setSelected(null);
  }, [activeViewId]);

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

      const nodes = viewRef.current?.nodes ?? [];
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
        return { ...n, x, y, r: Math.max(13, Math.min(24, width / 42)) };
      });
    };

    const nodeById = (id: string) => placedRef.current.find((p) => p.id === id);

    const frame = (ms: number) => {
      const t = ms / 1000;
      ctx.clearRect(0, 0, width, height);
      const g = viewRef.current;
      if (!g) {
        raf = window.requestAnimationFrame(frame);
        return;
      }

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
        glow.addColorStop(0, rgba(color, active ? 0.34 : n.state === "static" ? 0.08 : 0.16));
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
        // Tools that require confirmation (HITL write) get a dashed ring.
        if (n.confirmationRequired) ctx.setLineDash([3, 3]);
        ctx.strokeStyle = rgba(color, isSel ? 1 : 0.7);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = rgba(color, 0.95);
        ctx.font = "600 11px ui-sans-serif, system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(KIND_GLYPH[n.kind], n.x, n.y);

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
  }, [selected, activeViewId]);

  // Re-layout when the active view or its node set changes (tab switch / poll).
  useEffect(() => {
    window.dispatchEvent(new Event("resize"));
  }, [activeViewId, activeView?.nodes.length]);

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

  const selectedNode = activeView?.nodes.find((n) => n.id === selected) ?? null;

  return (
    <div className="admin-doc-stack admin-doc-stack--tight">
      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Agent graph views"
        className="flex flex-wrap gap-[var(--ct-space-2)]"
      >
        {views.map((v) => {
          const isActive = v.id === activeViewId;
          return (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveViewId(v.id)}
              className={cn(
                "rounded-full border px-[var(--ct-space-3)] py-[var(--ct-space-1)] body-xs ct-transition-base",
                isActive
                  ? "border-(--ct-border-accent) bg-(--ct-accent-soft) ct-text-accent"
                  : "border-(--ct-border-soft) ct-text-muted hover:ct-text-strong",
              )}
            >
              {v.label}
            </button>
          );
        })}
      </div>

      {activeView && (
        <p className="body-xs ct-text-muted">{activeView.description}</p>
      )}

      <div className="grid gap-[var(--ct-space-4)] lg:grid-cols-[1fr_300px]">
        <canvas
          ref={canvasRef}
          onClick={onCanvasClick}
          className="block h-[clamp(300px,42vw,460px)] w-full cursor-pointer"
          role="img"
          aria-label={`${activeView?.label ?? "Agent"} graph — click a node for runtime detail`}
        />
        <RuntimePanel node={selectedNode} onClear={() => setSelected(null)} />
      </div>
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
        Click a node to see its provenance + runtime (recent runs, latency, cost,
        errors).
      </div>
    );
  }
  const isLive = node.bindingKind !== "static";
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

      {node.description && (
        <p className="body-xs ct-text-muted">{node.description}</p>
      )}

      {/* Provenance + tool meta */}
      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-full border border-(--ct-border-soft) px-1.5 py-0.5 body-[10px] uppercase ct-text-faint">
          {BINDING_LABEL[node.bindingKind]}
        </span>
        {node.riskLevel && (
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 body-[10px] uppercase",
              node.riskLevel === "high"
                ? "ct-status-danger"
                : node.riskLevel === "medium"
                  ? "ct-status-warning"
                  : "ct-text-muted",
            )}
          >
            {node.riskLevel} risk
          </span>
        )}
        {node.confirmationRequired && (
          <span className="rounded-full border border-(--ct-border-accent) px-1.5 py-0.5 body-[10px] uppercase ct-text-accent">
            HITL · confirm
          </span>
        )}
      </div>

      {!isLive ? (
        <p className="body-xs ct-text-faint">
          Structural wiring / method — no own telemetry (never lit as Live).
        </p>
      ) : (
        <>
          <div className="body-xs ct-text-muted">{node.recentRuns} run(s) · 24 h</div>
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
                          : s.status === "blocked"
                            ? "ct-status-warning"
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
            <p className="body-xs ct-text-faint">No recent runs.</p>
          )}
        </>
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
