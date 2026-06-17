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

  const usdFull = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const defaultShareClass = vault.shareClass;
  const defaultSoftLockupDays = vault.softLockupDays;

  function classFromVaultKey(vaultKey: string): string {
    return /class-([A-Z]+)$/.exec(vaultKey)?.[1] ?? defaultShareClass;
  }

  function lockupDaysForClass(classCode: string): number {
    if (classCode === "B") return 90;
    return defaultSoftLockupDays;
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
    <div className="admin-doc-shell">
      <AdminPageHeader
        title={vault.name}
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
                    title: "Soumettre pour revue ?",
                    description:
                      "Le vault passera en statut « review » et sera soumis aux signataires.",
                    confirmLabel: "Soumettre",
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
                        title: "Signer l'approbation ?",
                        description:
                          "Votre signature d'approbation sera enregistrée de façon permanente.",
                        confirmLabel: "Signer",
                        confirmVariant: "primary",
                      }}
                    />
                    <VaultActionButton
                      label="Sign Rejection"
                      variant="danger"
                      action={rejectAction}
                      confirm={{
                        title: "Signer le rejet ?",
                        description:
                          "Votre signature de rejet sera enregistrée de façon permanente.",
                        confirmLabel: "Rejeter",
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
                      title: "Forcer le déploiement ?",
                      description: (
                        <>
                          Le quorum est atteint ({distinctApproveCount}/
                          {vault.requiredSigners} signataires distincts) mais le
                          vault est resté en « review ». Cette action le passera
                          en « deployed ».
                        </>
                      ),
                      confirmLabel: "Forcer le déploiement",
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
                  title: "Passer le vault en live ?",
                  description:
                    "Le vault deviendra actif et ouvert aux souscriptions.",
                  confirmLabel: "Mettre en live",
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
                  title: "Mettre en pause ?",
                  description:
                    "Les souscriptions et l'activité du vault seront suspendues.",
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
                    title: "Reprendre l'activité ?",
                    description: "Le vault repassera en statut « live ».",
                    confirmLabel: "Reprendre",
                    confirmVariant: "primary",
                  }}
                />
                <VaultActionButton
                  label="Close Vault"
                  variant="danger"
                  action={closeAction}
                  confirm={{
                    title: "Clôturer le vault ?",
                    description: (
                      <>
                        Cette action est{" "}
                        <strong className="ct-status-danger">
                          irréversible
                        </strong>
                        . Une fois clôturé, le vault ne pourra plus jamais être
                        réactivé. Aucune transition d'état ne sera possible.
                      </>
                    ),
                    confirmLabel: "Clôturer définitivement",
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
          <div className="mt-4">
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
              Votre identifiant de signer (doit figurer dans la whitelist pour
              que « Sign Approval » apparaisse) :
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
                  <th className="w-[38%] ct-table-header stat-label text-left">Signer</th>
                  <th className="w-[24%] ct-table-header stat-label text-left">Decision</th>
                  <th className="hidden w-[26%] ct-table-header stat-label text-left md:table-cell">Reason</th>
                  <th className="w-[38%] ct-table-header stat-label text-left md:w-[12%]">Date</th>
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
            {vault.positions.length} active · {usdFull.format(aumUsdc)}
          </span>
        </div>

        {vault.positions.length === 0 ? (
          <PanelStatus message="No active subscriptions yet." />
        ) : (
          <Card className="p-0 overflow-hidden" hoverOverlay={false}>
            <table className="w-full table-fixed text-left body-sm">
              <thead>
                <tr>
                  <th className="w-[30%] ct-table-header stat-label text-left">Investor</th>
                  <th className="w-[12%] ct-table-header stat-label text-left">Class</th>
                  <th className="w-[22%] ct-table-header stat-label text-right">Principal</th>
                  <th className="w-[18%] ct-table-header stat-label text-left">Subscribed</th>
                  <th className="w-[18%] ct-table-header stat-label text-left">Lock-up ends</th>
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
                      className="border-b border-[var(--ct-border-soft)] last:border-0"
                    >
                      <td className="ct-table-cell truncate ct-text-body">
                        {pos.investor.user.email}
                      </td>
                      <td className="ct-table-cell mono ct-text-muted">
                        {classCode}
                      </td>
                      <td className="ct-table-cell text-right tabular-nums ct-text-strong">
                        {usdFull.format(Number(pos.principalUsdc))}
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
        <p className="body-sm ct-text-muted whitespace-pre-wrap mt-4">{vault.disclaimers}</p>
      </Card>
    </div>
  );
}
