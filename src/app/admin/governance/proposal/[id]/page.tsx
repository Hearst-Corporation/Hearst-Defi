import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { VaultActionButton } from "@/components/admin/vault-action-button";
import { Badge } from "@/components/catalyst/badge";
import { Ptai } from "@/components/ui/ptai";
import {
  BentoPanel,
  BentoHeader,
  BentoKpiTile,
} from "@/components/ui/bento";
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

// One green: #A7FB90. Governance display variant → Catalyst Badge color.
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
    <div className="dark flex flex-col rounded-2xl border border-white/10 bg-surface-page mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <AdminPageHeader
          titleLead="Proposal"
          titleAccent={proposal.actionType}
          contextLabel="Governance · Proposal"
          lead={
            <Link
              href="/admin/governance"
              className="text-[#A7FB90] transition-colors hover:text-[#A7FB90]/80"
              aria-label="Back to governance"
            >
              ← Governance
            </Link>
          }
        />

        {/* ── Proposal meta ─────────────────────────────────────────────── */}
        <BentoPanel aria-label="Proposal meta">
          <BentoHeader
            title="Proposal meta"
            trailing={
              <div className="flex items-center gap-2">
                <Badge color="green" className="font-mono text-[10px]! uppercase tracking-wider">
                  {proposal.vaultTicker}
                </Badge>
                <Badge
                  color={STATE_BADGE_COLOR[proposalStateVariant(proposal.state)]}
                  className="text-[10px]! uppercase tracking-widest"
                >
                  {proposalStateLabel(proposal.state)}
                </Badge>
              </div>
            }
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-white/5">
            <BentoKpiTile
              label="Proposed by"
              value={<span className="font-mono text-[14px] break-all">{proposal.proposedBy}</span>}
              className="bg-surface-card"
            />
            <BentoKpiTile
              label="Required signers"
              value={proposal.requiredSigners}
              className="bg-surface-card"
            />
            <BentoKpiTile
              label="Created"
              value={
                <span className="text-[14px]">
                  {formatGovernanceTimestamp(proposal.createdAt)}
                </span>
              }
              className="bg-surface-card"
            />
            <BentoKpiTile
              label="ETA (timelock)"
              value={
                <span className="text-[14px]">
                  {formatGovernanceTimestamp(proposal.etaAt)}
                </span>
              }
              className="bg-surface-card"
            />
            {proposal.executedAt ? (
              <BentoKpiTile
                label="Executed at"
                value={
                  <span className="text-[14px]">
                    {formatGovernanceTimestamp(proposal.executedAt)}
                  </span>
                }
                className="bg-surface-card"
              />
            ) : null}
            {proposal.cancelledAt ? (
              <BentoKpiTile
                label="Cancelled at"
                value={
                  <span className="text-[14px]">
                    {formatGovernanceTimestamp(proposal.cancelledAt)}
                  </span>
                }
                className="bg-surface-card"
              />
            ) : null}
          </div>

          {proposal.state === "TIMELOCK" && proposal.etaAt ? (
            <div className="p-5 lg:p-6 border-t border-white/5">
              <div className="flex flex-col gap-1.5 rounded-lg border border-white/10 bg-surface-inset p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                  Timelock countdown
                </p>
                <p className="font-mono text-[14px] text-white">
                  {timelockCountdown(proposal.etaAt)}
                </p>
              </div>
            </div>
          ) : null}
        </BentoPanel>

        {/* ── PTAI ──────────────────────────────────────────────────────── */}
        {ptai ? (
          <BentoPanel aria-label="PTAI">
            <BentoHeader
              title="PTAI"
              subtitle="Projection · Trigger · Action · Impact"
            />
            <div className="p-5 lg:p-6 flex flex-col gap-3">
              <Ptai
                projection={ptai.projection}
                trigger={ptai.trigger}
                action={ptai.action}
                impact={ptai.impact}
              />
              <p className="text-[11px] italic text-zinc-500">
                Conditional projection — not guaranteed. Methodology v1.0.
              </p>
            </div>
          </BentoPanel>
        ) : null}

        {/* ── Justification ─────────────────────────────────────────────── */}
        <BentoPanel aria-label="Justification">
          <BentoHeader title="Justification" />
          <div className="p-5 lg:p-6">
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-zinc-200">
              {proposal.justification}
            </p>
          </div>
        </BentoPanel>

        {/* ── Calldata ──────────────────────────────────────────────────── */}
        {proposal.calldata ? (
          <BentoPanel aria-label="Calldata">
            <BentoHeader title="Calldata" />
            <div className="p-5 lg:p-6">
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-[#0F1316] p-4 font-mono text-[11px] text-zinc-400">
                {formatProposalCalldata(proposal.calldata)}
              </pre>
            </div>
          </BentoPanel>
        ) : null}

        {/* ── Signatures ────────────────────────────────────────────────── */}
        <BentoPanel aria-label="Signatures">
          <BentoHeader
            title={`Signatures (${proposal.approvalCount}/${proposal.requiredSigners} approved${
              proposal.rejectionCount > 0 ? `, ${proposal.rejectionCount} rejected` : ""
            }${proposal.cancelCount > 0 ? `, ${proposal.cancelCount} cancel` : ""})`}
          />
          <div className="p-5 lg:p-6">
            {proposal.signatures.length === 0 ? (
              <p className="text-[13px] text-zinc-500">No signatures yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {proposal.signatures.map((sig) => (
                  <div
                    key={sig.id}
                    className="flex items-center gap-3 rounded-lg border border-white/10 bg-surface-inset p-3"
                  >
                    <div
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full border text-[12px] font-bold",
                        sig.decision === "approve"
                          ? "border-[#A7FB90]/30 bg-[#A7FB90]/10 text-[#A7FB90]"
                          : sig.decision === "reject"
                            ? "border-red-400/30 bg-red-400/10 text-red-400"
                            : "border-white/10 bg-white/5 text-zinc-400",
                      )}
                    >
                      {sig.decision === "approve" ? "✓" : sig.decision === "reject" ? "✗" : "⊘"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-mono text-[12px] text-zinc-200">
                        {sig.signerAddress}
                      </span>
                      {sig.reason ? (
                        <p className="truncate text-[11px] text-zinc-500">{sig.reason}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-[11px] tabular-nums text-zinc-500">
                      {formatGovernanceTimestamp(sig.signedAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </BentoPanel>

        {/* ── Actions ───────────────────────────────────────────────────── */}
        {!isTerminal ? (
          <BentoPanel aria-label="Actions">
            <BentoHeader title="Actions" />
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
              <p className="text-[12px] text-zinc-500">
                Actions are recorded on-chain mock only — no Solidity calls at this stage.
              </p>
            </div>
          </BentoPanel>
        ) : null}
      </div>
    </div>
  );
}
