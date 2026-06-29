import Link from "next/link";

import { GOVERNANCE_QUEUE_EMPTY } from "@/components/admin/governance/empty-messages";
import { EmptySurface } from "@/components/catalyst/empty-surface";
import { Badge } from "@/components/catalyst/badge";
import {
  formatGovernanceTimestamp,
  formatProposalAge,
  proposalStateLabel,
  proposalStateVariant,
} from "@/lib/governance/display";
import type { loadProposalQueue } from "@/lib/governance/actions";

type ProposalSummary = Awaited<ReturnType<typeof loadProposalQueue>>[number];

// Maps the governance display variant to a Catalyst Badge color. The single
// accent green is driven by --ct-accent inside Catalyst's dark "green" tokens.
const STATE_BADGE_COLOR: Record<
  ReturnType<typeof proposalStateVariant>,
  "zinc" | "amber" | "green" | "red"
> = {
  default: "zinc",
  warning: "amber",
  accent: "green",
  success: "green",
  danger: "red",
};

export function ProposalQueue({ proposals }: { proposals: ProposalSummary[] }) {
  if (proposals.length === 0) {
    return <EmptySurface live {...GOVERNANCE_QUEUE_EMPTY} />;
  }

  // Flat list — each proposal is a hairline-separated row, NOT its own bordered
  // box (the parent AdminSectionCard already owns the frame). Same way user
  // pages render a list of items. Hover tints the row instead of the border.
  return (
    <div className="flex flex-col">
      {proposals.map((proposal) => (
        <Link
          key={proposal.id}
          href={`/admin/governance/proposal/${proposal.id}`}
          aria-label={`Open proposal ${proposal.actionType}`}
          className="group block border-b border-[var(--ct-border-soft)] last:border-0"
        >
          <div className="p-5 transition-colors hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_3%,transparent)]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <Badge color="green" className="font-mono uppercase">
                    {proposal.vaultTicker}
                  </Badge>
                  <span className="ct-metric-value truncate">
                    {proposal.actionType}
                  </span>
                </div>
                <p className="ct-metric-caption mt-1.5">
                  Proposed by{" "}
                  <span className="font-mono text-[var(--ct-text-body)]">
                    {proposal.proposedBy.slice(0, 8)}…
                  </span>
                  {" · "}
                  {formatProposalAge(proposal.createdAt)}
                </p>
              </div>

              <div className="ct-metric-caption shrink-0 text-right">
                <span className="ct-metric-value tabular-nums text-[var(--ct-accent)]">
                  {proposal.approvalCount}/{proposal.requiredSigners}
                </span>{" "}
                approved
                {proposal.rejectionCount > 0 ? (
                  <span className="ml-2 font-semibold text-[var(--ct-status-danger)]">
                    {proposal.rejectionCount} rejected
                  </span>
                ) : null}
              </div>

              <Badge
                color={STATE_BADGE_COLOR[proposalStateVariant(proposal.state)]}
                className="uppercase"
              >
                {proposalStateLabel(proposal.state)}
              </Badge>
            </div>

            {proposal.state === "TIMELOCK" && proposal.etaAt ? (
              <div className="ct-metric-caption mt-3 border-t border-[var(--ct-border-soft)] pt-3">
                Timelock ETA:{" "}
                <span className="font-mono text-[var(--ct-text-body)]">
                  {formatGovernanceTimestamp(proposal.etaAt)}
                </span>
              </div>
            ) : null}
          </div>
        </Link>
      ))}
    </div>
  );
}
