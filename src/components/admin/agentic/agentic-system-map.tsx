// Admin · Agentic Control Center — Visual System Map (Layer 1, presentational).
//
// READ-ONLY. The first-layer "live map": the agentic system rendered as layered
// clusters of connected nodes (router / guards / crews / agents / tools / gates /
// observability), with status / mode / risk badges, live metrics, and the wiring
// between them (routes / reads / guards / gates / observes / composes / forbids).
// NO write controls, NO action buttons, NO run/send/deploy/source — nothing here
// executes. Pure component; all data passed in, unit-testable via SSR.

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type {
  AgenticSystemEdge,
  AgenticSystemEdgeKind,
  AgenticSystemMap,
  AgenticSystemNode,
  AgenticSystemNodeMode,
  AgenticSystemNodeStatus,
  AgenticSystemRisk,
} from "@/lib/agentic/system-map/types";

type Tone = "success" | "warning" | "danger" | "default" | "accent";

function statusTone(status: AgenticSystemNodeStatus): Tone {
  switch (status) {
    case "healthy":
      return "success";
    case "watch":
      return "warning";
    case "alert":
      return "danger";
    case "planned":
    case "disabled":
    case "no_data":
    default:
      return "default";
  }
}

const MODE_LABEL: Record<AgenticSystemNodeMode, string> = {
  read_only: "read-only",
  draft: "draft",
  confirmed_write: "confirmed-write",
  forbidden: "forbidden",
  control: "control",
  observe: "observe",
};

function modeTone(mode: AgenticSystemNodeMode): Tone {
  switch (mode) {
    case "read_only":
    case "observe":
      return "accent";
    case "draft":
    case "confirmed_write":
      return "warning";
    case "forbidden":
      return "danger";
    case "control":
    default:
      return "default";
  }
}

function riskTone(risk: AgenticSystemRisk): Tone {
  switch (risk) {
    case "critical":
    case "high":
      return "danger";
    case "medium":
      return "warning";
    default:
      return "default";
  }
}

const EDGE_LABEL: Record<AgenticSystemEdgeKind, string> = {
  routes: "routes",
  reads: "reads",
  guards: "guards",
  gates: "gates",
  observes: "observes",
  composes: "composes",
  forbids: "forbids",
};

/** A single node card in a cluster. */
function NodeCard({
  node,
  outgoing,
  labelById,
}: {
  node: AgenticSystemNode;
  outgoing: AgenticSystemEdge[];
  labelById: Map<string, string>;
}) {
  const inner = (
    <>
      <div className="admin-doc-inline-row admin-doc-inline-row--start admin-doc-inline-row--tight">
        <span
          className={cn("agentic-map-status-dot")}
          data-status={node.status}
          aria-hidden
        />
        <span className="body-sm ct-text-strong flex-1">{node.label}</span>
        <Badge variant={statusTone(node.status)}>{node.status}</Badge>
      </div>
      <p className="body-xs ct-text-muted">{node.summary}</p>
      <div className="admin-doc-inline-row admin-doc-inline-row--start admin-doc-inline-row--tight flex-wrap">
        <Badge variant={modeTone(node.mode)}>{MODE_LABEL[node.mode]}</Badge>
        <Badge variant={riskTone(node.risk)}>risk: {node.risk}</Badge>
      </div>
      {node.metrics && node.metrics.length > 0 && (
        <div className="admin-doc-inline-row admin-doc-inline-row--start admin-doc-inline-row--tight flex-wrap">
          {node.metrics.map((m) => (
            <span key={m.label} className="agentic-map-metric">
              <span className="ct-text-faint">{m.label}</span>{" "}
              <span className="ct-text-strong tabular-nums">{m.value}</span>
            </span>
          ))}
        </div>
      )}
      {outgoing.length > 0 && (
        <div className="agentic-map-wires">
          {outgoing.map((e) => (
            <span
              key={e.id}
              className="agentic-map-wire"
              data-kind={e.kind}
              title={`${node.label} ${EDGE_LABEL[e.kind]} ${labelById.get(e.to) ?? e.to}`}
            >
              {EDGE_LABEL[e.kind]} → {labelById.get(e.to) ?? e.to}
            </span>
          ))}
        </div>
      )}
    </>
  );

  // A node links to its detail anchor when it has one (read-only nav only),
  // otherwise it is a plain container. No component is created during render.
  if (node.detailHref) {
    return (
      <a
        href={node.detailHref}
        className="agentic-map-node"
        data-status={node.status}
        aria-label={`${node.label} — open details`}
      >
        {inner}
      </a>
    );
  }
  return (
    <div className="agentic-map-node" data-status={node.status}>
      {inner}
    </div>
  );
}

const EDGE_KINDS: AgenticSystemEdgeKind[] = [
  "routes",
  "reads",
  "observes",
  "guards",
  "gates",
  "composes",
  "forbids",
];

export function AgenticSystemMap({ map }: { map: AgenticSystemMap | null | undefined }) {
  if (!map) return null;

  const labelById = new Map(map.nodes.map((n) => [n.id, n.label]));
  const outgoingByNode = new Map<string, AgenticSystemEdge[]>();
  for (const e of map.edges) {
    const list = outgoingByNode.get(e.from) ?? [];
    list.push(e);
    outgoingByNode.set(e.from, list);
  }

  return (
    <section
      id="agentic-system-map"
      className="admin-doc-stack"
      aria-label="Agentic system map"
    >
      <div className="admin-doc-inline-row admin-doc-inline-row--start flex-wrap">
        <h2 className="h2 m-0">System Map</h2>
        <span className="flex-1" />
        <Badge variant="accent">live · read-only</Badge>
      </div>
      <p className="body-xs ct-text-muted">
        How the agentic system is wired — the deterministic router, the guards and
        HITL gates that bound it, the read-only crews and agents it routes to, the
        observability that watches it, and the tool tiers it can touch. Nothing
        here executes a tool; the connections describe wiring, not actions.
      </p>

      {/* Edge legend */}
      <div className="admin-doc-inline-row admin-doc-inline-row--start flex-wrap">
        <span className="stat-label ct-text-muted">Connections</span>
        {EDGE_KINDS.map((k) => (
          <span key={k} className="agentic-map-legend" data-kind={k}>
            {EDGE_LABEL[k]}
          </span>
        ))}
      </div>

      {/* Layered clusters */}
      <div className="agentic-map-grid">
        {map.groups.map((group) => {
          const groupNodes = map.nodes.filter((n) => n.group === group.id);
          return (
            <div key={group.id} className="agentic-map-cluster" aria-label={group.label}>
              <div className="agentic-map-cluster-head">
                <h3 className="h4 m-0">{group.label}</h3>
                <p className="body-xs ct-text-faint">{group.summary}</p>
              </div>
              <div className="agentic-map-cluster-body">
                {groupNodes.map((node) => (
                  <NodeCard
                    key={node.id}
                    node={node}
                    outgoing={outgoingByNode.get(node.id) ?? []}
                    labelById={labelById}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Safety notes */}
      <div className="admin-doc-stack admin-doc-stack--dense">
        {map.safetyNotes.map((n) => (
          <p key={n} className="body-xs ct-text-faint">
            · {n}
          </p>
        ))}
      </div>
    </section>
  );
}
