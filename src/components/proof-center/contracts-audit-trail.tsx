import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProofRow } from "@/components/ui/nested-panel";
import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import { FileText, ShieldCheck, ExternalLink, Link as LinkIcon } from "lucide-react";
import { getDeployment } from "@/lib/chain/deployments";
import {
  EXPLORER_ADDRESS_BASE,
  EXPLORER_TX_BASE,
  getEventLoggerAddress,
  getPoRRegistryAddress,
} from "@/lib/chain/client";
import { abbreviateAddress } from "@/lib/onchain";
import { explorerLinkClass, sectionDividerClass } from "@/lib/ui/surface-classes";
import { cn } from "@/lib/cn";

export interface PlatformAddressEntry {
  label: string;
  address: string | null;
  description: string;
  /** When unset, no explorer link is rendered. */
  href?: string | null;
  /** ProofRow label — defaults to "Address". */
  rowLabel?: string;
}

interface ContractsAuditTrailProps {
  /** Vault, manager, custody scope — supplied by the page loader. */
  platformAddresses?: ReadonlyArray<PlatformAddressEntry>;
  variant?: "product" | "admin";
}

interface DeployedContract {
  name: string;
  address: `0x${string}`;
  deployTxHash: `0x${string}`;
  deployBlock: string;
  description: string;
  sourceVerified: boolean;
}

interface AuditEntry {
  label: string;
  status: string;
  variant: "success" | "warning" | "default";
  href: string | null;
}

const EVENT_LOGGER_DEPLOYMENT = getDeployment("eventLogger");
const POR_REGISTRY_DEPLOYMENT = getDeployment("porRegistry");

const DEPLOYED_CONTRACTS: ReadonlyArray<DeployedContract> = [
  {
    name: "EventLogger",
    address:
      getEventLoggerAddress() ?? (EVENT_LOGGER_DEPLOYMENT.address as `0x${string}`),
    deployTxHash: EVENT_LOGGER_DEPLOYMENT.deployTx as `0x${string}`,
    deployBlock: EVENT_LOGGER_DEPLOYMENT.deployBlock.toLocaleString(),
    description:
      "Permanent on-chain record of rebalancing, distribution, and state-change events. Published by the Hearst manager today, moving to a multisig at production deployment.",
    sourceVerified: EVENT_LOGGER_DEPLOYMENT.meta.provenanceVerified,
  },
  {
    name: "PoRRegistry",
    address:
      getPoRRegistryAddress() ?? (POR_REGISTRY_DEPLOYMENT.address as `0x${string}`),
    deployTxHash: POR_REGISTRY_DEPLOYMENT.deployTx as `0x${string}`,
    deployBlock: POR_REGISTRY_DEPLOYMENT.deployBlock.toLocaleString(),
    description:
      "Proof-of-Reserves attestation registry. One immutable attestation per YYYYMM period. Pins AUM, mined BTC, and a keccak256 hash of the evidence PDF.",
    sourceVerified: POR_REGISTRY_DEPLOYMENT.meta.provenanceVerified,
  },
];

const AUDIT_ENTRIES: ReadonlyArray<AuditEntry> = [
  {
    label: "Spearbit smart-contract review",
    status: "Scoped — Q1 2026 report pending final sign-off",
    variant: "warning",
    href: null,
  },
  {
    label: "Trail of Bits — EventLogger scoping memo",
    status: "Completed",
    variant: "success",
    href: null,
  },
  {
    label: "Methodology v1.0",
    status: "Published",
    variant: "success",
    href: "/docs/methodology/v1.0.md",
  },
];

function auditBadgeLabel(entry: AuditEntry): string {
  if (entry.href !== null) return "Published";
  if (entry.variant === "warning") return "In progress";
  if (entry.variant === "success") return "Completed";
  return "Pending";
}

interface ProofArticleProps {
  title: string;
  description?: string;
  icon: React.ElementType;
  separated: boolean;
  children: React.ReactNode;
}

function ProofArticle({
  title,
  description,
  icon: Icon,
  separated,
  children,
}: ProofArticleProps) {
  return (
    <article
      className={cn(
        "proof-dataroom-item",
        separated && cn(sectionDividerClass, "proof-article-separated"),
      )}
    >
      <div className="flex items-start gap-(--ct-space-3)">
        <div className="proof-dataroom-icon-box" aria-hidden="true">
          <Icon className="w-4 h-4 ct-text-muted" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="h4 proof-article-title">{title}</h4>
          {description && (
            <p className="body-sm proof-article-lede">{description}</p>
          )}
          {children}
        </div>
      </div>
    </article>
  );
}

function PlatformAddressRow({
  entry,
  separated,
}: {
  entry: PlatformAddressEntry;
  separated: boolean;
}) {
  return (
    <ProofArticle
      title={entry.label}
      description={entry.description}
      icon={LinkIcon}
      separated={separated}
    >
      <ProofRow label={entry.rowLabel ?? "Address"}>
        {entry.address ? (
          entry.href ? (
            <a
              href={entry.href}
              target="_blank"
              rel="noreferrer noopener"
              className={cn(explorerLinkClass, "inline-flex items-center gap-1")}
              title={entry.address}
              aria-label={`View address ${entry.address} on explorer`}
            >
              <span className="ct-proof-row__truncate">
                {abbreviateAddress(entry.address)}
              </span>
              <ExternalLink className="w-3 h-3 opacity-50" aria-hidden="true" />
            </a>
          ) : (
            <span title={entry.address} className="ct-proof-row__truncate">
              {abbreviateAddress(entry.address)}
            </span>
          )
        ) : (
          <span className="ct-text-muted">Not available</span>
        )}
      </ProofRow>
    </ProofArticle>
  );
}

function DeployedContractCard({
  contract,
  separated,
}: {
  contract: DeployedContract;
  separated: boolean;
}) {
  return (
    <ProofArticle
      title={contract.name}
      description={contract.description}
      icon={ShieldCheck}
      separated={separated}
    >
      <ProofRow label="Contract address">
        <a
          href={`${EXPLORER_ADDRESS_BASE}${contract.address}`}
          target="_blank"
          rel="noreferrer noopener"
          className={cn(explorerLinkClass, "inline-flex items-center gap-1")}
          title={contract.address}
          aria-label={`View contract ${contract.name} at ${contract.address} on explorer`}
        >
          <span className="ct-proof-row__truncate">
            {abbreviateAddress(contract.address)}
          </span>
          <ExternalLink className="w-3 h-3 opacity-50" aria-hidden="true" />
        </a>
      </ProofRow>
      <ProofRow label="Deploy tx">
        {contract.deployTxHash ? (
          <a
            href={`${EXPLORER_TX_BASE}${contract.deployTxHash}`}
            target="_blank"
            rel="noreferrer noopener"
            className={cn(explorerLinkClass, "inline-flex items-center gap-1")}
            title={contract.deployTxHash}
            aria-label={`View deployment transaction ${contract.deployTxHash} on explorer`}
          >
            <span className="ct-proof-row__truncate">
              {abbreviateAddress(contract.deployTxHash)}
            </span>
            <ExternalLink className="w-3 h-3 opacity-50" aria-hidden="true" />
          </a>
        ) : (
          <span className="ct-text-muted">Pending</span>
        )}
      </ProofRow>
      <ProofRow label="Deploy block">{contract.deployBlock || "Pending"}</ProofRow>
      <ProofRow label="Network">Test network (chain id 84532)</ProofRow>

      <div className="proof-actions-row product-doc-inline-row">
        <Badge variant={contract.sourceVerified ? "success" : "warning"}>
          {contract.sourceVerified
            ? "Source-verified @ commit"
            : "Deployment provenance unverified"}
        </Badge>
        <Button asChild variant="secondary" size="md">
          <a
            href={`${EXPLORER_ADDRESS_BASE}${contract.address}`}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2"
            aria-label={`View ${contract.name} on Basescan`}
          >
            View on Basescan
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
        </Button>
      </div>
    </ProofArticle>
  );
}

export function ContractsAuditTrail({
  platformAddresses = [],
}: ContractsAuditTrailProps) {
  const deploymentsVerified = DEPLOYED_CONTRACTS.every((c) => c.sourceVerified);

  return (
    <div className="product-doc-stack product-doc-stack--roomy">
      {platformAddresses.length > 0 ? (
        <Card material="flat">
          <DashboardPanelHeader
            eyebrow="On-chain addresses"
            title="Vault, manager & custody scope"
            provenance="manual"
            tone="primary"
          />
          <div>
            {platformAddresses.map((entry, idx) => (
              <PlatformAddressRow
                key={entry.label}
                entry={entry}
                separated={idx > 0}
              />
            ))}
          </div>
        </Card>
      ) : null}

      <Card material="flat">
        <DashboardPanelHeader
          eyebrow="Deployed contracts · test network"
          title="Configured deployment addresses"
          provenance={deploymentsVerified ? "attested" : "manual"}
          tone="primary"
        />
        <div>
          {DEPLOYED_CONTRACTS.map((contract, idx) => (
            <DeployedContractCard key={contract.address} contract={contract} separated={idx > 0} />
          ))}
        </div>
      </Card>

      <Card material="flat">
        <DashboardPanelHeader
          eyebrow="Contract audit trail"
          title="Review status"
          provenance="manual"
          tone="quiet"
        />

        <ul className="divide-y divide-(--ct-border-soft)">
          {AUDIT_ENTRIES.map((entry) => (
            <li key={entry.label} className="proof-list-row product-doc-section__head">
              <div className="flex items-start gap-(--ct-space-3) w-full">
                <div className="proof-dataroom-icon-box mt-0.5">
                  <FileText className="w-4 h-4 ct-text-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-(--ct-space-3)">
                    <div className="product-doc-stack--compact">
                      <span className="body-sm font-medium ct-text-primary">{entry.label}</span>
                      <span className="body-xs">{entry.status}</span>
                    </div>
                    <div className="product-doc-inline-row shrink-0">
                      <Badge variant={entry.variant}>{auditBadgeLabel(entry)}</Badge>
                      {entry.href !== null ? (
                        <Button asChild variant="secondary" size="md">
                          <a
                            href={entry.href}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-2"
                            aria-label={`View document for ${entry.label}`}
                          >
                            View document
                            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="proof-release-gate product-doc-stack product-doc-stack--tight">
          <p className="stat-label m-0">Release gate</p>
          <p className="body-xs ct-text-muted m-0">
            Production (mainnet) deployment requires completion of an
            independent third-party security audit. The methodology remains
            fixed until a formal approval and investor notification process is
            completed.
          </p>
        </div>
      </Card>
    </div>
  );
}
