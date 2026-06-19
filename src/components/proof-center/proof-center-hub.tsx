import type { ReactNode } from "react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import {
  AdminCockpitPanelHeader,
  AdminLeafLink,
} from "@/components/admin/dashboard/cockpit-panel-header";
import { ProductPageHeader } from "@/components/connect/product-page-header";
import { DemoDataBanner } from "@/components/product/demo-data-banner";
import { EmptySurface } from "@/components/ui/empty-surface";
import { ChainStatusBadge } from "@/components/proof/chain-status-badge";
import type { PlatformAddressEntry } from "@/components/proof-center/contracts-audit-trail";
import { ContractsAuditTrail } from "@/components/proof-center/contracts-audit-trail";
import { MiningCashFlowEvidence } from "@/components/proof-center/mining-cashflow-evidence";
import { PorSummary } from "@/components/proof-center/por-summary";
import { ProofCenterColdShell } from "@/components/proof-center/proof-center-cold-shell";
import { ProofCenterSection } from "@/components/proof-center/proof-center-section";
import { ProofCenterTestnetNotice } from "@/components/proof-center/proof-center-testnet-notice";
import {
  ProofCockpitPanelHeader,
  ProofLeafLink,
} from "@/components/proof-center/proof-cockpit-panel-header";
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
  onChainEventsCount: number;
  onChainAttestationCount: number;
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
  /** Product only — passed to ProofCenterTestnetNotice. */
  demoNotice?: string | null;
  /** Admin only — renders DemoDataBanner when true. */
  showDemoBanner?: boolean;
}

function HubPanelHeader({
  variant,
  title,
  trailing,
}: {
  variant: ProofCenterHubProps["variant"];
  title: string;
  trailing?: ReactNode;
}) {
  if (variant === "admin") {
    return <AdminCockpitPanelHeader title={title} trailing={trailing} />;
  }
  return <ProofCockpitPanelHeader title={title} trailing={trailing} />;
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
  return <ProofLeafLink href={href} label={label} />;
}

export function ProofCenterHub({
  variant,
  chainConfigured,
  onChainEventsCount,
  onChainAttestationCount,
  latestAttestation,
  attestationVerified,
  custody,
  coverage,
  recentDistributions,
  recentRebalances,
  platformAddresses,
  coldEmpty,
  demo,
  demoNotice = null,
  showDemoBanner = false,
}: ProofCenterHubProps) {
  const fullHref =
    variant === "product" ? "/proof-center/full" : "/admin/proof-center/full";

  const chainBadge = (
    <ChainStatusBadge
      configured={chainConfigured}
      eventCount={onChainEventsCount}
      attestationCount={onChainAttestationCount}
    />
  );

  return (
    <div
      className={cn(
        "proof-center-shell",
        !coldEmpty && "proof-cockpit proof-cockpit--fit",
      )}
    >
      <ProofCenterTestnetNotice
        chainConfigured={chainConfigured}
        demoNotice={variant === "product" ? demoNotice : null}
      />

      {variant === "product" ? (
        <ProductPageHeader
          eyebrow="Hearst Yield Vault"
          title="Proof Center"
          description={
            <>
              Every data point that backs the vault — mining attestations, custody
              snapshots, audits, and the methodology itself — hashed and posted with
              its source URI.
            </>
          }
          actions={chainBadge}
        />
      ) : (
        <AdminPageHeader
          title="Proof Center"
          description="Reserve attestations, cash-flow evidence, distributions and rebalancing — operator hub."
          actions={chainBadge}
        />
      )}

      {variant === "admin" && showDemoBanner ? <DemoDataBanner /> : null}

      {coldEmpty ? (
        <>
          <ProofCenterColdShell chainConfigured={chainConfigured} />
          <ProofCenterSection
            id="contracts-heading"
            title="Contracts & review trail"
          >
            <ContractsAuditTrail platformAddresses={platformAddresses} />
          </ProofCenterSection>
        </>
      ) : (
        <>
          <div className="dashboard-cockpit-row dashboard-cockpit-row--proof-top">
            <div className="dashboard-cockpit-cell">
              <div className="dashboard-cockpit-panel">
                <HubPanelHeader
                  variant={variant}
                  title="Proof of Reserves"
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
                  variant={variant}
                  title="Mining cash-flow evidence"
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
                  variant={variant}
                  title="Latest distributions"
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
                  variant={variant}
                  title="Rebalancing events"
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
        </>
      )}
    </div>
  );
}
