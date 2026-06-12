import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ProofRow } from "@/components/ui/nested-panel";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { getDeployment } from "@/lib/chain/deployments";
import { cn } from "@/lib/cn";
import {
  EXPLORER_ADDRESS_BASE,
  EXPLORER_TX_BASE,
  getEventLoggerAddress,
  getPoRRegistryAddress,
} from "@/lib/chain/client";
import { abbreviateAddress } from "@/lib/onchain";

interface DeployedContract {
  name: string;
  address: `0x${string}`;
  deployTxHash: `0x${string}`;
  deployBlock: string;
  description: string;
  sourceVerified: boolean;
}

const EVENT_LOGGER_DEPLOYMENT = getDeployment("eventLogger");
const POR_REGISTRY_DEPLOYMENT = getDeployment("porRegistry");
const EVENT_LOGGER_ADDRESS =
  getEventLoggerAddress() ?? (EVENT_LOGGER_DEPLOYMENT.address as `0x${string}`);
const POR_REGISTRY_ADDRESS =
  getPoRRegistryAddress() ?? (POR_REGISTRY_DEPLOYMENT.address as `0x${string}`);

const DEPLOYED_CONTRACTS: ReadonlyArray<DeployedContract> = [
  {
    name: "EventLogger",
    address: EVENT_LOGGER_ADDRESS,
    deployTxHash: EVENT_LOGGER_DEPLOYMENT.deployTx as `0x${string}`,
    deployBlock: EVENT_LOGGER_DEPLOYMENT.deployBlock.toLocaleString(),
    description:
      "Immutable on-chain journal. Logs rebalancing, distribution and state-change events. Publisher is the Hearst manager EOA (testnet) / multisig (Phase 3).",
    sourceVerified: EVENT_LOGGER_DEPLOYMENT.meta.provenanceVerified,
  },
  {
    name: "PoRRegistry",
    address: POR_REGISTRY_ADDRESS,
    deployTxHash: POR_REGISTRY_DEPLOYMENT.deployTx as `0x${string}`,
    deployBlock: POR_REGISTRY_DEPLOYMENT.deployBlock.toLocaleString(),
    description:
      "Proof-of-Reserves attestation registry. One immutable attestation per YYYYMM period. Pins AUM, mined BTC, and a keccak256 hash of the evidence PDF.",
    sourceVerified: POR_REGISTRY_DEPLOYMENT.meta.provenanceVerified,
  },
];

interface AuditEntry {
  label: string;
  status: string;
  variant: "success" | "warning" | "default";
  href: string | null;
}

const AUDIT_ENTRIES: ReadonlyArray<AuditEntry> = [
  {
    // No public report URL yet — the review is still pending sign-off. Linking
    // to a non-existent PDF gives a broken "View document" button, so the link
    // is omitted until a real report exists (set `href` when published).
    label: "Spearbit smart-contract review",
    status: "Scoped — Q1 2026 report pending final sign-off",
    variant: "warning",
    href: null,
  },
  {
    // Same: no public document URL available — omit the link rather than ship a
    // dead one. Restore `href` once a hosted memo exists.
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


function truncateTx(tx: string): string {
  if (tx.length <= 12) return tx;
  return `${tx.slice(0, 10)}…${tx.slice(-6)}`;
}

function auditBadgeLabel(entry: AuditEntry): string {
  if (entry.href !== null) return "Published";
  if (entry.variant === "warning") return "In progress";
  if (entry.variant === "success") return "Completed";
  return "Pending";
}

export function ContractsAuditTrail() {
  return (
    <div className="space-y-6">
      {/* Deployed contracts */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1">
            <span className="eyebrow">Phase 2 contracts · Base Sepolia</span>
            <CardTitle>Configured deployment addresses</CardTitle>
          </div>
          <ProvenanceBadge
            kind={
              DEPLOYED_CONTRACTS.every((c) => c.sourceVerified)
                ? "attested"
                : "manual"
            }
          />
        </CardHeader>

        <div>
          {DEPLOYED_CONTRACTS.map((contract, idx) => (
            <article
              key={contract.address}
              className={cn(idx > 0 && "mt-6 border-t border-[var(--ct-border-soft)] pt-6")}
            >
              <h4 className="h4 mb-2">{contract.name}</h4>
              <p className="body-sm mb-4">{contract.description}</p>

              <div>
                <ProofRow label="Contract address">
                  <a
                    href={`${EXPLORER_ADDRESS_BASE}${contract.address}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="hover:ct-text-strong transition-colors duration-[var(--ct-dur-fast)]"
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
                    className="hover:ct-text-strong transition-colors duration-[var(--ct-dur-fast)]"
                    title={contract.deployTxHash}
                  >
                    {truncateTx(contract.deployTxHash)}
                  </a>
                </ProofRow>
                <ProofRow label="Deploy block">{contract.deployBlock}</ProofRow>
                <ProofRow label="Network">Base Sepolia (chain id 84532)</ProofRow>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Badge
                  variant={contract.sourceVerified ? "success" : "warning"}
                >
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
          ))}
        </div>
      </Card>

      {/* Audit & methodology */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1">
            <span className="eyebrow">Contract audit trail</span>
            <CardTitle>Review status</CardTitle>
          </div>
        </CardHeader>

        <ul className="divide-y divide-[var(--ct-border-soft)]">
          {AUDIT_ENTRIES.map((entry) => (
            <li
              key={entry.label}
              className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex flex-col gap-0.5">
                <span className="body-sm font-medium ct-text-primary">
                  {entry.label}
                </span>
                <span className="body-xs">{entry.status}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={entry.variant}>{auditBadgeLabel(entry)}</Badge>
                {entry.href !== null ? (
                  <Button asChild variant="secondary" size="md">
                    <a
                      href={entry.href}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      View document
                    </a>
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>

        <p className="body-xs mt-4 border-t border-[var(--ct-border-soft)] pt-4">
          Phase 3 will require a Spearbit audit pass before any ERC-4626 vault
          deployment. Methodology is immutable at v1.0; a version bump requires
          an ADR and LP notification.
        </p>
      </Card>
    </div>
  );
}
