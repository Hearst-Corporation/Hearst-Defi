import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { RejectDeploymentButton } from "@/components/admin/reject-deployment-button";
import { VaultActionButton } from "@/components/admin/vault-action-button";
import { ApyRange } from "@/components/ui/apy-range";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { STRATEGY_LABELS, REG_LABELS, SPV_LABELS } from "@/lib/constants/vault";

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
    <div className="space-y-8">
      <AdminPageHeader
        title={vault.name}
        actions={
        <div className="flex flex-wrap items-center gap-3">
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
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="stat-label">Target APY</span>
            <ProvenanceBadge kind="estimated" />
          </div>
          <ApyRange low={apyLow} high={apyHigh} precision={1} />
          <p className="body-xs ct-text-faint mt-1">Not guaranteed — estimated</p>
        </Card>

        <Card>
          <span className="stat-label block mb-1">Fees</span>
          <span className="mono tabular text-base font-semibold ct-text-strong">
            {pct(vault.mgmtFeeBps)}% / {pct(vault.perfFeeBps)}%
          </span>
          <p className="body-xs ct-text-faint mt-1">Mgmt / Perf</p>
        </Card>

        <Card>
          <span className="stat-label block mb-1">Lock-up</span>
          <span className="mono tabular text-base font-semibold ct-text-strong">
            {vault.softLockupDays}d
          </span>
          <p className="body-xs ct-text-faint mt-1">Soft lock-up</p>
        </Card>

        {vault.status === "live" && (
          <Card>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="stat-label">AUM</span>
              <ProvenanceBadge kind={aumUsdc > 0 ? "live" : "estimated"} />
            </div>
            <span className="mono tabular text-base font-semibold ct-text-strong">
              ${aumUsdc.toLocaleString()}
            </span>
            <div className="mt-2">
              <Progress value={aumPct} label="AUM vs capacity" />
            </div>
            <p className="body-xs ct-text-faint mt-1">
              / ${capacityUsdc.toLocaleString()} capacity
            </p>
          </Card>
        )}
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Legal */}
        <Card>
          <CardHeader>
            <CardTitle>Legal</CardTitle>
          </CardHeader>
          <dl className="space-y-3">
            {(
              [
                ["Strategy", STRATEGY_LABELS[vault.strategy] ?? vault.strategy],
                ["SPV", SPV_LABELS[vault.spvJurisdiction] ?? vault.spvJurisdiction],
                ["Share Class", vault.shareClass],
                ["Reg Exemption", REG_LABELS[vault.regExemption] ?? vault.regExemption],
                ["Min Ticket", `$${Number(vault.minTicketUsdc).toLocaleString()} USDC`],
              ] as [string, string][]
            ).map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-3">
                <dt className="stat-label">{label}</dt>
                <dd className="body-sm ct-text-primary text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        {/* Allocation policy */}
        <Card>
          <CardHeader>
            <CardTitle>Allocation Policy</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            {(
              [
                ["Mining", vault.targetMiningBps],
                ["BTC Tactical", vault.targetBtcTacticalBps],
                ["USDC Base", vault.targetUsdcBaseBps],
                ["Stable Reserve", vault.targetStableReserveBps],
              ] as [string, number][]
            ).map(([label, bps]) => (
              <div key={label} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="stat-label">{label}</span>
                  <span className="mono tabular text-sm ct-text-primary">
                    {pct(bps)}%
                  </span>
                </div>
                <Progress value={bps} max={10000} label={`${label} allocation`} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Approvals */}
      <Card>
        <CardHeader>
          <CardTitle>Approvals</CardTitle>
          <span className="mono tabular text-sm ct-text-muted">
            {approveCount} / {vault.requiredSigners} required
          </span>
        </CardHeader>

        {vault.approvals.length === 0 ? (
          <p className="body-sm ct-text-muted">No signatures yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--ct-border-soft)]">
                  <th className="stat-label text-left pb-2">Signer</th>
                  <th className="stat-label text-left pb-2">Decision</th>
                  <th className="stat-label text-left pb-2">Reason</th>
                  <th className="stat-label text-left pb-2">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {vault.approvals.map((approval) => (
                  <tr key={approval.id}>
                    <td className="py-2 pr-4 mono tabular text-xs ct-text-muted truncate max-w-xs">
                      {approval.signerWallet}
                    </td>
                    <td className="py-2 pr-4">
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
                    <td className="py-2 pr-4 body-xs ct-text-muted">
                      {approval.reason ?? "—"}
                    </td>
                    <td className="py-2 pr-4 body-xs ct-text-faint tabular mono">
                      {approval.signedAt.toISOString().slice(0, 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Disclaimers */}
      <Card>
        <CardHeader>
          <CardTitle>Disclaimers</CardTitle>
        </CardHeader>
        <p className="body-sm ct-text-muted whitespace-pre-wrap">{vault.disclaimers}</p>
      </Card>
    </div>
  );
}
