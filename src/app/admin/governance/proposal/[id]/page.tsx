import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PanelStatus } from "@/components/ui/panel-status";
import { Ptai } from "@/components/ui/ptai";
import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import { requireAdmin } from "@/lib/auth/require-admin";
import { executeProposal, loadProposalDetail, signProposal } from "@/lib/governance/actions";
import {
  extractPtaiFromCalldata,
  formatProposalCalldata,
} from "@/lib/governance/proposal-calldata";
import {
  formatGovernanceTimestamp,
  proposalStateLabel,
  proposalStateVariant,
  timelockCountdown,
} from "@/lib/governance/display";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function handleSign(
  proposalId: string,
  decision: "approve" | "reject" | "cancel",
  formData: FormData,
) {
  "use server";
  const reason = (formData.get("reason") as string | null) ?? undefined;
  await signProposal(proposalId, decision, reason);
}

async function handleExecute(proposalId: string) {
  "use server";
  await executeProposal(proposalId);
}

export default async function ProposalDetailPage({ params }: PageProps) {
  await requireAdmin();
  const { id } = await params;

  let proposal;
  try {
    proposal = await loadProposalDetail(id);
  } catch {
    notFound();
  }

  const isTerminal = ["EXECUTED", "CANCELLED", "REJECTED", "EXPIRED"].includes(proposal.state);
  const canSign = proposal.state === "SIGNING";
  const canCancel = proposal.state === "TIMELOCK" || proposal.state === "QUEUED";
  const canExecute = proposal.state === "EXECUTABLE" || proposal.state === "TIMELOCK";
  const ptai = extractPtaiFromCalldata(proposal.calldata);

  const approveAction = handleSign.bind(null, proposal.id, "approve");
  const rejectAction = handleSign.bind(null, proposal.id, "reject");
  const cancelAction = handleSign.bind(null, proposal.id, "cancel");
  const executeAction = handleExecute.bind(null, proposal.id);

  return (
    <div className="admin-doc-shell">
      <AdminPageHeader
        title={proposal.actionType}
        lead={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/governance">← Governance</Link>
          </Button>
        }
      />

      <Card>
        <div className="mb-6 admin-doc-inline-row admin-doc-inline-row--actions">
          <span className="ct-pill mono body-xs">{proposal.vaultTicker}</span>
          <Badge variant={proposalStateVariant(proposal.state)}>
            {proposalStateLabel(proposal.state)}
          </Badge>
        </div>

        <dl className="admin-doc-dl-grid body-sm">
          <div>
            <dt className="stat-label">Proposed by</dt>
            <dd className="mono mt-0.5 ct-text-primary">{proposal.proposedBy}</dd>
          </div>
          <div>
            <dt className="stat-label">Required signers</dt>
            <dd className="mt-0.5 ct-text-primary">{proposal.requiredSigners}</dd>
          </div>
          <div>
            <dt className="stat-label">Created</dt>
            <dd className="mt-0.5 tabular-nums ct-text-primary">
              {formatGovernanceTimestamp(proposal.createdAt)}
            </dd>
          </div>
          <div>
            <dt className="stat-label">ETA (timelock)</dt>
            <dd className="mt-0.5 tabular-nums ct-text-primary">
              {formatGovernanceTimestamp(proposal.etaAt)}
            </dd>
          </div>
          {proposal.executedAt ? (
            <div>
              <dt className="stat-label">Executed at</dt>
              <dd className="mt-0.5 tabular-nums ct-text-primary">
                {formatGovernanceTimestamp(proposal.executedAt)}
              </dd>
            </div>
          ) : null}
          {proposal.cancelledAt ? (
            <div>
              <dt className="stat-label">Cancelled at</dt>
              <dd className="mt-0.5 tabular-nums ct-text-primary">
                {formatGovernanceTimestamp(proposal.cancelledAt)}
              </dd>
            </div>
          ) : null}
        </dl>

        {proposal.state === "TIMELOCK" && proposal.etaAt ? (
          <div className="mt-6 rounded-md border border-[var(--ct-border-soft)] ct-surface-1 px-4 py-3">
            <p className="stat-label mb-1">Timelock countdown</p>
            <p className="mono body-sm ct-text-strong">{timelockCountdown(proposal.etaAt)}</p>
          </div>
        ) : null}
      </Card>

      {ptai ? (
        <Card>
          <DashboardPanelHeader
            title="Projection · Trigger · Action · Impact"
            tone="quiet"
            className="mb-4"
          />
          <Ptai
            projection={ptai.projection}
            trigger={ptai.trigger}
            action={ptai.action}
            impact={ptai.impact}
          />
          <p className="body-xs mt-3 italic leading-[var(--ct-leading-relaxed)] ct-text-faint">
            Conditional projection — not guaranteed. Methodology v1.0.
          </p>
        </Card>
      ) : null}

      <Card>
        <DashboardPanelHeader title="Justification" tone="quiet" className="mb-4" />
        <p className="body-md whitespace-pre-wrap ct-text-primary">{proposal.justification}</p>
      </Card>

      {proposal.calldata ? (
        <Card>
          <DashboardPanelHeader title="Calldata" tone="quiet" className="mb-4" />
          <pre className="mono overflow-x-auto whitespace-pre-wrap rounded-md ct-surface-1 p-4 body-xs ct-text-muted">
            {formatProposalCalldata(proposal.calldata)}
          </pre>
        </Card>
      ) : null}

      <Card>
        <DashboardPanelHeader
          title={`Signatures (${proposal.approvalCount}/${proposal.requiredSigners} approved${
            proposal.rejectionCount > 0 ? `, ${proposal.rejectionCount} rejected` : ""
          }${proposal.cancelCount > 0 ? `, ${proposal.cancelCount} cancel` : ""})`}
          tone="quiet"
          className="mb-4"
        />

        {proposal.signatures.length === 0 ? (
          <PanelStatus message="No signatures yet." />
        ) : (
          <div className="admin-doc-stack admin-doc-stack--tight">
            {proposal.signatures.map((sig) => (
              <div
                key={sig.id}
                className="admin-doc-inline-row admin-doc-inline-row--actions border-b border-[var(--ct-border-soft)] py-2 last:border-0"
              >
                <div
                  className={cn(
                    "ct-sig-avatar",
                    sig.decision === "approve"
                      ? "ct-sig-avatar--approve"
                      : sig.decision === "reject"
                        ? "ct-sig-avatar--reject"
                        : "ct-sig-avatar--neutral",
                  )}
                >
                  {sig.decision === "approve" ? "✓" : sig.decision === "reject" ? "✗" : "⊘"}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="mono body-xs ct-text-primary">{sig.signerAddress}</span>
                  {sig.reason ? (
                    <p className="mt-0.5 truncate body-xs ct-text-muted">{sig.reason}</p>
                  ) : null}
                </div>
                <span className="shrink-0 body-xs tabular-nums ct-text-muted">
                  {formatGovernanceTimestamp(sig.signedAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {!isTerminal ? (
        <Card>
          <DashboardPanelHeader title="Actions" tone="quiet" className="mb-4" />
          <div className="admin-doc-inline-row admin-doc-inline-row--actions">
            {canSign ? (
              <>
                <form action={approveAction}>
                  <input type="hidden" name="reason" value="" />
                  <Button variant="primary" size="lg" type="submit">
                    Approve
                  </Button>
                </form>
                <form action={rejectAction}>
                  <input type="hidden" name="reason" value="" />
                  <Button variant="danger" size="lg" type="submit">
                    Reject
                  </Button>
                </form>
              </>
            ) : null}
            {canCancel ? (
              <form action={cancelAction}>
                <input type="hidden" name="reason" value="" />
                <Button variant="danger" size="lg" type="submit">
                  Cancel (quorum)
                </Button>
              </form>
            ) : null}
            {canExecute ? (
              <form action={executeAction}>
                <Button variant="primary" size="lg" type="submit">
                  Execute
                </Button>
              </form>
            ) : null}
          </div>
          <p className="body-xs mt-3 ct-text-muted">
            Actions are recorded on-chain mock only — no Solidity calls at this stage.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
