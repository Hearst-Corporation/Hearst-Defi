// Admin · Agentic Control Tower — Safety Boundary (presentational).
//
// READ-ONLY. Rewritten 2026-06-26: the platform's hard limits as one row per
// pillar in a collapsible table (Console · Forbidden · Human gates · Guards),
// with the item lists tucked into a nested <details>. No write controls. No
// hardcoded values. Pure component.

import { AgenticGroup, AgenticTag, type AgenticTone } from "@/components/admin/agentic/agentic-group";
import type { AgenticControlCenterData } from "@/lib/agentic/control-center/types";
import type { ActionReadinessMatrix } from "@/lib/agentic/action-readiness/types";

export function AgenticSafetyBoundary({
  controlCenter,
  matrix,
}: {
  controlCenter: AgenticControlCenterData | null | undefined;
  matrix: ActionReadinessMatrix | null | undefined;
}) {
  if (!controlCenter) return null;

  const guards = controlCenter.inventory.filter((i) => i.type === "guard");
  const gates = controlCenter.gates;
  const forbidden = matrix?.items.filter((i) => i.tier === "forbidden_autonomous") ?? [];
  const safetyHolds = controlCenter.safetySummary.filter((s) => s.holds).length;
  const safetyTotal = controlCenter.safetySummary.length;

  interface PillarRow {
    id: string;
    pillar: string;
    value: string;
    tone: AgenticTone;
    detail?: { summary: string; items: string[] };
    note?: string;
  }

  const rows: PillarRow[] = [
    {
      id: "console",
      pillar: "Console",
      value: "Read-only",
      tone: "success",
      note: "No run, send, deploy, or mark-live control exists on this page.",
    },
    {
      id: "forbidden",
      pillar: "Forbidden",
      value: `${forbidden.length} never autonomous`,
      tone: "danger",
      detail: { summary: "list", items: forbidden.map((f) => f.label) },
    },
    {
      id: "gates",
      pillar: "Human gates",
      value: `${gates.length} gated actions`,
      tone: "warning",
      note: "Admin role + two-step confirmation token required.",
    },
    {
      id: "guards",
      pillar: "Guards",
      value: `${guards.length} always-on`,
      tone: "success",
      detail: { summary: "list", items: guards.map((g) => g.name) },
      note: `${safetyHolds}/${safetyTotal} guarantees verified.`,
    },
  ];

  return (
    <AgenticGroup
      id="safety-boundary"
      title="Safety Boundary"
      count={rows.length}
      defaultOpen
      note="The hard limits. Nothing executes here. Every write is gated; the most dangerous actions can never be autonomous."
    >
      <table className="agentic-table">
        <thead>
          <tr>
            <th>Pillar</th>
            <th>Guarantee</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} data-tone={r.tone}>
              <td className="agentic-cell-strong">{r.pillar}</td>
              <td>
                <AgenticTag tone={r.tone}>{r.value}</AgenticTag>
              </td>
              <td className="agentic-cell-muted">
                {r.note}
                {r.detail && r.detail.items.length > 0 && (
                  <details className="agentic-rowdetail">
                    <summary className="agentic-rowdetail-summary">
                      {r.detail.summary} ({r.detail.items.length})
                    </summary>
                    <div className="agentic-rowdetail-body">
                      {r.detail.items.map((it) => (
                        <span key={it}>{it}</span>
                      ))}
                    </div>
                  </details>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </AgenticGroup>
  );
}
