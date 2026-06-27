import type { ReactNode } from "react";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { FileText, ShieldCheck, ExternalLink, Link as LinkIcon } from "lucide-react";
import { getDeployment } from "@/lib/chain/deployments";
import {
  EXPLORER_ADDRESS_BASE,
  EXPLORER_TX_BASE,
  getEventLoggerAddress,
  getPoRRegistryAddress,
} from "@/lib/chain/client";
import { abbreviateAddress } from "@/lib/onchain";
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

/** Bento panel header in the Portfolio / vaults converted style. */
function PanelHeader({
  title,
  subtitle,
  trailing,
}: {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3 p-5 border-b border-white/5">
      <div className="flex flex-col gap-1.5 min-w-0">
        <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-[0.15em] leading-none">
          {title}
        </h2>
        {subtitle ? (
          <p className="text-[12px] text-zinc-500 tracking-wide">{subtitle}</p>
        ) : null}
      </div>
      {trailing ? (
        <div className="flex shrink-0 items-center gap-2 pb-0.5">{trailing}</div>
      ) : null}
    </div>
  );
}

const MICRO_LABEL = "text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500";

/** Single on-chain reference row (label + monospace value / explorer link). */
function ProofRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-white/5 last:border-b-0">
      <span className="text-[13px] text-zinc-400">{label}</span>
      <span className="min-w-0 text-right">{children}</span>
    </div>
  );
}

/** BaseScan / explorer external link — accent green, monospace hash. */
function ExplorerLink({
  href,
  value,
  title,
  ariaLabel,
}: {
  href: string;
  value: string;
  title: string;
  ariaLabel: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-center gap-1 font-mono text-[13px] text-[#A7FB90] hover:underline"
      title={title}
      aria-label={ariaLabel}
    >
      <span className="truncate">{value}</span>
      <ExternalLink className="w-3 h-3 opacity-50 shrink-0" aria-hidden="true" />
    </a>
  );
}

interface ProofArticleProps {
  title: string;
  description?: string;
  icon: React.ElementType;
  separated: boolean;
  children: ReactNode;
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
        "px-5 py-5",
        separated && "border-t border-white/5",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.02]"
          aria-hidden="true"
        >
          <Icon className="w-4 h-4 text-zinc-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-[14px] font-semibold text-white leading-snug">
            {title}
          </h4>
          {description && (
            <p className="mt-1 text-[12px] text-zinc-500 leading-relaxed">
              {description}
            </p>
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
      <div className="mt-3">
        <ProofRow label={entry.rowLabel ?? "Address"}>
          {entry.address ? (
            entry.href ? (
              <ExplorerLink
                href={entry.href}
                value={abbreviateAddress(entry.address)}
                title={entry.address}
                ariaLabel={`View address ${entry.address} on explorer`}
              />
            ) : (
              <span
                title={entry.address}
                className="font-mono text-[13px] text-white truncate"
              >
                {abbreviateAddress(entry.address)}
              </span>
            )
          ) : (
            <span className="text-[13px] text-zinc-600">Not available</span>
          )}
        </ProofRow>
      </div>
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
      <div className="mt-3">
        <ProofRow label="Contract address">
          <ExplorerLink
            href={`${EXPLORER_ADDRESS_BASE}${contract.address}`}
            value={abbreviateAddress(contract.address)}
            title={contract.address}
            ariaLabel={`View contract ${contract.name} at ${contract.address} on explorer`}
          />
        </ProofRow>
        <ProofRow label="Deploy tx">
          {contract.deployTxHash ? (
            <ExplorerLink
              href={`${EXPLORER_TX_BASE}${contract.deployTxHash}`}
              value={abbreviateAddress(contract.deployTxHash)}
              title={contract.deployTxHash}
              ariaLabel={`View deployment transaction ${contract.deployTxHash} on explorer`}
            />
          ) : (
            <span className="text-[13px] text-zinc-600">Pending</span>
          )}
        </ProofRow>
        <ProofRow label="Deploy block">
          <span className="font-mono text-[13px] text-white">
            {contract.deployBlock || "Pending"}
          </span>
        </ProofRow>
        <ProofRow label="Network">
          <span className="text-[13px] text-zinc-300">
            Test network (chain id 84532)
          </span>
        </ProofRow>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {contract.sourceVerified ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#A7FB90]/30 bg-[#A7FB90]/10 px-2.5 py-1 text-[11px] font-medium text-[#A7FB90]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#A7FB90]" aria-hidden="true" />
            Source-verified @ commit
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" aria-hidden="true" />
            Deployment provenance unverified
          </span>
        )}
        <a
          href={`${EXPLORER_ADDRESS_BASE}${contract.address}`}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12px] font-medium text-zinc-200 hover:bg-white/[0.06] transition-colors"
          aria-label={`View ${contract.name} on Basescan`}
        >
          View on Basescan
          <ExternalLink className="w-3.5 h-3.5 text-[#A7FB90]" aria-hidden="true" />
        </a>
      </div>
    </ProofArticle>
  );
}

export function ContractsAuditTrail({
  platformAddresses = [],
}: ContractsAuditTrailProps) {
  const deploymentsVerified = DEPLOYED_CONTRACTS.every((c) => c.sourceVerified);
  const deploymentsProvenance: Provenance = deploymentsVerified
    ? "attested"
    : "manual";

  return (
    <div className="dark flex flex-col gap-y-5">
      {platformAddresses.length > 0 ? (
        <section className="rounded-2xl border border-white/10 bg-black shadow-sm overflow-hidden flex flex-col">
          <PanelHeader
            title="On-chain addresses"
            subtitle="Vault, manager & custody scope"
            trailing={<ProvenanceBadge kind="manual" />}
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
        </section>
      ) : null}

      <section className="rounded-2xl border border-white/10 bg-black shadow-sm overflow-hidden flex flex-col">
        <PanelHeader
          title="Deployed contracts · test network"
          subtitle="Configured deployment addresses"
          trailing={<ProvenanceBadge kind={deploymentsProvenance} />}
        />
        <div>
          {DEPLOYED_CONTRACTS.map((contract, idx) => (
            <DeployedContractCard
              key={contract.address}
              contract={contract}
              separated={idx > 0}
            />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-black shadow-sm overflow-hidden flex flex-col">
        <PanelHeader
          title="Contract audit trail"
          subtitle="Review status"
          trailing={<ProvenanceBadge kind="manual" />}
        />

        <ul>
          {AUDIT_ENTRIES.map((entry, idx) => (
            <li
              key={entry.label}
              className={cn(
                "px-5 py-4",
                idx > 0 && "border-t border-white/5",
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.02]"
                  aria-hidden="true"
                >
                  <FileText className="w-4 h-4 text-zinc-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="text-[13px] font-medium text-white">
                        {entry.label}
                      </span>
                      <span className="text-[12px] text-zinc-500">
                        {entry.status}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2.5">
                      {entry.variant === "success" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#A7FB90]/30 bg-[#A7FB90]/10 px-2.5 py-1 text-[11px] font-medium text-[#A7FB90]">
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-[#A7FB90]"
                            aria-hidden="true"
                          />
                          {auditBadgeLabel(entry)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-zinc-400">
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-zinc-500"
                            aria-hidden="true"
                          />
                          {auditBadgeLabel(entry)}
                        </span>
                      )}
                      {entry.href !== null ? (
                        <a
                          href={entry.href}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12px] font-medium text-zinc-200 hover:bg-white/[0.06] transition-colors"
                          aria-label={`View document for ${entry.label}`}
                        >
                          View document
                          <ExternalLink
                            className="w-3.5 h-3.5 text-[#A7FB90]"
                            aria-hidden="true"
                          />
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="border-t border-white/5 px-5 py-4 flex flex-col gap-1.5">
          <p className={cn(MICRO_LABEL, "m-0")}>Release gate</p>
          <p className="text-[12px] text-zinc-500 leading-relaxed m-0">
            Production (mainnet) deployment requires completion of an
            independent third-party security audit. The methodology remains
            fixed until a formal approval and investor notification process is
            completed.
          </p>
        </div>
      </section>
    </div>
  );
}
