// Admin · Agentic Control Center — Action Readiness Matrix (presentational).
//
// READ-ONLY. Renders the action-readiness matrix as visual TIER LANES (read-only
// / draft / confirmed-write / forbidden), each action a chip with its
// autonomous / gate / risk badges. NO write controls, NO action buttons, NO
// run/send/deploy/source — nothing here executes. Pure component; all data
// passed in, unit-testable via SSR.

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type {
  ActionReadinessItem,
  ActionReadinessMatrix,
  ActionReadinessTier,
  ActionRiskLevel,
} from "@/lib/agentic/action-readiness/types";

type Tone = "success" | "warning" | "danger" | "default" | "accent";

const TIER_LABEL: Record<ActionReadinessTier, string> = {
  read_only: "Read-only",
  draft_or_proposal: "Draft / Proposal",
  confirmed_write: "Confirmed-write",
  forbidden_autonomous: "Forbidden-autonomous",
};

const TIER_ORDER: ActionReadinessTier[] = [
  "read_only",
  "draft_or_proposal",
  "confirmed_write",
  "forbidden_autonomous",
];

function tierTone(tier: ActionReadinessTier): Tone {
  switch (tier) {
    case "read_only":
      return "success";
    case "draft_or_proposal":
    case "confirmed_write":
      return "warning";
    case "forbidden_autonomous":
      return "danger";
  }
}

function riskTone(risk: ActionRiskLevel): Tone {
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

function ActionChip({ item }: { item: ActionReadinessItem }) {
  return (
    <div className="agentic-action-chip" data-tier={item.tier}>
      <div className="admin-doc-inline-row admin-doc-inline-row--start admin-doc-inline-row--tight">
        <span className="body-xs ct-text-strong flex-1 break-words">{item.label}</span>
        <Badge variant={riskTone(item.riskLevel)}>{item.riskLevel}</Badge>
      </div>
      <div className="admin-doc-inline-row admin-doc-inline-row--start admin-doc-inline-row--tight flex-wrap">
        <Badge variant={item.autonomousAllowed ? "success" : "default"}>
          {item.autonomousAllowed ? "autonomous" : "non-autonomous"}
        </Badge>
        {item.humanGateRequired && <Badge variant="warning">HITL</Badge>}
      </div>
      <p className="body-xs ct-text-faint break-words">{item.reason}</p>
    </div>
  );
}

function TierLane({
  tier,
  items,
}: {
  tier: ActionReadinessTier;
  items: ActionReadinessItem[];
}) {
  return (
    <div className="agentic-action-lane" data-tier={tier} aria-label={TIER_LABEL[tier]}>
      <div className="admin-doc-inline-row admin-doc-inline-row--start">
        <Badge variant={tierTone(tier)}>{TIER_LABEL[tier]}</Badge>
        <span className="flex-1" />
        <span className="body-xs ct-text-faint tabular-nums">{items.length}</span>
      </div>
      <div className="agentic-action-lane-body">
        {items.map((item) => (
          <ActionChip key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

export function ActionReadinessMatrixSection({
  matrix,
}: {
  matrix: ActionReadinessMatrix | null | undefined;
}) {
  if (!matrix) return null;

  const { items, counts, safetyNotes } = matrix;
  const itemsByTier = (tier: ActionReadinessTier) =>
    items.filter((i) => i.tier === tier);

  return (
    <section
      id="action-readiness"
      className="admin-doc-stack"
      aria-label="Action Readiness Matrix"
    >
      <div className="admin-doc-inline-row admin-doc-inline-row--start flex-wrap">
        <h2 className="h2 m-0">Action Readiness</h2>
        <span className="flex-1" />
        <Badge variant="accent">read-only</Badge>
        <Badge variant="default">{items.length} actions</Badge>
      </div>
      <p className="body-xs ct-text-muted">
        Every platform action classified by tier. Read-only actions may run
        autonomously because they do not write. Draft and confirmed-write actions
        remain gated. Forbidden actions are represented for safety but are never
        callable.
      </p>

      {/* Tier count cards */}
      <div className="admin-doc-card-grid-3">
        {TIER_ORDER.map((tier) => (
          <Card
            key={tier}
            hoverOverlay={false}
            contentClassName="flex flex-col gap-[var(--ct-space-1)]"
          >
            <span className="stat-label ct-text-muted">{TIER_LABEL[tier]}</span>
            <span className="h3 m-0 tabular-nums">{counts[tier]}</span>
          </Card>
        ))}
      </div>

      {/* Visual tier lanes */}
      <div className="agentic-action-grid">
        {TIER_ORDER.map((tier) => (
          <TierLane key={tier} tier={tier} items={itemsByTier(tier)} />
        ))}
      </div>

      {/* Safety notes */}
      <Card hoverOverlay={false} contentClassName="flex flex-col gap-[var(--ct-space-1)]">
        <span className="stat-label ct-text-muted">Safety</span>
        <ul className="flex flex-col gap-[var(--ct-space-1)]">
          {safetyNotes.map((n) => (
            <li key={n} className="body-xs ct-text-muted">
              · {n}
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
