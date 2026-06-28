import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { RejectDeploymentButton } from "@/components/admin/reject-deployment-button";
import { VaultActionButton } from "@/components/admin/vault-action-button";
import { VaultAdminKpiStrip } from "@/components/vaults/vault-admin-kpi-strip";
import { VaultAllocationAdminRows } from "@/components/vaults/vault-allocation-display";
import { VaultLegalProofRows } from "@/components/vaults/vault-legal-proof-rows";
import { BentoPanel, BentoHeader, BENTO_SECONDARY_BTN } from "@/components/ui/bento";
import { PanelStatus } from "@/components/ui/panel-status";
import { requireAdmin } from "@/lib/auth/require-admin";
import { AdminDetailSection } from "@/components/admin/admin-detail-layout";
import { AdminTable } from "@/components/admin/admin-table-layout";
import { parseStringArray } from "@/lib/admin/parse-string-array";
import { cn } from "@/lib/cn";
import { prisma } from "@/lib/db";
import {
  toVaultAllocationFacts,
  toVaultKpiFacts,
  toVaultLegalFacts,
} from "@/lib/vaults/vault-detail-facts";
import { formatUsdFull } from "@/lib/vaults/product-display";

import {
  closeVault,
  markAsLive,
  pauseVault,
  reconcileDeployment,
  rejectDeployment,
  resumeVault,
  signApproval,
  submitForReview,
} from "../actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function VaultDetailPage({ params }: PageProps) {
  const admin = await requireAdmin();
  const { id } = await params;

  // Resolve by cuid (existing links) OR by ticker slug (e.g. "hyv-a" from
  // distribution back-links). ticker is stored uppercase, so normalise the
  // param before comparing.
  const vault = await prisma.vaultDeployment.findFirst({
    where: { OR: [{ id }, { ticker: id.toUpperCase() }] },
    include: {
      approvals: { orderBy: { signedAt: "asc" } },
      shareClasses: {
        where: { active: true },
        select: { code: true, lockupDays: true },
      },
      positions: {
        where: { status: "active" },
        select: {
          id: true,
          principalUsdc: true,
          subscribedAt: true,
          vaultKey: true,
          investor: {
            select: {
              id: true,
              user: { select: { email: true } },
            },
          },
        },
        orderBy: { subscribedAt: "desc" },
      },
    },
  });

  if (!vault) notFound();

  const aumUsdc = vault.positions.reduce((sum, p) => sum + Number(p.principalUsdc), 0);

  const defaultShareClass = vault.shareClass;
  const defaultSoftLockupDays = vault.softLockupDays;

  // Build a lookup from share-class code → lockupDays using the rows loaded
  // above. Falls back to vault.softLockupDays when no matching ShareClass row
  // exists (e.g. legacy positions created before ShareClass rows were seeded).
  const shareClassLockupMap = new Map<string, number>(
    vault.shareClasses.map((sc) => [sc.code, sc.lockupDays]),
  );

  function classFromVaultKey(vaultKey: string): string {
    return /class-([A-Z]+)$/.exec(vaultKey)?.[1] ?? defaultShareClass;
  }

  function lockupDaysForClass(classCode: string): number {
    return shareClassLockupMap.get(classCode) ?? defaultSoftLockupDays;
  }
  const kpiFacts = toVaultKpiFacts({
    targetApyLowBps: vault.targetApyLowBps,
    targetApyHighBps: vault.targetApyHighBps,
    mgmtFeeBps: vault.mgmtFeeBps,
    perfFeeBps: vault.perfFeeBps,
    softLockupDays: vault.softLockupDays,
    capacityUsdc: Number(vault.capacityUsdc),
    aumUsdc,
  });
  const legalFacts = toVaultLegalFacts({
    strategy: vault.strategy,
    spvJurisdiction: vault.spvJurisdiction,
    shareClass: vault.shareClass,
    regExemption: vault.regExemption,
    minTicketUsdc: Number(vault.minTicketUsdc),
  });
  const allocationFacts = toVaultAllocationFacts(vault);

  let whitelist: string[];
  try {
    whitelist = parseStringArray(vault.signersWhitelist, "signer whitelist");
  } catch {
    whitelist = [];
  }
  const actorWallet = admin.walletAddress ?? admin.userId;
  const alreadySigned = vault.approvals.some((a) => a.signerWallet === actorWallet);
  const approveCount = vault.approvals.filter((a) => a.decision === "approve").length;
  // Distinct approvers — matches reconcileDeployment / signApproval quorum rule.
  const distinctApproveCount = new Set(
    vault.approvals.filter((a) => a.decision === "approve").map((a) => a.signerWallet),
  ).size;
  const canReconcile =
    vault.status === "review" && distinctApproveCount >= vault.requiredSigners;

  const submitForReviewAction = async () => {
    "use server";
    await submitForReview(id);
  };
  const approveAction = async () => {
    "use server";
    await signApproval(id, "approve");
  };
  const rejectAction = async () => {
    "use server";
    await signApproval(id, "reject", "Rejected via admin UI");
  };
  const markAsLiveAction = async () => {
    "use server";
    await markAsLive(id);
  };
  const pauseAction = async () => {
    "use server";
    await pauseVault(id);
  };
  const resumeAction = async () => {
    "use server";
    await resumeVault(id);
  };
  const closeAction = async () => {
    "use server";
    await closeVault(id);
  };
  const rejectDeploymentAction = async (reason: string) => {
    "use server";
    await rejectDeployment(id, reason);
  };
  const reconcileAction = async () => {
    "use server";
    await reconcileDeployment(id);
  };

  return (
    <div className="dark flex flex-col rounded-2xl border border-white/10 bg-surface-page mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <AdminPageHeader
          titleLead="Vault"
          titleAccent={vault.ticker}
          contextLabel={vault.name}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {vault.status === "draft" && (
                <>
                  <Link
                    href={`/admin/vaults/${id}/edit`}
                    className={BENTO_SECONDARY_BTN}
                  >
                    Edit
                  </Link>
                  <VaultActionButton
                    label="Submit for Review"
                    variant="primary"
                    action={submitForReviewAction}
                    confirm={{
                      title: "Submit for review?",
                      description:
                        "The vault will move to \"review\" status and be submitted to the signers.",
                      confirmLabel: "Submit",
                      confirmVariant: "primary",
                    }}
                  />
                </>
              )}

              {vault.status === "review" && (
                <>
                  {whitelist.includes(actorWallet) && !alreadySigned && (
                    <>
                      <VaultActionButton
                        label="Sign Approval"
                        variant="primary"
                        action={approveAction}
                        confirm={{
                          title: "Sign approval?",
                          description:
                            "Your approval signature will be recorded permanently.",
                          confirmLabel: "Sign",
                          confirmVariant: "primary",
                        }}
                      />
                      <VaultActionButton
                        label="Sign Rejection"
                        variant="danger"
                        action={rejectAction}
                        confirm={{
                          title: "Sign rejection?",
                          description:
                            "Your rejection signature will be recorded permanently.",
                          confirmLabel: "Reject",
                          confirmVariant: "danger",
                        }}
                      />
                    </>
                  )}
                  {whitelist.includes(actorWallet) && (
                    <RejectDeploymentButton action={rejectDeploymentAction} />
                  )}
                  {canReconcile && (
                    <VaultActionButton
                      label="Force reconcile"
                      variant="secondary"
                      action={reconcileAction}
                      confirm={{
                        title: "Force deployment?",
                        description: (
                          <>
                            Quorum is met ({distinctApproveCount}/
                            {vault.requiredSigners} distinct signers) but the
                            vault stayed in &quot;review&quot;. This action will move it
                            to &quot;deployed&quot;.
                          </>
                        ),
                        confirmLabel: "Force deployment",
                        confirmVariant: "primary",
                      }}
                    />
                  )}
                </>
              )}

              {vault.status === "deployed" && (
                <VaultActionButton
                  label="Mark as Live"
                  variant="primary"
                  action={markAsLiveAction}
                  confirm={{
                    title: "Set the vault live?",
                    description:
                      "The vault will become active and open to subscriptions.",
                    confirmLabel: "Set live",
                    confirmVariant: "primary",
                  }}
                />
              )}

              {vault.status === "live" && (
                <VaultActionButton
                  label="Pause"
                  variant="secondary"
                  action={pauseAction}
                  confirm={{
                    title: "Pause?",
                    description:
                      "Subscriptions and vault activity will be suspended.",
                    confirmLabel: "Pause",
                    confirmVariant: "primary",
                  }}
                />
              )}

              {vault.status === "paused" && (
                <>
                  <VaultActionButton
                    label="Resume"
                    variant="primary"
                    action={resumeAction}
                    confirm={{
                      title: "Resume activity?",
                      description: "The vault will return to \"live\" status.",
                      confirmLabel: "Resume",
                      confirmVariant: "primary",
                    }}
                  />
                  <VaultActionButton
                    label="Close Vault"
                    variant="danger"
                    action={closeAction}
                    confirm={{
                      title: "Close vault?",
                      description: (
                        <>
                          This action is{" "}
                          <strong className="text-red-400">irreversible</strong>.
                          Once closed, the vault can never be reactivated. No
                          state transition will be possible.
                        </>
                      ),
                      confirmLabel: "Close permanently",
                      confirmVariant: "danger",
                      confirmPhrase: vault.ticker,
                    }}
                  />
                </>
              )}
            </div>
          }
        />

        <VaultAdminKpiStrip
          facts={kpiFacts}
          showAumCard={vault.status === "live"}
        />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <BentoPanel>
            <BentoHeader title="Legal" />
            <div className="p-5">
              <VaultLegalProofRows facts={legalFacts} variant="admin" />
            </div>
          </BentoPanel>

          <BentoPanel>
            <BentoHeader title="Allocation Policy" />
            <div className="px-5 pb-5">
              <VaultAllocationAdminRows facts={allocationFacts} />
            </div>
          </BentoPanel>
        </div>

        {/* Approvals — table shell only (no panel double frame; cf. audit/customers). */}
        <AdminDetailSection
          label="Approvals"
          title="Approvals"
          description={
            <span className="font-mono text-[13px] tabular-nums text-zinc-400">
              {approveCount} / {vault.requiredSigners} required
            </span>
          }
        >
          {vault.status === "review" && (
            <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-surface-inset p-5">
              <span className="text-[12px] text-zinc-400">
                Your signer identity (must be in the whitelist for &quot;Sign
                Approval&quot; to appear):
              </span>
              <div className="flex items-center justify-between gap-3">
                <code className="break-all font-mono text-[12px] text-white">{actorWallet}</code>
                <span
                  className={cn(
                    "text-[12px] font-semibold",
                    whitelist.includes(actorWallet)
                      ? "text-[#A7FB90]"
                      : "text-red-400",
                  )}
                >
                  {whitelist.includes(actorWallet) ? "whitelisted" : "not whitelisted"}
                </span>
              </div>
            </div>
          )}

          {vault.approvals.length === 0 ? (
            <PanelStatus message="No signatures yet." />
          ) : (
            <AdminTable
              data={vault.approvals}
              headers={["Signer", "Decision", <span key="reason" className="hidden md:inline">Reason</span>, "Date"]}
              colWidths={[
                "w-[38%]",
                "w-[24%]",
                "hidden w-[26%] md:table-cell",
                "w-[38%] md:w-[12%]",
              ]}
              renderRow={(approval) => (
                <>
                  <td className="truncate px-5 py-4 align-top font-mono text-[12px] tabular-nums text-zinc-400">
                    {approval.signerWallet}
                  </td>
                  <td className="px-5 py-4 align-top">
                    <span
                      className={cn(
                        "text-[12px] font-semibold",
                        approval.decision === "approve"
                          ? "text-[#A7FB90]"
                          : "text-red-400",
                      )}
                    >
                      {approval.decision}
                    </span>
                  </td>
                  <td className="hidden px-5 py-4 align-top text-[12px] text-zinc-400 wrap-break-word md:table-cell">
                    {approval.reason ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 align-top font-mono text-[12px] tabular-nums text-zinc-600">
                    {approval.signedAt.toISOString().slice(0, 10)}
                  </td>
                </>
              )}
            />
          )}
        </AdminDetailSection>

        {/* Subscribers — visible once vault has at least one active position */}
        <AdminDetailSection
          label="Subscribers"
          title="Subscribers"
          description={
            <span className="font-mono text-[13px] tabular-nums text-zinc-400">
              {vault.positions.length} active · {formatUsdFull(aumUsdc)}
            </span>
          }
        >
          {vault.positions.length === 0 ? (
            <PanelStatus message="No active subscriptions yet." />
          ) : (
            <AdminTable
              data={vault.positions}
              headers={["Investor", "Class", <span key="principal" className="text-right">Principal</span>, "Subscribed", "Lock-up ends"]}
              colWidths={[
                "w-[30%]",
                "w-[12%]",
                "w-[22%] text-right",
                "w-[18%]",
                "w-[18%]",
              ]}
              renderRow={(pos) => {
                const classCode = classFromVaultKey(pos.vaultKey);
                const lockupEnd = new Date(
                  pos.subscribedAt.getTime() +
                    lockupDaysForClass(classCode) * 86_400_000,
                );
                return (
                  <>
                    <td className="truncate px-5 py-4 align-top text-[13px] text-zinc-300">
                      {pos.investor.user.email}
                    </td>
                    <td className="px-5 py-4 align-top font-mono text-[13px] text-zinc-400">
                      {classCode}
                    </td>
                    <td className="px-5 py-4 text-right align-top font-medium tabular-nums text-white">
                      {formatUsdFull(Number(pos.principalUsdc))}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 align-top text-[12px] text-zinc-400">
                      {pos.subscribedAt.toISOString().slice(0, 10)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 align-top text-[12px] text-zinc-400">
                      {lockupEnd.toISOString().slice(0, 10)}
                    </td>
                  </>
                );
              }}
            />
          )}
        </AdminDetailSection>

        {/* Disclaimers */}
        <AdminDetailSection label="Disclaimers" title="Disclaimers">
          <BentoPanel>
            <p className="whitespace-pre-wrap p-5 text-[13px] text-zinc-400">
              {vault.disclaimers}
            </p>
          </BentoPanel>
        </AdminDetailSection>
      </div>
    </div>
  );
}
