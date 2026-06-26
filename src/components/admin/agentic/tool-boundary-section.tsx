// Admin · Agentic Control Center — Tool Boundary v1 (presentational).
//
// READ-ONLY. Renders the reflection of the REAL tool registry: per-tier counts,
// a tool table (tier / risk / gate / source), consistency warnings comparing the
// static display against the code, and safety notes. NO write controls, NO action
// buttons, NO run/send/deploy/source — nothing executes. Pure component; all data
// passed in, unit-testable via SSR.

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type {
  ReflectedToolBoundaryItem,
  ToolBoundaryConsistencyIssue,
  ToolBoundaryRiskLevel,
  ToolBoundaryTier,
  ToolBoundaryV1Summary,
} from "@/lib/agentic/tool-boundary";

type Tone = "success" | "warning" | "danger" | "default" | "accent";

const TIER_LABEL: Record<ToolBoundaryTier, string> = {
  read_only: "Read-only",
  draft_or_proposal: "Draft / proposal",
  confirmed_write: "Confirmed-write",
  forbidden_autonomous: "Forbidden-autonomous",
  unknown: "Unknown",
};

function tierTone(tier: ToolBoundaryTier): Tone {
  switch (tier) {
    case "read_only":
      return "success";
    case "draft_or_proposal":
      return "warning";
    case "confirmed_write":
      return "warning";
    case "forbidden_autonomous":
      return "danger";
    default:
      return "danger"; // unknown is treated as high-risk
  }
}

function riskTone(risk: ToolBoundaryRiskLevel): Tone {
  switch (risk) {
    case "critical":
    case "high":
      return "danger";
    case "medium":
      return "warning";
    case "low":
      return "default";
    default:
      return "default";
  }
}

function severityTone(
  severity: ToolBoundaryConsistencyIssue["severity"],
): Tone {
  switch (severity) {
    case "critical":
      return "danger";
    case "warning":
      return "warning";
    default:
      return "default";
  }
}

const COUNT_TIERS: ToolBoundaryTier[] = [
  "read_only",
  "draft_or_proposal",
  "confirmed_write",
  "forbidden_autonomous",
  "unknown",
];

function CountCard({ tier, value }: { tier: ToolBoundaryTier; value: number }) {
  return (
    <Card hoverOverlay={false} contentClassName="flex flex-col gap-[var(--ct-space-1)]">
      <span className="stat-label ct-text-muted">{TIER_LABEL[tier]}</span>
      <span className="h3 m-0 tabular-nums">{value}</span>
    </Card>
  );
}

function ToolRow({ tool }: { tool: ReflectedToolBoundaryItem }) {
  return (
    <tr className="border-b border-(--ct-border-soft) last:border-0 align-top">
      <td className="py-[var(--ct-space-2)] pr-[var(--ct-space-3)] body-xs ct-text-body mono break-all">
        {tool.id}
      </td>
      <td className="py-[var(--ct-space-2)] pr-[var(--ct-space-3)]">
        <Badge variant={tierTone(tool.tier)}>{TIER_LABEL[tool.tier]}</Badge>
      </td>
      <td className="py-[var(--ct-space-2)] pr-[var(--ct-space-3)]">
        <Badge variant={riskTone(tool.riskLevel)}>{tool.riskLevel}</Badge>
      </td>
      <td className="py-[var(--ct-space-2)] pr-[var(--ct-space-3)] body-xs ct-text-muted tabular-nums whitespace-nowrap">
        {tool.humanGateRequired ? "HITL" : "—"}
      </td>
      <td className="py-[var(--ct-space-2)] pr-[var(--ct-space-3)] body-xs ct-text-muted tabular-nums whitespace-nowrap">
        {tool.autonomousAllowed ? "yes" : "no"}
      </td>
      <td className="py-[var(--ct-space-2)] pr-[var(--ct-space-3)] body-xs ct-text-muted whitespace-nowrap">
        {tool.runtimeStatus}
      </td>
      <td className="py-[var(--ct-space-2)] body-xs ct-text-faint mono break-all">
        {tool.source}
      </td>
    </tr>
  );
}

export function ToolBoundarySection({
  summary,
}: {
  summary: ToolBoundaryV1Summary | null | undefined;
}) {
  if (!summary) return null;

  const { counts, tools, consistencyIssues, safetyNotes } = summary;
  const criticalCount = consistencyIssues.filter(
    (i) => i.severity === "critical",
  ).length;
  const realTools = tools.filter((t) => t.tier !== "forbidden_autonomous");
  const forbiddenActions = tools.filter(
    (t) => t.tier === "forbidden_autonomous",
  );

  return (
    <section
      id="tool-boundary-v1"
      className="admin-doc-stack"
      aria-label="Tool Boundary v1"
    >
      <div className="admin-doc-inline-row admin-doc-inline-row--start flex-wrap">
        <h3 className="h3 m-0">Tool Boundary v1 — registry reflection</h3>
        <span className="flex-1" />
        <Badge variant="accent">source: code reflection</Badge>
        <Badge variant={criticalCount > 0 ? "danger" : "success"}>
          {criticalCount > 0
            ? `${criticalCount} critical`
            : "consistent"}
        </Badge>
      </div>
      <p className="body-xs ct-text-muted">
        The real tools declared in the registry, reflected read-only — tier, gate,
        risk, runtime status, and source. Nothing here executes a tool.
      </p>

      {/* Per-tier counts */}
      <div className="admin-doc-card-grid-3">
        {COUNT_TIERS.map((tier) => (
          <CountCard key={tier} tier={tier} value={counts[tier]} />
        ))}
      </div>

      {/* Consistency warnings (read-only) */}
      <Card
        hoverOverlay={false}
        contentClassName="flex flex-col gap-[var(--ct-space-2)]"
      >
        <div className="admin-doc-inline-row admin-doc-inline-row--start">
          <span className="stat-label ct-text-muted">Static-vs-code consistency</span>
          <span className="flex-1" />
          <Badge variant={consistencyIssues.length === 0 ? "success" : "warning"}>
            {consistencyIssues.length === 0
              ? "no drift"
              : `${consistencyIssues.length} issue${consistencyIssues.length > 1 ? "s" : ""}`}
          </Badge>
        </div>
        {consistencyIssues.length === 0 ? (
          <p className="body-xs ct-text-muted">
            The static Control Center boundary matches the real registry — no
            missing, stale, or misclassified tools.
          </p>
        ) : (
          <ul className="flex flex-col gap-[var(--ct-space-2)]">
            {consistencyIssues.map((issue) => (
              <li
                key={issue.id}
                className="admin-doc-inline-row admin-doc-inline-row--start align-top"
              >
                <Badge variant={severityTone(issue.severity)}>
                  {issue.severity}
                </Badge>
                <span className="body-xs ct-text-muted flex-1">{issue.message}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Real tools table */}
      <Card hoverOverlay={false} material="flat" contentClassName="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-(--ct-border-strong)">
              {["Tool", "Tier", "Risk", "Gate", "Autonomous", "Runtime", "Source"].map(
                (h) => (
                  <th
                    key={h}
                    className="stat-label ct-text-muted whitespace-nowrap pb-[var(--ct-space-2)] pr-[var(--ct-space-3)]"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {realTools.map((t) => (
              <ToolRow key={t.id} tool={t} />
            ))}
          </tbody>
        </table>
      </Card>

      {/* Forbidden-autonomous actions (represented, not callable tools) */}
      <Card
        hoverOverlay={false}
        contentClassName="flex flex-col gap-[var(--ct-space-2)]"
      >
        <div className="admin-doc-inline-row admin-doc-inline-row--start">
          <span className="stat-label ct-text-muted">
            Forbidden-autonomous actions (not callable tools)
          </span>
          <span className="flex-1" />
          <Badge variant="danger">{forbiddenActions.length}</Badge>
        </div>
        <ul className="flex flex-col gap-[var(--ct-space-1)]">
          {forbiddenActions.map((a) => (
            <li
              key={a.id}
              className="admin-doc-inline-row admin-doc-inline-row--start align-top"
            >
              <span className="body-xs ct-text-body flex-1">
                <span className="ct-text-strong">{a.name}</span>
                <span className="ct-text-muted"> — {a.notes}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Safety notes */}
      <Card
        hoverOverlay={false}
        contentClassName="flex flex-col gap-[var(--ct-space-1)]"
      >
        <span className="stat-label ct-text-muted">Safety</span>
        <ul className="flex flex-col gap-[var(--ct-space-1)]">
          {safetyNotes.map((note) => (
            <li key={note} className="body-xs ct-text-muted">
              · {note}
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
