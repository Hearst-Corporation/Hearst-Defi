// Admin · Agentic Control Tower — Action Readiness Matrix (presentational).
//
// READ-ONLY. Renders the action-readiness matrix as compact TIER LANES. Each
// action is a single row: name + risk badge. Tier colour communicates autonomy.
// No write controls, no action buttons, nothing executes. Pure component.

import { Badge } from "@/components/ui/badge";
import type {
  ActionReadinessItem,
  ActionReadinessMatrix,
  ActionReadinessTier,
  ActionRiskLevel,
} from "@/lib/agentic/action-readiness/types";

type Tone = "success" | "warning" | "danger" | "default";

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

function tierTone(tier: ActionReadinessTier): Tone {
  switch (tier) {
    case "read_only": return "success";
    case "draft_or_proposal":
    case "confirmed_write": return "warning";
    case "forbidden_autonomous": return "danger";
  }
}

function riskTone(risk: ActionRiskLevel): Tone {
  switch (risk) {
    case "critical":
    case "high": return "danger";
    case "medium": return "warning";
    default: return "default";
  }
}

function ActionRow({ item }: { item: ActionReadinessItem }) {
  return (
    <li className="agentic-action-row">
      <span className="agentic-action-row-name body-xs ct-text-body">{item.label}</span>
      {item.riskLevel !== "low" && (
        <Badge variant={riskTone(item.riskLevel)}>{item.riskLevel}</Badge>
      )}
    </li>
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
    <div className="agentic-action-lane" data-tier={tier}>
      <div className="agentic-action-lane-head">
        <span className="agentic-action-lane-title">{TIER_LABEL[tier]}</span>
        <span className="body-xs ct-text-faint tabular-nums">{items.length}</span>
      </div>
      <ul className="agentic-action-lane-list">
        {items.map((item) => (
          <ActionRow key={item.id} item={item} />
        ))}
      </ul>
    </div>
  );
}

export function ActionReadinessMatrixSection({
  matrix,
}: {
  matrix: ActionReadinessMatrix | null | undefined;
}) {
  if (!matrix) return null;

  const { items } = matrix;
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
          Every platform action classified by autonomy tier. Green runs on its own; amber needs human confirmation; red never runs autonomously.
        </p>
      </div>

      <div className="agentic-action-grid">
        {TIER_ORDER.map((tier) => (
          <TierLane key={tier} tier={tier} items={itemsByTier(tier)} />
        ))}
      </div>
    </section>
  );
}
