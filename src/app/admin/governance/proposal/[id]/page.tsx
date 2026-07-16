import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageShell, AdminSectionCard } from "@/components/admin/admin-page-shell";
import { VaultActionButton } from "@/components/admin/vault-action-button";
import { Badge } from "@/components/catalyst/badge";
import { Ptai } from "@/components/catalyst/ptai";
import { BentoKpiTile } from "@/components/catalyst/bento";
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

// One green (--ct-accent via Catalyst dark "green"). Governance display variant
// → Catalyst Badge color.
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
    <AdminPageShell
      titleLead="Proposal"
      titleAccent={proposal.actionType}
      contextLabel="Governance · Proposal"
      lead={
        <Link
          href="/admin/governance"
          className="ct-metric-caption transition-colors hover:text-[var(--ct-text-strong)]"
          aria-label="Back to governance"
        >
          ← Governance
        </Link>
      }
    >

        {/* ── Proposal meta ─────────────────────────────────────────────── */}
        <AdminSectionCard
          ariaLabel="Proposal meta"
          title="Proposal meta"
          subtitle="Proposer, signer quorum, timelock, and lifecycle timestamps."
          headerTrailing={
            <>
              <Badge color="green" className="mono uppercase">
                {proposal.vaultTicker}
              </Badge>
              <Badge
                color={STATE_BADGE_COLOR[proposalStateVariant(proposal.state)]}
                className="uppercase"
              >
                {proposalStateLabel(proposal.state)}
              </Badge>
            </>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[var(--ct-border-soft)]">
            <BentoKpiTile
              label="Proposed by"
              value={<span className="mono break-all">{proposal.proposedBy}</span>}
              className="bg-surface-card"
            />
            <BentoKpiTile
              label="Required signers"
              value={proposal.requiredSigners}
              className="bg-surface-card"
            />
            <BentoKpiTile
              label="Created"
              value={formatGovernanceTimestamp(proposal.createdAt)}
              className="bg-surface-card"
            />
            <BentoKpiTile
              label="ETA (timelock)"
              value={formatGovernanceTimestamp(proposal.etaAt)}
              className="bg-surface-card"
            />
            {proposal.executedAt ? (
              <BentoKpiTile
                label="Executed at"
                value={formatGovernanceTimestamp(proposal.executedAt)}
                className="bg-surface-card"
              />
            ) : null}
            {proposal.cancelledAt ? (
              <BentoKpiTile
                label="Cancelled at"
                value={formatGovernanceTimestamp(proposal.cancelledAt)}
                className="bg-surface-card"
              />
            ) : null}
          </div>

          {proposal.state === "TIMELOCK" && proposal.etaAt ? (
            <div className="p-5 lg:p-6 border-t border-[var(--ct-border-soft)]">
              <div className="flex flex-col gap-1.5 rounded-lg border border-[var(--ct-border)] bg-surface-inset p-4">
                <p className="ct-bento-label">Timelock countdown</p>
                <p className="ct-metric-value mono">
                  {timelockCountdown(proposal.etaAt)}
                </p>
              </div>
            </div>
          ) : null}
        </AdminSectionCard>

        {/* ── PTAI ──────────────────────────────────────────────────────── */}
        {ptai ? (
          <AdminSectionCard
            ariaLabel="PTAI"
            title="PTAI"
            subtitle="Projection · Trigger · Action · Impact"
          >
            <div className="p-5 lg:p-6 flex flex-col gap-3">
              <Ptai
                projection={ptai.projection}
                trigger={ptai.trigger}
                action={ptai.action}
                impact={ptai.impact}
              />
              <p className="ct-metric-caption italic">
                Conditional projection — not guaranteed. Methodology v3.0.
              </p>
            </div>
          </AdminSectionCard>
        ) : null}

        {/* ── Justification ─────────────────────────────────────────────── */}
        <AdminSectionCard ariaLabel="Justification" title="Justification" subtitle="Rationale recorded by the proposer for this governance action.">
          <div className="p-5 lg:p-6">
            <p className="body-sm whitespace-pre-wrap leading-relaxed text-[var(--ct-text-body)]">
              {proposal.justification}
            </p>
          </div>
        </AdminSectionCard>

        {/* ── Calldata ──────────────────────────────────────────────────── */}
        {proposal.calldata ? (
          <AdminSectionCard ariaLabel="Calldata" title="Calldata" subtitle="Encoded transaction payload to be executed on-chain.">
            <div className="p-5 lg:p-6">
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-[var(--ct-border)] bg-[var(--ct-surface-inset)] p-4 mono text-[length:var(--ct-text-nano)] text-[var(--ct-text-body)]">
                {formatProposalCalldata(proposal.calldata)}
              </pre>
            </div>
          </AdminSectionCard>
        ) : null}

        {/* ── Signatures ────────────────────────────────────────────────── */}
        <AdminSectionCard
          ariaLabel="Signatures"
          title={`Signatures (${proposal.approvalCount}/${proposal.requiredSigners} approved${
            proposal.rejectionCount > 0 ? `, ${proposal.rejectionCount} rejected` : ""
          }${proposal.cancelCount > 0 ? `, ${proposal.cancelCount} cancel` : ""})`}
          subtitle="Approvers who have signed; quorum required before execution."
        >
          <div className="p-5 lg:p-6">
            {proposal.signatures.length === 0 ? (
              <p className="ct-metric-caption">No signatures yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {proposal.signatures.map((sig) => (
                  <div
                    key={sig.id}
                    className="flex items-center gap-3 rounded-lg border border-[var(--ct-border)] bg-surface-inset p-3"
                  >
                    <div
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full border text-[length:var(--ct-text-2xs)] font-bold",
                        sig.decision === "approve"
                          ? "border-[var(--ct-status-success-border)] bg-[var(--ct-status-success-soft)] text-[var(--ct-accent)]"
                          : sig.decision === "reject"
                            ? "border-[var(--ct-status-danger-border)] bg-[var(--ct-status-danger-soft)] text-[var(--ct-status-danger)]"
                            : "border-[var(--ct-border)] bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] text-[var(--ct-text-muted)]",
                      )}
                    >
                      {sig.decision === "approve" ? "✓" : sig.decision === "reject" ? "✗" : "⊘"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="mono break-all text-[length:var(--ct-text-2xs)] text-[var(--ct-text-body)]">
                        {sig.signerAddress}
                      </span>
                      {sig.reason ? (
                        <p className="ct-metric-caption truncate">{sig.reason}</p>
                      ) : null}
                    </div>
                    <span className="ct-metric-caption shrink-0 tabular-nums">
                      {formatGovernanceTimestamp(sig.signedAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </AdminSectionCard>

        {/* ── Actions ───────────────────────────────────────────────────── */}
        {!isTerminal ? (
          <AdminSectionCard ariaLabel="Actions" title="Actions" subtitle="Sign, timelock, execute, or cancel this proposal.">
            <div className="p-5 lg:p-6 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
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
              <p className="ct-metric-caption">
                Actions are recorded on-chain mock only — no Solidity calls at this stage.
              </p>
            </div>
          </AdminSectionCard>
        ) : null}
    </AdminPageShell>
  );
}
