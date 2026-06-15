import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { VaultActionButton } from "@/components/admin/vault-action-button";
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

  // Argless server-action closures (no FormData crosses the confirm dialog);
  // each supplies the same empty-reason payload handleSign read from the form.
  const approveAction = async () => {
    "use server";
    const fd = new FormData();
    fd.set("reason", "");
    await handleSign(proposal.id, "approve", fd);
  };
  const rejectAction = async () => {
    "use server";
    const fd = new FormData();
    fd.set("reason", "");
    await handleSign(proposal.id, "reject", fd);
  };
  const cancelAction = async () => {
    "use server";
    const fd = new FormData();
    fd.set("reason", "");
    await handleSign(proposal.id, "cancel", fd);
  };
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

      <Card hoverOverlay={false}>
        <div className="mb-6 admin-doc-inline-row admin-doc-inline-row--actions">
          <Badge variant="accent" className="mono body-xs">{proposal.vaultTicker}</Badge>
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
          <div className="mt-6 ct-nested-callout flex flex-col gap-1">
            <p className="body-xs font-semibold ct-text-body">Timelock countdown</p>
            <p className="mono body-sm ct-text-strong">{timelockCountdown(proposal.etaAt)}</p>
          </div>
        ) : null}
      </Card>

      {ptai ? (
        <Card density="compact" hoverOverlay={false}>
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

      <Card density="compact" hoverOverlay={false}>
        <DashboardPanelHeader title="Justification" tone="quiet" className="mb-4" />
        <p className="body-md whitespace-pre-wrap ct-text-primary">{proposal.justification}</p>
      </Card>

      {proposal.calldata ? (
        <Card density="compact" hoverOverlay={false}>
          <DashboardPanelHeader title="Calldata" tone="quiet" className="mb-4" />
          <pre className="mono overflow-x-auto whitespace-pre-wrap rounded-md border border-[var(--ct-border-soft)] p-4 body-xs ct-text-muted">
            {formatProposalCalldata(proposal.calldata)}
          </pre>
        </Card>
      ) : null}

      <Card density="compact" hoverOverlay={false}>
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
        <Card hoverOverlay={false}>
          <DashboardPanelHeader title="Actions" tone="quiet" className="mb-4" />
          <div className="admin-doc-inline-row admin-doc-inline-row--actions">
            {canSign ? (
              <>
                <VaultActionButton
                  label="Approve"
                  variant="primary"
                  size="lg"
                  confirm={{
                    title: "Approve this proposal?",
                    description:
                      "This records your approval for this governance proposal.",
                    confirmLabel: "Approve",
                    confirmVariant: "primary",
                  }}
                  action={approveAction}
                />
                <VaultActionButton
                  label="Reject"
                  variant="danger"
                  size="lg"
                  confirm={{
                    title: "Reject this proposal?",
                    description:
                      "This records a rejection for this governance proposal.",
                    confirmLabel: "Reject",
                    confirmVariant: "danger",
                  }}
                  action={rejectAction}
                />
              </>
            ) : null}
            {canCancel ? (
              <VaultActionButton
                label="Cancel (quorum)"
                variant="danger"
                size="lg"
                confirm={{
                  title: "Cancel this proposal?",
                  description:
                    "This will cancel the proposal and prevent further progress.",
                  confirmLabel: "Cancel proposal",
                  confirmVariant: "danger",
                }}
                action={cancelAction}
              />
            ) : null}
            {canExecute ? (
              <VaultActionButton
                label="Execute"
                variant="primary"
                size="lg"
                confirm={{
                  title: "Execute this proposal?",
                  description:
                    "This will execute the approved governance action. Confirm that all review requirements are complete.",
                  confirmLabel: "Execute",
                  confirmVariant: "primary",
                }}
                action={executeAction}
              />
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
