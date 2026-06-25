// Admin · Agentic Control Center — Detail Inspector (Layer 2, presentational).
//
// READ-ONLY. The second layer beneath the visual map: an overview that orients
// the admin, per-layer summaries derived from the map, and read-only jump-links
// into the detailed panels (observability, quality review, tool boundary,
// reporting crew, gates, prompts, inventory) that live below. NO write controls,
// NO action buttons. Pure component; all data passed in, unit-testable via SSR.

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type {
  AgenticSystemMap,
  AgenticSystemNodeStatus,
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
    default:
      return "default";
  }
}

/** Read-only jump-links into the preserved detail sections below the map. */
const DETAIL_LINKS: { href: string; label: string }[] = [
  { href: "#reporting-crew", label: "Reporting Crew" },
  { href: "#router-observability", label: "Router Observability" },
  { href: "#router-quality-review", label: "Quality Review" },
  { href: "#tool-boundary-v1", label: "Tool Boundary" },
  { href: "#human-gates", label: "Human Gates" },
  { href: "#compliance-guards", label: "Compliance / Guards" },
  { href: "#agents-inventory", label: "Agents & Crews" },
  { href: "#prompt-map", label: "Prompt Map" },
];

export function AgenticDetailInspector({
  map,
}: {
  map: AgenticSystemMap | null | undefined;
}) {
  if (!map) return null;

  // Per-layer rollup: worst status across the layer's nodes + counts.
  const layerRows = map.groups.map((group) => {
    const groupNodes = map.nodes.filter((n) => n.group === group.id);
    const worst: AgenticSystemNodeStatus = groupNodes.some(
      (n) => n.status === "alert",
    )
      ? "alert"
      : groupNodes.some((n) => n.status === "watch")
        ? "watch"
        : groupNodes.some((n) => n.status === "no_data")
          ? "no_data"
          : "healthy";
    return { group, count: groupNodes.length, worst };
  });

  const totalNodes = map.nodes.length;
  const totalEdges = map.edges.length;
  const alerts = map.nodes.filter((n) => n.status === "alert").length;
  const watches = map.nodes.filter((n) => n.status === "watch").length;

  return (
    <section
      id="agentic-detail-inspector"
      className="admin-doc-stack"
      aria-label="Agentic detail inspector"
    >
      <div className="admin-doc-inline-row admin-doc-inline-row--start flex-wrap">
        <h2 className="h2 m-0">System Details</h2>
        <span className="flex-1" />
        <Badge variant={alerts > 0 ? "danger" : watches > 0 ? "warning" : "success"}>
          {alerts > 0
            ? `${alerts} alert`
            : watches > 0
              ? `${watches} watch`
              : "all healthy"}
        </Badge>
      </div>
      <p className="body-xs ct-text-muted">
        Second layer beneath the map: a per-layer rollup and read-only jump-links
        into the full panels below. The map shows the system; these open the
        details.
      </p>

      {/* Overview metrics */}
      <div className="admin-doc-card-grid-3">
        <Card hoverOverlay={false} contentClassName="flex flex-col gap-[var(--ct-space-1)]">
          <span className="stat-label ct-text-muted">Nodes</span>
          <span className="h3 m-0 tabular-nums">{totalNodes}</span>
        </Card>
        <Card hoverOverlay={false} contentClassName="flex flex-col gap-[var(--ct-space-1)]">
          <span className="stat-label ct-text-muted">Connections</span>
          <span className="h3 m-0 tabular-nums">{totalEdges}</span>
        </Card>
        <Card hoverOverlay={false} contentClassName="flex flex-col gap-[var(--ct-space-1)]">
          <span className="stat-label ct-text-muted">Layers</span>
          <span className="h3 m-0 tabular-nums">{map.groups.length}</span>
        </Card>
      </div>

      {/* Per-layer rollup */}
      <Card hoverOverlay={false} contentClassName="flex flex-col gap-[var(--ct-space-2)]">
        <span className="stat-label ct-text-muted">Layers</span>
        <ul className="flex flex-col gap-[var(--ct-space-2)]">
          {layerRows.map(({ group, count, worst }) => (
            <li
              key={group.id}
              className="admin-doc-inline-row admin-doc-inline-row--start align-top"
            >
              <Badge variant={statusTone(worst)}>{worst}</Badge>
              <span className="body-xs flex-1">
                <span className="ct-text-strong">{group.label}</span>
                <span className="ct-text-faint"> ({count} nodes)</span>
                <span className="ct-text-muted"> — {group.summary}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Read-only jump-links into the preserved detail panels */}
      <Card hoverOverlay={false} contentClassName="flex flex-col gap-[var(--ct-space-2)]">
        <span className="stat-label ct-text-muted">Open a detail panel</span>
        <div className="admin-doc-inline-row admin-doc-inline-row--start flex-wrap">
          {DETAIL_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="agentic-map-legend">
              {l.label}
            </a>
          ))}
        </div>
        <p className="body-xs ct-text-faint">
          Read-only — these links scroll to the existing panels; none of them
          executes a tool or performs a write.
        </p>
      </Card>
    </section>
  );
}
