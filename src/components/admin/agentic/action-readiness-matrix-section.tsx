// Admin · Agentic Control Tower — Action Readiness Matrix (presentational).
//
// READ-ONLY. Rewritten 2026-06-26: every platform action as ONE dense row in a
// collapsible group, grouped by autonomy tier via sub-header rows. The row's
// left rail colours the tier; per-action reason/examples live in a nested
// <details> so the table stays scannable. No write controls, nothing executes.
// No hardcoded values. Pure component.

import { Fragment } from "react";
import { AgenticTag, type AgenticTone } from "@/components/admin/agentic/agentic-group";
import type {
  ActionReadinessItem,
  ActionReadinessMatrix,
  ActionReadinessTier,
} from "@/lib/agentic/action-readiness/types";

const TIER_LABEL: Record<ActionReadinessTier, string> = {
  read_only: "Read-only",
  draft_or_proposal: "Draft / Proposal",
  confirmed_write: "Confirmed-write",
  forbidden_autonomous: "Forbidden",
};

const TIER_TONE: Record<ActionReadinessTier, AgenticTone> = {
  read_only: "success",
  draft_or_proposal: "warning",
  confirmed_write: "warning",
  forbidden_autonomous: "danger",
};

const TIER_ORDER: ActionReadinessTier[] = [
  "read_only",
  "draft_or_proposal",
  "confirmed_write",
  "forbidden_autonomous",
];

function gateLabel(item: ActionReadinessItem): string {
  if (item.tier === "forbidden_autonomous") return "blocked";
  if (item.humanGateRequired || item.confirmationRequired) return "HITL";
  return "—";
}

function riskTone(risk: ActionReadinessItem["riskLevel"]): AgenticTone {
  if (risk === "critical" || risk === "high") return "danger";
  if (risk === "medium") return "warning";
  return "neutral";
}

function ActionRow({ item }: { item: ActionReadinessItem }) {
  const hasDetail = Boolean(item.reason) || item.examples.length > 0;
  return (
    <tr data-tone={TIER_TONE[item.tier]}>
      <td className="agentic-cell-strong">
        {item.label}
        {hasDetail && (
          <details className="agentic-rowdetail">
            <summary className="agentic-rowdetail-summary">details</summary>
            <div className="agentic-rowdetail-body">
              {item.reason && <span>{item.reason}</span>}
              {item.examples.map((ex) => (
                <span key={ex} className="agentic-cell-faint">
                  · {ex}
                </span>
              ))}
            </div>
          </details>
        )}
      </td>
      <td>
        {item.riskLevel !== "none" && item.riskLevel !== "low" ? (
          <AgenticTag tone={riskTone(item.riskLevel)}>{item.riskLevel}</AgenticTag>
        ) : (
          <span className="agentic-cell-faint">—</span>
        )}
      </td>
      <td className="agentic-cell-muted" title={item.requiredGate ?? undefined}>
        {gateLabel(item)}
      </td>
      <td className="agentic-cell-muted">
        {item.autonomousAllowed ? "autonomous" : "human"}
      </td>
      <td>
        <AgenticTag tone={item.status === "blocked" ? "danger" : item.status === "available" ? "success" : "warning"}>
          {item.status}
        </AgenticTag>
      </td>
    </tr>
  );
}

export function ActionReadinessMatrixSection({
  matrix,
}: {
  matrix: ActionReadinessMatrix | null | undefined;
}) {
  if (!matrix) return null;

  const { items, counts } = matrix;
  const itemsByTier = (tier: ActionReadinessTier) => items.filter((i) => i.tier === tier);

  return (
    <div id="action-readiness" className="agentic-group-body min-w-0 border-t-0">
      <table className="agentic-table">
        <thead>
          <tr>
            <th>Action</th>
            <th>Risk</th>
            <th>Gate</th>
            <th>Autonomy</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {TIER_ORDER.map((tier) => {
            const tierItems = itemsByTier(tier);
            if (tierItems.length === 0) return null;
            return (
              <Fragment key={tier}>
                <tr className="agentic-table-subhead">
                  <td colSpan={5}>
                    {TIER_LABEL[tier]}
                    <span className="agentic-table-subhead-count">{counts[tier]}</span>
                  </td>
                </tr>
                {tierItems.map((item) => (
                  <ActionRow key={item.id} item={item} />
                ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
