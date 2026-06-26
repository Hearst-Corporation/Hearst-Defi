// Admin · Agentic Control Tower — Action Readiness Matrix (presentational).
//
// READ-ONLY. The detailed matrix: every platform action as ONE dense table row,
// grouped by autonomy tier. Columns: Action · Risk · Gate · Autonomy · Status.
// Tier group headers carry the tier label + count; the tier border colour
// communicates autonomy. No write controls, no action buttons, nothing executes.
// Pure component; data passed in, SSR-testable.

import { Fragment } from "react";
import { Card } from "@/components/ui/card";
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

const TIER_ORDER: ActionReadinessTier[] = [
  "read_only",
  "draft_or_proposal",
  "confirmed_write",
  "forbidden_autonomous",
];

/** Short, single-line gate token (the full requiredGate prose is too long for a
 *  dense row and would force the Action column to wrap). */
function gateLabel(item: ActionReadinessItem): string {
  if (item.tier === "forbidden_autonomous") return "blocked";
  if (item.humanGateRequired || item.confirmationRequired) return "HITL";
  return "—";
}

function ActionRows({
  tier,
  items,
}: {
  tier: ActionReadinessTier;
  items: ActionReadinessItem[];
}) {
  return (
    <>
      {items.map((item) => (
        <tr key={item.id} className="agentic-matrix-row" data-tier={tier}>
          <td className="agentic-matrix-action body-xs ct-text-body">{item.label}</td>
          <td className="agentic-matrix-cell">
            {item.riskLevel !== "none" && item.riskLevel !== "low" ? (
              <span className="agentic-matrix-risk" data-risk={item.riskLevel}>
                {item.riskLevel}
              </span>
            ) : (
              <span className="body-xs ct-text-faint">—</span>
            )}
          </td>
          <td className="agentic-matrix-cell body-xs ct-text-muted" title={item.requiredGate ?? undefined}>
            {gateLabel(item)}
          </td>
          <td className="agentic-matrix-cell body-xs ct-text-muted">
            {item.autonomousAllowed ? "autonomous" : "human"}
          </td>
          <td className="agentic-matrix-cell">
            <span className="agentic-matrix-status" data-status={item.status}>
              {item.status}
            </span>
          </td>
        </tr>
      ))}
    </>
  );
}

export function ActionReadinessMatrixSection({
  matrix,
}: {
  matrix: ActionReadinessMatrix | null | undefined;
}) {
  if (!matrix) return null;

  const { items, counts } = matrix;
  const itemsByTier = (tier: ActionReadinessTier) =>
    items.filter((i) => i.tier === tier);

  return (
    <section
      id="action-readiness"
      className="agentic-stack"
      aria-label="Action Readiness Matrix"
    >
      <div className="agentic-section-head">
        <h2 className="agentic-section-title m-0">Actions &amp; Gates</h2>
        <p className="body-sm ct-text-muted m-0">
          Every platform action classified by autonomy tier. Green runs on its own;
          amber needs human confirmation; red never runs autonomously.
        </p>
      </div>

      <Card hoverOverlay={false} material="flat" density="compact" contentClassName="overflow-x-auto">
        <table className="agentic-matrix-table w-full text-left">
          <thead>
            <tr className="border-b border-(--ct-border-strong)">
              {["Action", "Risk", "Gate", "Autonomy", "Status"].map((h) => (
                <th
                  key={h}
                  className="stat-label ct-text-muted whitespace-nowrap pb-[var(--ct-space-2)] pr-[var(--ct-space-3)]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIER_ORDER.map((tier) => {
              const tierItems = itemsByTier(tier);
              if (tierItems.length === 0) return null;
              return (
                <Fragment key={tier}>
                  <tr className="agentic-matrix-group" data-tier={tier}>
                    <th colSpan={5} scope="colgroup" className="agentic-matrix-group-cell">
                      <span className="agentic-matrix-group-title">{TIER_LABEL[tier]}</span>
                      <span className="agentic-matrix-group-count tabular-nums">
                        {counts[tier]}
                      </span>
                    </th>
                  </tr>
                  <ActionRows tier={tier} items={tierItems} />
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </Card>
    </section>
  );
}
