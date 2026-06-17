import Link from "next/link";

import { GOVERNANCE_QUEUE_EMPTY } from "@/components/admin/governance/empty-messages";
import { AwaitingMetricState } from "@/components/ui/awaiting-metric-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  formatGovernanceTimestamp,
  formatProposalAge,
  proposalStateLabel,
  proposalStateVariant,
} from "@/lib/governance/display";
import type { loadProposalQueue } from "@/lib/governance/actions";

type ProposalSummary = Awaited<ReturnType<typeof loadProposalQueue>>[number];

export function ProposalQueue({ proposals }: { proposals: ProposalSummary[] }) {
  if (proposals.length === 0) {
    return <AwaitingMetricState {...GOVERNANCE_QUEUE_EMPTY} />;
  }

  return (
    <div className="admin-doc-stack admin-doc-stack--actions">
      {proposals.map((proposal) => (
        <Link
          key={proposal.id}
          href={`/admin/governance/proposal/${proposal.id}`}
          className="block"
        >
          <Card className="cursor-pointer" hoverOverlay={false}>
            <div className="admin-doc-inline-row admin-doc-inline-row--relaxed">
              <div className="min-w-0 flex-1">
                <div className="mb-1 admin-doc-inline-row">
                  <Badge variant="accent" className="mono body-xs">{proposal.vaultTicker}</Badge>
                  <span className="body-md truncate font-semibold ct-text-strong">
                    {proposal.actionType}
                  </span>
                </div>
                <p className="body-xs ct-text-muted">
                  Proposed by{" "}
                  <span className="mono">{proposal.proposedBy.slice(0, 8)}…</span>
                  {" · "}
                  {formatProposalAge(proposal.createdAt)}
                </p>
              </div>

              <div className="shrink-0 text-right body-xs ct-text-muted">
                <span className="font-semibold ct-text-primary">
                  {proposal.approvalCount}/{proposal.requiredSigners}
                </span>{" "}
                approved
                {proposal.rejectionCount > 0 ? (
                  <span className="ml-[var(--ct-space-2)] ct-status-danger">
                    {proposal.rejectionCount} rejected
                  </span>
                ) : null}
              </div>

              <Badge variant={proposalStateVariant(proposal.state)}>
                {proposalStateLabel(proposal.state)}
              </Badge>
            </div>

            {proposal.state === "TIMELOCK" && proposal.etaAt ? (
              <div className="mt-[var(--ct-space-3)] border-t border-(--ct-border-soft) pt-[var(--ct-space-3)] body-xs ct-text-muted">
                Timelock ETA:{" "}
                <span className="mono ct-text-primary">
                  {formatGovernanceTimestamp(proposal.etaAt)}
                </span>
              </div>
            ) : null}
          </Card>
        </Link>
      ))}
    </div>
  );
}
