import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { RejectDeploymentButton } from "@/components/admin/reject-deployment-button";
import { VaultActionButton } from "@/components/admin/vault-action-button";
import { VaultAdminKpiStrip } from "@/components/vaults/vault-admin-kpi-strip";
import { VaultAllocationAdminRows } from "@/components/vaults/vault-allocation-display";
import { VaultLegalProofRows } from "@/components/vaults/vault-legal-proof-rows";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PanelStatus } from "@/components/ui/panel-status";
import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import { requireAdmin } from "@/lib/auth/require-admin";
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

import "../../admin-strategy.css";

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
    <>
      <AdminPageHeader
        titleLead="Vault"
        titleAccent={vault.ticker}
        contextLabel={vault.name}
        actions={
          <div className="admin-doc-inline-row admin-doc-inline-row--actions">
            {vault.status === "draft" && (
              <>
                <Button variant="secondary" size="md" asChild>
                  <Link href={`/admin/vaults/${id}/edit`}>Edit</Link>
                </Button>
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
                        <strong className="ct-status-danger">
                          irreversible
                        </strong>
                        . Once closed, the vault can never be reactivated. No
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

      <div className="admin-doc-split-grid">
        <Card hoverOverlay={false}>
          <DashboardPanelHeader title="Legal" />
          <div className="mt-(--ct-space-4)">
            <VaultLegalProofRows facts={legalFacts} variant="admin" />
          </div>
        </Card>

        <Card hoverOverlay={false}>
          <DashboardPanelHeader title="Allocation Policy" />
          <VaultAllocationAdminRows facts={allocationFacts} />
        </Card>
      </div>

      {/* Approvals — table shell only (no Card double frame; cf. audit/customers). */}
      <section className="admin-doc-stack admin-doc-stack--compact" aria-label="Approvals">
        <div className="admin-doc-inline-row admin-doc-inline-row--between admin-doc-inline-row--relaxed">
          <DashboardPanelHeader title="Approvals" className="mb-0" />
          <span className="mono tabular body-sm ct-text-muted">
            {approveCount} / {vault.requiredSigners} required
          </span>
        </div>

        {vault.status === "review" && (
          <div className="admin-doc-inset admin-doc-stack admin-doc-stack--tight">
            <span className="body-xs ct-text-muted">
              Your signer identity (must be in the whitelist for &quot;Sign
              Approval&quot; to appear):
            </span>
            <div className="admin-doc-inline-row admin-doc-inline-row--between">
              <code className="mono body-xs ct-text-strong break-all">{actorWallet}</code>
              <span
                className={cn(
                  "body-xs font-semibold",
                  whitelist.includes(actorWallet)
                    ? "ct-status-success"
                    : "ct-status-danger",
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
          <Card className="p-0 overflow-hidden" hoverOverlay={false}>
            <table className="w-full table-fixed text-left body-sm">
              <thead>
                <tr>
                  <th className="admin-strategy-approvals-col--signer ct-table-header stat-label text-left">Signer</th>
                  <th className="admin-strategy-approvals-col--decision ct-table-header stat-label text-left">Decision</th>
                  <th className="hidden admin-strategy-approvals-col--reason ct-table-header stat-label text-left md:table-cell">Reason</th>
                  <th className="admin-strategy-approvals-col--date ct-table-header stat-label text-left">Date</th>
                </tr>
              </thead>
              <tbody>
                {vault.approvals.map((approval) => (
                  <tr key={approval.id}>
                    <td className="ct-table-cell mono tabular body-xs ct-text-muted truncate align-top">
                      {approval.signerWallet}
                    </td>
                    <td className="ct-table-cell align-top">
                      <span
                        className={cn(
                          "body-xs font-semibold",
                          approval.decision === "approve"
                            ? "ct-status-success"
                            : "ct-status-danger",
                        )}
                      >
                        {approval.decision}
                      </span>
                    </td>
                    <td className="hidden ct-table-cell body-xs ct-text-muted wrap-break-word align-top md:table-cell">
                      {approval.reason ?? "—"}
                    </td>
                    <td className="ct-table-cell body-xs ct-text-faint tabular mono whitespace-nowrap align-top">
                      {approval.signedAt.toISOString().slice(0, 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      {/* Subscribers — visible once vault has at least one active position */}
      <section className="admin-doc-stack admin-doc-stack--compact" aria-label="Subscribers">
        <div className="admin-doc-inline-row admin-doc-inline-row--between admin-doc-inline-row--relaxed">
          <DashboardPanelHeader title="Subscribers" className="mb-0" />
          <span className="mono tabular body-sm ct-text-muted">
            {vault.positions.length} active · {formatUsdFull(aumUsdc)}
          </span>
        </div>

        {vault.positions.length === 0 ? (
          <PanelStatus message="No active subscriptions yet." />
        ) : (
          <Card className="p-0 overflow-hidden" hoverOverlay={false}>
            <table className="w-full table-fixed text-left body-sm">
              <thead>
                <tr>
                  <th className="admin-strategy-subs-col--investor ct-table-header stat-label text-left">Investor</th>
                  <th className="admin-strategy-subs-col--class ct-table-header stat-label text-left">Class</th>
                  <th className="admin-strategy-subs-col--principal ct-table-header stat-label text-right">Principal</th>
                  <th className="admin-strategy-subs-col--subscribed ct-table-header stat-label text-left">Subscribed</th>
                  <th className="admin-strategy-subs-col--lockup ct-table-header stat-label text-left">Lock-up ends</th>
                </tr>
              </thead>
              <tbody>
                {vault.positions.map((pos) => {
                  const classCode = classFromVaultKey(pos.vaultKey);
                  const lockupEnd = new Date(
                    pos.subscribedAt.getTime() +
                      lockupDaysForClass(classCode) * 86_400_000,
                  );
                  return (
                    <tr
                      key={pos.id}
                      className="admin-strategy-subs-row"
                    >
                      <td className="ct-table-cell truncate ct-text-body">
                        {pos.investor.user.email}
                      </td>
                      <td className="ct-table-cell mono ct-text-muted">
                        {classCode}
                      </td>
                      <td className="ct-table-cell text-right tabular-nums ct-text-strong">
                        {formatUsdFull(Number(pos.principalUsdc))}
                      </td>
                      <td className="ct-table-cell body-xs ct-text-muted whitespace-nowrap">
                        {pos.subscribedAt.toISOString().slice(0, 10)}
                      </td>
                      <td className="ct-table-cell body-xs ct-text-muted whitespace-nowrap">
                        {lockupEnd.toISOString().slice(0, 10)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      {/* Disclaimers */}
      <Card hoverOverlay={false}>
        <DashboardPanelHeader title="Disclaimers" />
        <p className="body-sm ct-text-muted whitespace-pre-wrap mt-(--ct-space-4)">{vault.disclaimers}</p>
      </Card>
    </>
  );
}
