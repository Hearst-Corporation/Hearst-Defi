import Link from "next/link";

import { GOVERNANCE_QUEUE_EMPTY } from "@/components/admin/governance/empty-messages";
import { EmptySurface } from "@/components/ui/empty-surface";
import { Badge } from "@/components/catalyst/badge";
import {
  formatGovernanceTimestamp,
  formatProposalAge,
  proposalStateLabel,
  proposalStateVariant,
} from "@/lib/governance/display";
import type { loadProposalQueue } from "@/lib/governance/actions";

type ProposalSummary = Awaited<ReturnType<typeof loadProposalQueue>>[number];

// Maps the governance display variant to a Catalyst Badge color (one green: #A7FB90).
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

  return (
    <div className="flex flex-col gap-3">
      {proposals.map((proposal) => (
        <Link
          key={proposal.id}
          href={`/admin/governance/proposal/${proposal.id}`}
          aria-label={`Open proposal ${proposal.actionType}`}
          className="group block"
        >
          <div className="rounded-2xl border border-white/10 bg-surface-inset p-5 transition-colors hover:border-[#A7FB90]/40">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <Badge color="green" className="font-mono text-[10px]! uppercase tracking-wider">
                    {proposal.vaultTicker}
                  </Badge>
                  <span className="truncate text-[14px] font-medium text-white">
                    {proposal.actionType}
                  </span>
                </div>
                <p className="mt-1.5 text-[12px] text-zinc-500">
                  Proposed by{" "}
                  <span className="font-mono text-zinc-400">
                    {proposal.proposedBy.slice(0, 8)}…
                  </span>
                  {" · "}
                  {formatProposalAge(proposal.createdAt)}
                </p>
              </div>

              <div className="shrink-0 text-right text-[12px] text-zinc-500">
                <span className="font-semibold tabular-nums text-[#A7FB90]">
                  {proposal.approvalCount}/{proposal.requiredSigners}
                </span>{" "}
                approved
                {proposal.rejectionCount > 0 ? (
                  <span className="ml-2 font-semibold text-red-400">
                    {proposal.rejectionCount} rejected
                  </span>
                ) : null}
              </div>

              <Badge
                color={STATE_BADGE_COLOR[proposalStateVariant(proposal.state)]}
                className="text-[10px]! uppercase tracking-widest"
              >
                {proposalStateLabel(proposal.state)}
              </Badge>
            </div>

            {proposal.state === "TIMELOCK" && proposal.etaAt ? (
              <div className="mt-3 border-t border-white/5 pt-3 text-[12px] text-zinc-500">
                Timelock ETA:{" "}
                <span className="font-mono text-zinc-300">
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
