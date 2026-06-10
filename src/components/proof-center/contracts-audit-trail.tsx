import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { EXPLORER_ADDRESS_BASE, EXPLORER_TX_BASE } from "@/lib/chain/client";
import { cn } from "@/lib/cn";
import { abbreviateAddress } from "@/lib/onchain";

interface DeployedContract {
  name: string;
  address: `0x${string}`;
  deployTxHash: `0x${string}`;
  deployBlock: string;
  description: string;
}

const DEPLOYED_CONTRACTS: ReadonlyArray<DeployedContract> = [
  {
    name: "EventLogger",
    address: "0xb07E045D082d202bAc7C1d4F83e1A63d00653D9E",
    deployTxHash:
      "0x587e7723e57bdbd97774d7fe0da057dc47c94fc8633f05c7add0860c1461c2b8",
    deployBlock: "41,418,022",
    description:
      "Immutable on-chain journal. Logs rebalancing, distribution and state-change events. Publisher is the Hearst manager EOA (testnet) / multisig (Phase 3).",
  },
  {
    name: "PoRRegistry",
    address: "0x2B7229Ea0c94f12D984d9045ee12fB0D2Efcd28D",
    deployTxHash:
      "0x5240a7dcbd65b1573e9e778ecf774dcc09e398bf6e67d33880f060c80a54e534",
    deployBlock: "41,418,022",
    description:
      "Proof-of-Reserves attestation registry. One immutable attestation per YYYYMM period. Pins AUM, mined BTC, and a keccak256 hash of the evidence PDF.",
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
    label: "Spearbit smart-contract review",
    status: "Scoped — Q1 2026 report pending final sign-off",
    variant: "warning",
    href: "https://reports.spearbit.com/hearst-vault-2026q1.pdf",
  },
  {
    label: "Trail of Bits — EventLogger scoping memo",
    status: "Completed",
    variant: "success",
    href: "https://reports.trailofbits.com/hearst-eventlogger-scope.pdf",
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

const variantStyles: Record<"success" | "warning" | "default", string> = {
  success:
    "border-[var(--ct-status-success-border)] ct-status-success-bg ct-status-success",
  warning:
    "border-[var(--ct-status-warning-border)] ct-status-warning-bg ct-status-warning",
  default:
    "border-[var(--ct-border-strong)] ct-surface-1 ct-text-body",
};

export function ContractsAuditTrail() {
  return (
    <div className="space-y-6">
      {/* Deployed contracts */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1">
            <span className="eyebrow">Phase 2 contracts · Base Sepolia</span>
            <CardTitle>Deployed contract addresses</CardTitle>
          </div>
          <ProvenanceBadge kind="attested" />
        </CardHeader>

        <div className="space-y-6">
          {DEPLOYED_CONTRACTS.map((contract) => (
            <article
              key={contract.address}
              className="rounded-md border border-[var(--ct-border-soft)] ct-surface-1 p-5"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h4 className="h4">{contract.name}</h4>
                <ProvenanceBadge kind="attested" />
              </div>

              <p className="body-sm mb-4">{contract.description}</p>

              <dl className="space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <dt className="body-xs">Contract address</dt>
                  <dd>
                    <a
                      href={`${EXPLORER_ADDRESS_BASE}${contract.address}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mono tabular text-xs ct-text-primary hover:ct-text-strong transition-colors duration-[var(--ct-dur-fast)]"
                      title={contract.address}
                    >
                      {abbreviateAddress(contract.address)}
                    </a>
                  </dd>
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <dt className="body-xs">Deploy tx</dt>
                  <dd>
                    <a
                      href={`${EXPLORER_TX_BASE}${contract.deployTxHash}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mono tabular text-xs ct-text-body hover:ct-text-strong transition-colors duration-[var(--ct-dur-fast)]"
                      title={contract.deployTxHash}
                    >
                      {truncateTx(contract.deployTxHash)}
                    </a>
                  </dd>
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <dt className="body-xs">Deploy block</dt>
                  <dd className="mono tabular text-xs ct-text-body">
                    {contract.deployBlock}
                  </dd>
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <dt className="body-xs">Network</dt>
                  <dd className="body-xs ct-text-body">
                    Base Sepolia (chain id 84532)
                  </dd>
                </div>
              </dl>

              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={`${EXPLORER_ADDRESS_BASE}${contract.address}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={cn(
                    "rounded-full border border-[var(--ct-text-strong)] ct-surface-1",
                    "px-3 py-1.5 text-xs ct-text-strong",
                    "transition-colors duration-[var(--ct-dur-fast)] hover:ct-surface-2",
                    "focus-visible:outline-none focus-visible:shadow-[var(--ct-shadow-focus-ring)]",
                  )}
                >
                  View on Basescan
                </a>
                <a
                  href={`${EXPLORER_TX_BASE}${contract.deployTxHash}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={cn(
                    "rounded-full border border-[var(--ct-border-strong)] ct-surface-1",
                    "px-3 py-1.5 text-xs ct-text-primary",
                    "transition-colors duration-[var(--ct-dur-fast)] hover:ct-surface-3",
                    "focus-visible:outline-none focus-visible:shadow-[var(--ct-shadow-focus-ring)]",
                  )}
                >
                  Deploy tx
                </a>
              </div>
            </article>
          ))}
        </div>
      </Card>

      {/* Audit & methodology */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1">
            <span className="eyebrow">Audit &amp; methodology</span>
            <CardTitle>Review status</CardTitle>
          </div>
        </CardHeader>

        <ul className="space-y-3">
          {AUDIT_ENTRIES.map((entry) => (
            <li
              key={entry.label}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--ct-border-soft)] ct-surface-1 px-4 py-3"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium ct-text-primary">
                  {entry.label}
                </span>
                <span className="text-xs ct-text-body">
                  {entry.status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide leading-none",
                    variantStyles[entry.variant],
                  )}
                >
                  {entry.variant === "success"
                    ? "Published"
                    : entry.variant === "warning"
                      ? "In progress"
                      : "Pending"}
                </span>
                {entry.href !== null ? (
                  <a
                    href={entry.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={cn(
                      "rounded-full border border-[var(--ct-border-strong)] ct-surface-1",
                      "px-3 py-1 text-xs ct-text-primary",
                      "transition-colors duration-[var(--ct-dur-fast)] hover:ct-surface-3",
                      "focus-visible:outline-none focus-visible:shadow-[var(--ct-shadow-focus-ring)]",
                    )}
                  >
                    View document
                  </a>
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
