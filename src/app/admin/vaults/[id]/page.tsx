import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { RejectDeploymentButton } from "@/components/admin/reject-deployment-button";
import { VaultActionButton } from "@/components/admin/vault-action-button";
import { ApyRange } from "@/components/ui/apy-range";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PanelStatus } from "@/components/ui/panel-status";
import { ProofRow } from "@/components/ui/nested-panel";
import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import { Progress } from "@/components/ui/progress";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { STRATEGY_LABELS, REG_LABELS, SPV_LABELS } from "@/lib/constants/vault";
import { formatUsdFull } from "@/lib/vaults/product-display";

import {
  closeVault,
  markAsLive,
  pauseVault,
  rejectDeployment,
  resumeVault,
  signApproval,
  submitForReview,
} from "../actions";

export const dynamic = "force-dynamic";

function pct(bps: number) {
  return (bps / 100).toFixed(1);
}

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
      positions: { where: { status: "active" }, select: { principalUsdc: true } },
    },
  });

  if (!vault) notFound();

  const aumUsdc = vault.positions.reduce((sum, p) => sum + Number(p.principalUsdc), 0);
  const capacityUsdc = Number(vault.capacityUsdc);
  const aumPct = capacityUsdc > 0 ? (aumUsdc / capacityUsdc) * 100 : 0;
  const apyLow = Number(vault.targetApyLowBps) / 100;
  const apyHigh = Number(vault.targetApyHighBps) / 100;

  let whitelist: string[];
  try {
    whitelist = JSON.parse(vault.signersWhitelist ?? "[]") as string[];
  } catch {
    whitelist = [];
  }
  const actorWallet = admin.walletAddress ?? admin.userId;
  const alreadySigned = vault.approvals.some((a) => a.signerWallet === actorWallet);
  const approveCount = vault.approvals.filter((a) => a.decision === "approve").length;

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

      {/* KPIs */}
      <div className="admin-doc-kpi-grid-4">
        <Card>
          <div className="admin-doc-inline-row admin-doc-inline-row--between mb-1">
            <span className="stat-label">Target APY</span>
            <ProvenanceBadge kind="estimated" />
          </div>
          <ApyRange low={apyLow} high={apyHigh} precision={1} />
          <p className="body-xs ct-text-faint mt-1">Not guaranteed — estimated</p>
        </Card>

        <Card>
          <span className="stat-label block mb-1">Fees</span>
          <span className="stat-value mono tabular">
            {pct(vault.mgmtFeeBps)}% / {pct(vault.perfFeeBps)}%
          </span>
          <p className="body-xs ct-text-faint mt-1">Mgmt / Perf</p>
        </Card>

        <Card>
          <span className="stat-label block mb-1">Lock-up</span>
          <span className="stat-value mono tabular">
            {vault.softLockupDays}d
          </span>
          <p className="body-xs ct-text-faint mt-1">Soft lock-up</p>
        </Card>

        {vault.status === "live" && (
          <Card>
            <div className="admin-doc-inline-row admin-doc-inline-row--between mb-1">
              <span className="stat-label">AUM</span>
              <ProvenanceBadge kind={aumUsdc > 0 ? "live" : "estimated"} />
            </div>
            <span className="stat-value mono tabular">
              {formatUsdFull(aumUsdc)}
            </span>
            <div className="mt-2">
              <Progress value={aumPct} label="AUM vs capacity" />
            </div>
            <p className="body-xs ct-text-faint mt-1">
              / {formatUsdFull(capacityUsdc)} capacity
            </p>
          </Card>
        )}
      </div>

      {/* Details */}
      <div className="admin-doc-split-grid">
        {/* Legal */}
        <Card>
          <DashboardPanelHeader title="Legal" />
          <div className="mt-4">
            {(
              [
                ["Strategy", STRATEGY_LABELS[vault.strategy] ?? vault.strategy],
                ["SPV", SPV_LABELS[vault.spvJurisdiction] ?? vault.spvJurisdiction],
                ["Share Class", vault.shareClass],
                ["Reg Exemption", REG_LABELS[vault.regExemption] ?? vault.regExemption],
                ["Min Ticket", `${formatUsdFull(Number(vault.minTicketUsdc))} USDC`],
              ] as [string, string][]
            ).map(([label, value]) => (
              <ProofRow key={label} label={label}>
                {value}
              </ProofRow>
            ))}
          </div>
        </Card>

        {/* Allocation policy */}
        <Card>
          <DashboardPanelHeader title="Allocation Policy" />
          <div className="mt-4 admin-doc-stack--relaxed">
            {(
              [
                ["Mining", vault.targetMiningBps],
                ["BTC Tactical", vault.targetBtcTacticalBps],
                ["USDC Base", vault.targetUsdcBaseBps],
                ["Stable Reserve", vault.targetStableReserveBps],
              ] as [string, number][]
            ).map(([label, bps]) => (
              <div key={label} className="admin-doc-stack--compact">
                <div className="admin-doc-row-spread">
                  <span className="stat-label">{label}</span>
                  <span className="mono tabular body-sm ct-text-primary">
                    {pct(bps)}%
                  </span>
                </div>
                <Progress value={bps} max={10000} label={`${label} allocation`} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Approvals — table shell only (no Card double frame; cf. audit/customers). */}
      <section className="admin-doc-stack--compact" aria-label="Approvals">
        <div className="admin-doc-inline-row admin-doc-inline-row--between admin-doc-inline-row--baseline admin-doc-inline-row--relaxed">
          <DashboardPanelHeader title="Approvals" className="mb-0" />
          <span className="mono tabular body-sm ct-text-muted">
            {approveCount} / {vault.requiredSigners} required
          </span>
        </div>

        {vault.approvals.length === 0 ? (
          <PanelStatus message="No signatures yet." />
        ) : (
          <div className="ct-table-surface">
            <table className="w-full border-collapse text-left body-sm">
              <thead>
                <tr>
                  <th className="ct-table-header px-5 py-3 stat-label text-left">Signer</th>
                  <th className="ct-table-header px-5 py-3 stat-label text-left">Decision</th>
                  <th className="ct-table-header px-5 py-3 stat-label text-left">Reason</th>
                  <th className="ct-table-header px-5 py-3 stat-label text-left">Date</th>
                </tr>
              </thead>
              <tbody>
                {vault.approvals.map((approval) => (
                  <tr key={approval.id}>
                    <td className="ct-table-cell px-5 py-3 mono tabular body-xs ct-text-muted truncate max-w-xs">
                      {approval.signerWallet}
                    </td>
                    <td className="ct-table-cell px-5 py-3">
                      <span
                        className={
                          approval.decision === "approve"
                            ? "ct-status-success body-xs font-semibold"
                            : "ct-status-danger body-xs font-semibold"
                        }
                      >
                        {approval.decision}
                      </span>
                    </td>
                    <td className="ct-table-cell px-5 py-3 body-xs ct-text-muted">
                      {approval.reason ?? "—"}
                    </td>
                    <td className="ct-table-cell px-5 py-3 body-xs ct-text-faint tabular mono">
                      {approval.signedAt.toISOString().slice(0, 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Disclaimers */}
      <Card>
        <DashboardPanelHeader title="Disclaimers" />
        <p className="body-sm ct-text-muted whitespace-pre-wrap mt-4">{vault.disclaimers}</p>
      </Card>
    </div>
  );
}
