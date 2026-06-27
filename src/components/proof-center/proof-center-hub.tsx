import { resolveAttestationProvenance } from "@/components/proof-center/formatters";
import type { Provenance as ProvenanceKind } from "@/components/ui/provenance-badge";
import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import {
  AdminLeafLink,
} from "@/components/admin/dashboard/cockpit-panel-header";
import { ProductPageHeader } from "@/components/connect/product-page-header";
import { Card } from "@/components/ui/card";
import { EmptySurface } from "@/components/ui/empty-surface";
import type { PlatformAddressEntry } from "@/components/proof-center/contracts-audit-trail";
import { ContractsAuditTrail } from "@/components/proof-center/contracts-audit-trail";
import { MiningCashFlowEvidence } from "@/components/proof-center/mining-cashflow-evidence";
import { PorSummary } from "@/components/proof-center/por-summary";
import { ProofCenterColdShell } from "@/components/proof-center/proof-center-cold-shell";
import { ProofCenterSection } from "@/components/proof-center/proof-center-section";
import { PortfolioLeafLink } from "@/components/portfolio/portfolio-leaf-link";
import { RecentDistributions } from "@/components/proof-center/recent-distributions";
import { RebalancingEventsPanel } from "@/components/proof-center/rebalancing-events-panel";
import type { CoverageView } from "@/lib/engine/coverage-view";
import type { OnChainAttestation } from "@/lib/chain/por-registry";
import type { CustodySnapshot } from "@/lib/data/custody";
import type {
  ProofCenterDistributionRow,
  ProofCenterRebalanceRow,
} from "@/lib/data/proof-center";
import { cn } from "@/lib/cn";
import { withAdminVaultQuery, getVaultShortLabel } from "@/lib/vaults/dashboard-scope";

export interface ProofCenterHubProps {
  variant: "product" | "admin";
  vaultRef?: string;
  chainConfigured: boolean;
  latestAttestation: OnChainAttestation | null;
  attestationVerified: boolean;
  custody: CustodySnapshot | null;
  coverage: CoverageView;
  recentDistributions: ProofCenterDistributionRow[];
  recentRebalances: ProofCenterRebalanceRow[];
  platformAddresses: PlatformAddressEntry[];
  coldEmpty: boolean;
  /** PorSummary sandbox flag — investor demo or admin demo banner. */
  demo: boolean;
}

function HubLeafLink({
  variant,
  href,
  label,
}: {
  variant: ProofCenterHubProps["variant"];
  href: string;
  label: string;
}) {
  if (variant === "admin") {
    return <AdminLeafLink href={href} label={label} />;
  }
  return <PortfolioLeafLink href={href} label={label} />;
}

interface ProofHubCardProps {
  eyebrow: string;
  title: string;
  provenance?: ProvenanceKind;
  href?: string;
  variant: ProofCenterHubProps["variant"];
  children: React.ReactNode;
}

function ProofHubCard({
  eyebrow,
  title,
  provenance,
  href,
  variant,
  children,
}: ProofHubCardProps) {
  return (
    <Card material="flat" className="h-full p-(--ct-space-6)" contentClassName="flex flex-col h-full">
      <DashboardPanelHeader
        eyebrow={eyebrow}
        title={title}
        provenance={provenance}
        tone="primary"
        trailing={
          href ? <HubLeafLink variant={variant} href={href} label="View full" /> : null
        }
      />
      <div className="proof-panel-scroll">{children}</div>
    </Card>
  );
}

export function ProofCenterHub({
  variant,
  vaultRef,
  chainConfigured,
  latestAttestation,
  attestationVerified,
  custody,
  coverage,
  recentDistributions,
  recentRebalances,
  platformAddresses,
  coldEmpty,
  demo,
}: ProofCenterHubProps) {
  const fullHref =
    variant === "product"
      ? withAdminVaultQuery("/proof-center/full", vaultRef)
      : withAdminVaultQuery("/admin/proof-center/full", vaultRef);

  const porProvenance = latestAttestation
    ? resolveAttestationProvenance(
        latestAttestation.timestamp,
        attestationVerified,
        demo,
      )
    : "manual";

  const coverageProvenance = coverage?.provenance ?? "manual";

  const vaultSuffix = getVaultShortLabel(vaultRef ?? "yield");

  const stackBaseClass = cn(
    variant === "admin" ? "admin-doc-stack admin-doc-stack--roomy" : "product-doc-stack product-doc-stack--roomy",
  );

  return (
    <div
      className={cn(
        variant === "product" ? "product-doc-stack" : "admin-doc-stack admin-doc-stack--roomy",
        // Grey body container (Portfolio canon) — both investor and admin surfaces.
        "rounded-2xl border border-white/10 bg-zinc-900 p-5 lg:p-6 mb-8",
        !coldEmpty && "proof-cockpit proof-cockpit--fit",
      )}
    >
      {variant === "product" ? (
        <ProductPageHeader
          titleLead="Proof"
          titleAccent="Center"
          contextLabel="Vault Proof System"
          className="mb-(--ct-space-8)"
        />
      ) : (
        <AdminPageHeader
          titleLead="Proof Operations"
          titleAccent={vaultSuffix}
          contextLabel={`Operator Proof Hub · ${vaultSuffix}`}
          className="mb-(--ct-space-8)"
        />
      )}

      <div className={stackBaseClass}>
        {coldEmpty ? (
          <>
            <ProofCenterColdShell chainConfigured={chainConfigured} variant={variant} />
            <ProofCenterSection
              id="contracts-heading"
              title="Contracts & review trail"
              variant={variant}
            >
              <ContractsAuditTrail platformAddresses={platformAddresses} variant={variant} />
            </ProofCenterSection>
          </>
        ) : (
          <>
            <div className="dashboard-cockpit-row dashboard-cockpit-row--proof-top">
              <div className="dashboard-cockpit-cell">
                <ProofHubCard
                  eyebrow="On-chain reserves"
                  title="Proof of Reserves"
                  provenance={porProvenance}
                  href={fullHref}
                  variant={variant}
                >
                  <PorSummary
                    attestation={latestAttestation}
                    custody={custody}
                    verified={attestationVerified}
                    demo={demo}
                    bare
                  />
                </ProofHubCard>
              </div>

              <div className="dashboard-cockpit-cell">
                <ProofHubCard
                  eyebrow="Yield source"
                  title="Mining cash-flow"
                  provenance={coverageProvenance === "pending" ? "manual" : coverageProvenance === "invalid" ? "stale" : coverageProvenance}
                  variant={variant}
                >
                  <MiningCashFlowEvidence coverage={coverage} bare />
                </ProofHubCard>
              </div>
            </div>

            <div className="dashboard-cockpit-row dashboard-cockpit-row--proof-bot">
              <div className="dashboard-cockpit-cell">
                <ProofHubCard
                  eyebrow="Payout history"
                  title="Latest distributions"
                  provenance="manual"
                  href={fullHref}
                  variant={variant}
                >
                  {recentDistributions.length === 0 ? (
                    <EmptySurface
                      message="No distributions yet"
                      detail="USDC payouts will appear once the vault operates."
                    />
                  ) : (
                    <RecentDistributions
                      distributions={recentDistributions}
                      bare
                    />
                  )}
                </ProofHubCard>
              </div>

              <div className="dashboard-cockpit-cell">
                <ProofHubCard
                  eyebrow="Vault operations"
                  title="Rebalancing events"
                  provenance="manual"
                  href={fullHref}
                  variant={variant}
                >
                  {recentRebalances.length === 0 ? (
                    <EmptySurface
                      message="No rebalancing events yet"
                      detail="Rebalancing activity will appear once the vault operates."
                    />
                  ) : (
                    <RebalancingEventsPanel
                      events={recentRebalances}
                      bare
                    />
                  )}
                </ProofHubCard>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
