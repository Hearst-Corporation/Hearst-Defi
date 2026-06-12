import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProofRow } from "@/components/ui/nested-panel";
import { DashboardPanelHeader } from "@/components/ui/system-panel";
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
      "Immutable on-chain journal. Logs rebalancing, distribution and state-change events. Publisher is the Hearst manager EOA (testnet) / multisig (Phase 3).",
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

function DeployedContractCard({
  contract,
  separated,
}: {
  contract: DeployedContract;
  separated: boolean;
}) {
  return (
    <article className={cn(separated && cn(sectionDividerClass, "pt-6"))}>
      <h4 className="h4 mb-2">{contract.name}</h4>
      <p className="body-sm mb-4">{contract.description}</p>

      <ProofRow label="Contract address">
        <a
          href={`${EXPLORER_ADDRESS_BASE}${contract.address}`}
          target="_blank"
          rel="noreferrer noopener"
          className={explorerLinkClass}
          title={contract.address}
        >
          {abbreviateAddress(contract.address)}
        </a>
      </ProofRow>
      <ProofRow label="Deploy tx">
        <a
          href={`${EXPLORER_TX_BASE}${contract.deployTxHash}`}
          target="_blank"
          rel="noreferrer noopener"
          className={explorerLinkClass}
          title={contract.deployTxHash}
        >
          {abbreviateAddress(contract.deployTxHash)}
        </a>
      </ProofRow>
      <ProofRow label="Deploy block">{contract.deployBlock}</ProofRow>
      <ProofRow label="Network">Base Sepolia (chain id 84532)</ProofRow>

      <div className="mt-4 flex flex-wrap gap-2">
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
          >
            View on Basescan
          </a>
        </Button>
        <Button asChild variant="secondary" size="md">
          <a
            href={`${EXPLORER_TX_BASE}${contract.deployTxHash}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            Deploy tx
          </a>
        </Button>
      </div>
    </article>
  );
}

export function ContractsAuditTrail() {
  const deploymentsVerified = DEPLOYED_CONTRACTS.every((c) => c.sourceVerified);

  return (
    <div className="space-y-6">
      <Card>
        <DashboardPanelHeader
          eyebrow="Phase 2 contracts · Base Sepolia"
          title="Configured deployment addresses"
          provenance={deploymentsVerified ? "attested" : "manual"}
          tone="primary"
        />
        {DEPLOYED_CONTRACTS.map((contract, idx) => (
          <DeployedContractCard key={contract.address} contract={contract} separated={idx > 0} />
        ))}
      </Card>

      <Card>
        <DashboardPanelHeader
          eyebrow="Contract audit trail"
          title="Review status"
          provenance="manual"
          tone="quiet"
        />

        <ul className="divide-y divide-(--ct-border-soft)">
          {AUDIT_ENTRIES.map((entry) => (
            <li
              key={entry.label}
              className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex flex-col gap-0.5">
                <span className="body-sm font-medium ct-text-primary">{entry.label}</span>
                <span className="body-xs">{entry.status}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={entry.variant}>{auditBadgeLabel(entry)}</Badge>
                {entry.href !== null ? (
                  <Button asChild variant="secondary" size="md">
                    <a href={entry.href} target="_blank" rel="noreferrer noopener">
                      View document
                    </a>
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>

        <p className="body-xs mt-4 border-t border-(--ct-border-soft) pt-4">
          Phase 3 will require a Spearbit audit pass before any ERC-4626 vault
          deployment. Methodology is immutable at v1.0; a version bump requires
          an ADR and LP notification.
        </p>
      </Card>
    </div>
  );
}
