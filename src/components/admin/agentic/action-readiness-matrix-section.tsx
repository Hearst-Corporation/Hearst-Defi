// Admin · Agentic Control Tower — Action Readiness Matrix (presentational).
//
// READ-ONLY. Rewritten 2026-06-26: every platform action as ONE dense row in a
// collapsible group, grouped by autonomy tier via sub-header rows. The row's
// left rail colours the tier; per-action reason/examples live in a nested
// <details> so the table stays scannable. No write controls, nothing executes.
// No hardcoded values. Pure component.
//
// Canonized (Mission #064): the custom `agentic-table` is replaced by the canon
// Catalyst Table primitive and `agentic-tag` by BentoBadge. The tier sub-header
// rows and the per-action <details> disclosure are preserved as functional
// content.

import { Fragment } from "react";
import { BentoBadge, type BentoBadgeVariant } from "@/components/catalyst/bento-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/catalyst/table";
import type { AgenticTone } from "@/components/admin/agentic/agentic-group";
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

const TONE_VARIANT: Record<AgenticTone, BentoBadgeVariant> = {
  success: "success",
  warning: "warning",
  danger: "danger",
  accent: "accent",
  info: "default",
  neutral: "default",
};

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
    <TableRow data-tone={TIER_TONE[item.tier]}>
      <TableCell className="ct-metric-value">
        {item.label}
        {hasDetail && (
          <details className="agentic-rowdetail">
            <summary className="agentic-rowdetail-summary">details</summary>
            <div className="agentic-rowdetail-body">
              {item.reason && <span>{item.reason}</span>}
              {item.examples.map((ex) => (
                <span key={ex} className="text-[var(--ct-text-faint)]">
                  · {ex}
                </span>
              ))}
            </div>
          </details>
        )}
      </TableCell>
      <TableCell>
        {item.riskLevel !== "none" && item.riskLevel !== "low" ? (
          <BentoBadge variant={TONE_VARIANT[riskTone(item.riskLevel)]}>{item.riskLevel}</BentoBadge>
        ) : (
          <span className="text-[var(--ct-text-faint)]">—</span>
        )}
      </TableCell>
      <TableCell className="ct-metric-caption" title={item.requiredGate ?? undefined}>
        {gateLabel(item)}
      </TableCell>
      <TableCell className="ct-metric-caption">
        {item.autonomousAllowed ? "autonomous" : "human"}
      </TableCell>
      <TableCell>
        <BentoBadge variant={TONE_VARIANT[item.status === "blocked" ? "danger" : item.status === "available" ? "success" : "warning"]}>
          {item.status}
        </BentoBadge>
      </TableCell>
    </TableRow>
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
      <Table dense>
        <TableHead>
          <TableRow>
            <TableHeader>Action</TableHeader>
            <TableHeader>Risk</TableHeader>
            <TableHeader>Gate</TableHeader>
            <TableHeader>Autonomy</TableHeader>
            <TableHeader>Status</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {TIER_ORDER.map((tier) => {
            const tierItems = itemsByTier(tier);
            if (tierItems.length === 0) return null;
            return (
              <Fragment key={tier}>
                <TableRow>
                  <TableCell colSpan={5} className="ct-bento-label bg-[var(--ct-surface-inset)]">
                    {TIER_LABEL[tier]}
                    <span className="ml-2 tabular-nums text-[var(--ct-text-faint)]">{counts[tier]}</span>
                  </TableCell>
                </TableRow>
                {tierItems.map((item) => (
                  <ActionRow key={item.id} item={item} />
                ))}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
