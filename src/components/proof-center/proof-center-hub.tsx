import { resolveAttestationProvenance } from "@/components/proof-center/formatters";
import type { Provenance } from "@/components/ui/provenance-badge";
import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import type { ReactNode } from "react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import {
  AdminLeafLink,
} from "@/components/admin/dashboard/cockpit-panel-header";
import { ProductPageHeader } from "@/components/connect/product-page-header";
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

export interface ProofCenterHubProps {
  variant: "product" | "admin";
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

function HubPanelHeader({
  title,
  eyebrow,
  provenance,
  trailing,
}: {
  title: string;
  eyebrow?: string;
  provenance?: Provenance;
  trailing?: ReactNode;
}) {
  return (
    <DashboardPanelHeader
      title={title}
      eyebrow={eyebrow}
      provenance={provenance}
      trailing={trailing}
      tone="primary"
    />
  );
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

export function ProofCenterHub({
  variant,
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
    variant === "product" ? "/proof-center/full" : "/admin/proof-center/full";

  const porProvenance = latestAttestation
    ? resolveAttestationProvenance(
        latestAttestation.timestamp,
        attestationVerified,
        demo,
      )
    : "manual";

  const coverageProvenance = coverage?.provenance ?? "manual";

  return (
    <div
      className={cn(
        "proof-center-shell",
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
          titleLead="Proof"
          titleAccent="Operations"
          contextLabel="Operator Proof Hub"
          className="mb-(--ct-space-8)"
        />
      )}

      {coldEmpty ? (
        <div className="product-doc-stack product-doc-stack--roomy">
          <ProofCenterColdShell chainConfigured={chainConfigured} variant={variant} />
          <ProofCenterSection
            id="contracts-heading"
            title="Contracts & review trail"
          >
            <ContractsAuditTrail platformAddresses={platformAddresses} />
          </ProofCenterSection>
        </div>
      ) : (
        <div className="product-doc-stack product-doc-stack--roomy">
          <div className="dashboard-cockpit-row dashboard-cockpit-row--proof-top">
            <div className="dashboard-cockpit-cell">
              <div className="dashboard-cockpit-panel">
                <HubPanelHeader
                  eyebrow="On-chain reserves"
                  title="Proof of Reserves"
                  provenance={porProvenance}
                  trailing={
                    <HubLeafLink variant={variant} href={fullHref} label="View full" />
                  }
                />
                <div className="proof-panel-scroll">
                  <PorSummary
                    attestation={latestAttestation}
                    custody={custody}
                    verified={attestationVerified}
                    demo={demo}
                    sectionLed={false}
                  />
                </div>
              </div>
            </div>

            <div className="dashboard-cockpit-cell">
              <div className="dashboard-cockpit-panel">
                <HubPanelHeader
                  eyebrow="Yield source"
                  title="Mining cash-flow"
                  provenance={coverageProvenance === "pending" ? "manual" : coverageProvenance === "invalid" ? "stale" : coverageProvenance}
                />
                <div className="proof-panel-scroll">
                  <MiningCashFlowEvidence coverage={coverage} sectionLed={false} />
                </div>
              </div>
            </div>
          </div>

          <div className="dashboard-cockpit-row dashboard-cockpit-row--proof-bot">
            <div className="dashboard-cockpit-cell">
              <div className="dashboard-cockpit-panel">
                <HubPanelHeader
                  eyebrow="Payout history"
                  title="Latest distributions"
                  provenance="manual"
                  trailing={
                    <HubLeafLink variant={variant} href={fullHref} label="View full" />
                  }
                />
                <div className="proof-panel-scroll">
                  {recentDistributions.length === 0 ? (
                    <EmptySurface
                      message="No distributions yet"
                      detail="USDC payouts will appear once the vault operates."
                    />
                  ) : (
                    <RecentDistributions
                      distributions={recentDistributions}
                      sectionLed={false}
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="dashboard-cockpit-cell">
              <div className="dashboard-cockpit-panel">
                <HubPanelHeader
                  eyebrow="Vault operations"
                  title="Rebalancing events"
                  provenance="manual"
                  trailing={
                    <HubLeafLink variant={variant} href={fullHref} label="View full" />
                  }
                />
                <div className="proof-panel-scroll">
                  {recentRebalances.length === 0 ? (
                    <EmptySurface
                      message="No rebalancing events yet"
                      detail="Rebalancing activity will appear once the vault operates."
                    />
                  ) : (
                    <RebalancingEventsPanel
                      events={recentRebalances}
                      sectionLed={false}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
