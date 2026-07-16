import { notFound } from "next/navigation";

import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { DynavaultChainPanel } from "@/components/admin/chain/dynavault-chain-panel";
import { DynavaultOpsReadout } from "@/components/admin/chain/dynavault-ops-readout";
import { RejectDeploymentButton } from "@/components/admin/reject-deployment-button";
import { VaultActionButton } from "@/components/admin/vault-action-button";
import { VaultAdminKpiStrip } from "@/components/vaults/vault-admin-kpi-strip";
import { VaultAllocationAdminRows } from "@/components/vaults/vault-allocation-display";
import { VaultLegalProofRows } from "@/components/vaults/vault-legal-proof-rows";
import { BentoPanel } from "@/components/catalyst/bento";
import { CockpitButton } from "@/components/catalyst/cockpit-button";
import { AdminTable } from "@/components/admin/admin-table-layout";
import { EmptySurface } from "@/components/catalyst/empty-surface";
import { requireAdmin } from "@/lib/auth/require-admin";
import { AdminDetailSection } from "@/components/admin/admin-detail-layout";
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

// Detail-table cell tokens — customers/[id] canon (AdminTable supplies the
// chrome; consumers pass their own <td>). Reused by Approvals + Subscribers.
const CELL = "px-5 py-3 ct-metric-caption align-top";
const CELL_STRONG = "px-5 py-3 ct-metric-value align-top";

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

  // A parse failure here means the stored column is corrupt, not that the
  // whitelist is legitimately empty (`parseStringArray` already treats
  // null/undefined as "[]" without throwing). Falling back to `[]` silently
  // would show every signer as "not whitelisted" — a fabricated verdict from
  // bad data. Surface the corruption instead of hiding it.
  let whitelist: string[];
  let whitelistParseError: string | null = null;
  try {
    whitelist = parseStringArray(vault.signersWhitelist, "signer whitelist");
  } catch (err) {
    whitelist = [];
    whitelistParseError =
      err instanceof Error ? err.message : "Invalid signer whitelist format";
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
    <AdminPageShell
      titleLead="Vault"
      titleAccent={vault.ticker}
      contextLabel={vault.name}
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
              {vault.status === "draft" && (
                <>
                  <CockpitButton
                    href={`/admin/vaults/${id}/edit`}
                    variant="secondary"
                    shape="rect"
                    size="lg"
                  >
                    Edit
                  </CockpitButton>
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
                          <strong className="text-[var(--ct-status-danger)]">
                            irreversible
                          </strong>
                          .
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
    >
        <VaultAdminKpiStrip
          facts={kpiFacts}
          showAumCard={vault.status === "live"}
        />

        {/* ON-CHAIN — the contract's real state, in blue, next to the Prisma
            aggregate above. The DB row and the chain are two different claims
            about the same vault; this section is where they can be compared
            instead of assumed equal. */}
        <AdminDetailSection
          label="On-chain"
          title="Contract state"
          description="Read live through the vault adapter. Blue = the value comes from the contract. A read that fails shows its reason and no value — never a fallback number."
        >
          <BentoPanel>
            <DynavaultChainPanel dbAumUsdc={aumUsdc} />
          </BentoPanel>
        </AdminDetailSection>

        <AdminDetailSection
          label="On-chain"
          title="Vault operations (v2)"
          description="Strategy pockets, mining and electricity — exclusive to PermissionedDynaVault v2.1. Blue = read through the v2 adapter; until v2 is deployed each row states its absence rather than a fabricated number."
        >
          <BentoPanel>
            <DynavaultOpsReadout />
          </BentoPanel>
        </AdminDetailSection>

        <AdminDetailSection label="Terms" title="Legal & allocation">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <BentoPanel className="p-5">
              <VaultLegalProofRows facts={legalFacts} variant="admin" />
            </BentoPanel>
            <BentoPanel className="p-5">
              <VaultAllocationAdminRows facts={allocationFacts} />
            </BentoPanel>
          </div>
        </AdminDetailSection>

        {/* Approvals — AdminTable (customers canon), EmptySurface for the zero state. */}
        <AdminDetailSection
          label="Approvals"
          title="Approvals"
          description={
            <span className="ct-metric-value mono text-[var(--ct-text-muted)]">
              {approveCount} / {vault.requiredSigners} required
            </span>
          }
        >
          {whitelistParseError ? (
            <div
              role="alert"
              className="flex flex-col gap-1 rounded-2xl border border-[var(--ct-status-danger)] bg-surface-inset p-5"
            >
              <span className="ct-metric-caption font-semibold text-[var(--ct-status-danger)]">
                Signer whitelist unreadable
              </span>
              <span className="ct-metric-caption text-[var(--ct-text-faint)]">
                {whitelistParseError} — the stored column is corrupt, not
                empty. Treating it as zero signers would misreport who can
                sign; fix the `signersWhitelist` column before relying on the
                approval buttons below.
              </span>
            </div>
          ) : null}

          {vault.status === "review" && (
            <div className="flex flex-col gap-2 rounded-2xl border border-[var(--ct-border)] bg-surface-inset p-5">
              <span className="ct-metric-caption">
                Your signer identity (must be in the whitelist for &quot;Sign
                Approval&quot; to appear):
              </span>
              <div className="flex items-center justify-between gap-3">
                <code className="ct-metric-caption break-all mono text-[var(--ct-text-strong)]">
                  {actorWallet}
                </code>
                <span
                  className={cn(
                    "ct-metric-caption font-semibold",
                    whitelist.includes(actorWallet)
                      ? "text-[var(--ct-accent)]"
                      : "text-[var(--ct-status-danger)]",
                  )}
                >
                  {whitelist.includes(actorWallet) ? "whitelisted" : "not whitelisted"}
                </span>
              </div>
            </div>
          )}

          {vault.approvals.length === 0 ? (
            <EmptySurface
              variant="widget"
              message="No signatures yet."
              detail="Approvals will appear here once signers act on the review."
              className="min-h-20"
            />
          ) : (
            <AdminTable
              data={vault.approvals}
              headers={["Signer", "Decision", <span key="reason" className="hidden md:table-cell">Reason</span>, "Date"]}
              colWidths={["35%", "15%", "35%", "15%"]}
              renderRow={(approval) => (
                <>
                  <td className={`${CELL} truncate mono tabular-nums`}>
                    {approval.signerWallet}
                  </td>
                  <td className={CELL}>
                    <span
                      className={cn(
                        "font-semibold",
                        approval.decision === "approve"
                          ? "text-[var(--ct-accent)]"
                          : "text-[var(--ct-status-danger)]",
                      )}
                    >
                      {approval.decision}
                    </span>
                  </td>
                  <td className={`${CELL} hidden wrap-break-word md:table-cell`}>
                    {approval.reason ?? "—"}
                  </td>
                  <td className={`${CELL} whitespace-nowrap mono tabular-nums text-[var(--ct-text-faint)]`}>
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
            <span className="ct-metric-value mono text-[var(--ct-text-muted)]">
              {vault.positions.length} active · {formatUsdFull(aumUsdc)}
            </span>
          }
        >
          {vault.positions.length === 0 ? (
            <EmptySurface
              variant="widget"
              message="No active subscriptions yet."
              detail="Investor positions will appear here once the vault is funded."
              className="min-h-20"
            />
          ) : (
            <AdminTable
              data={vault.positions}
              headers={["Investor", "Class", <span key="principal" className="text-right">Principal</span>, "Subscribed", "Lock-up ends"]}
              colWidths={["32%", "13%", "20%", "17%", "18%"]}
              renderRow={(pos) => {
                const classCode = classFromVaultKey(pos.vaultKey);
                const lockupEnd = new Date(
                  pos.subscribedAt.getTime() +
                    lockupDaysForClass(classCode) * 86_400_000,
                );
                return (
                  <>
                    <td className={`${CELL} truncate text-[var(--ct-text-body)]`}>
                      {pos.investor.user.email}
                    </td>
                    <td className={`${CELL} mono`}>{classCode}</td>
                    <td className={`${CELL_STRONG} text-right`}>
                      {formatUsdFull(Number(pos.principalUsdc))}
                    </td>
                    <td className={`${CELL} whitespace-nowrap`}>
                      {pos.subscribedAt.toISOString().slice(0, 10)}
                    </td>
                    <td className={`${CELL} whitespace-nowrap`}>
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
            <p className="ct-metric-caption whitespace-pre-wrap p-5 leading-relaxed">
              {vault.disclaimers}
            </p>
          </BentoPanel>
        </AdminDetailSection>
    </AdminPageShell>
  );
}
