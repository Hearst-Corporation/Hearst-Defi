import { EmptySurface } from "@/components/catalyst/empty-surface";
import { POR_ATTESTATION_EMPTY } from "@/components/proof/empty-messages";
import {
  EXPLORER_ADDRESS_BASE,
  EXPLORER_TX_BASE,
} from "@/lib/chain/client";
import type { OnChainAttestation } from "@/lib/chain/por-registry";
import type { CustodySnapshot } from "@/lib/data/custody";
import { ipfsGatewayUrl } from "@/lib/ipfs-gateway";
import { abbreviateAddress } from "@/lib/onchain";
import { cn } from "@/lib/cn";

import { CustodySection } from "./custody-panel";
import { ProofCenterCardHeader } from "./proof-center-card-header";
import type { ProofCenterSectionLedProps } from "./proof-center-types";
import {
  formatBtc,
  formatNestedTimestamp,
  formatPorPeriod,
  formatUsdCompact,
  isOlderThan24h,
  resolveAttestationProvenance,
} from "./formatters";

interface PorSummaryProps {
  attestation: OnChainAttestation | null;
  custody?: CustodySnapshot | null;
  /** A4 — fail-closed unless signer is verified and allowlisted. */
  verified?: boolean;
  /** Demo sandbox — renders "Simulated" provenance instead of attested/stale. */
  demo?: boolean;
}

/** Bento KPI tile — label + value, matching the Portfolio / vaults flow. */
function BentoKpi({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="ct-bento-label">
        {label}
      </span>
      <span className="text-[1.125rem] font-medium text-foreground leading-none tracking-tight tabular-nums">
        {value}
      </span>
      {sublabel ? (
        <span className="text-2xs text-subtle tracking-wide mono">
          {sublabel}
        </span>
      ) : null}
    </div>
  );
}

/** Bento proof row — label / value on a divided line. */
function BentoProofRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border-subtle py-3 last:border-b-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm font-medium text-foreground mono tabular-nums">
        {children}
      </span>
    </div>
  );
}

const explorerLinkClass =
  "text-muted hover:text-foreground transition-colors duration-150";

const bentoLinkButtonClass =
  "inline-flex items-center justify-center border border-border bg-[color-mix(in_srgb,var(--hc-fg)_5%,transparent)] text-foreground font-medium rounded-lg px-4 py-2.5 text-sm transition-colors hover:bg-[color-mix(in_srgb,var(--hc-fg)_10%,transparent)]";

export function PorSummary({
  attestation,
  custody = null,
  verified = false,
  demo = false,
  sectionLed = false,
  bare = false,
}: PorSummaryProps & ProofCenterSectionLedProps) {
  if (attestation === null) {
    return (
      <div className="product-doc-stack">
        <EmptySurface live {...POR_ATTESTATION_EMPTY} />
        {custody ? <CustodySection custody={custody} nested={bare} /> : null}
      </div>
    );
  }

  const stale = isOlderThan24h(attestation.timestamp);
  const provenance = resolveAttestationProvenance(attestation.timestamp, verified, demo);
  const attestedAt = formatNestedTimestamp(attestation.timestamp);

  const inner = (
    <div className="flex flex-col gap-5">
      {!bare && !sectionLed && (
        <ProofCenterCardHeader
          sectionLed={sectionLed}
          eyebrow="PoR Attestation"
          title={`Period ${formatPorPeriod(attestation.period)} — #${attestation.attestationId.toString()}`}
          provenance={provenance}
          tone="quiet"
        />
      )}
      {!bare && sectionLed && (
        <ProofCenterCardHeader
          sectionLed={sectionLed}
          eyebrow="Proof of Reserves"
          title={`Period ${formatPorPeriod(attestation.period)} — Attestation #${attestation.attestationId.toString()}`}
          provenance={provenance}
          tone="primary"
        />
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
        <BentoKpi label="Total AUM" value={formatUsdCompact(attestation.totalAumUsd)} />
        <BentoKpi label="Mined (period)" value={formatBtc(attestation.minedBtc)} />
        <BentoKpi
          label="Attested at"
          value={attestedAt.value}
          sublabel={attestedAt.sublabel}
        />
        <BentoKpi label="Period" value={formatPorPeriod(attestation.period)} />
      </div>

      <div
        className={cn(
          "flex flex-col",
          stale && "opacity-60",
        )}
      >
        <BentoProofRow label="Attestor address">
          <a
            href={`${EXPLORER_ADDRESS_BASE}${attestation.attestor}`}
            target="_blank"
            rel="noreferrer noopener"
            className={cn(explorerLinkClass, "focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_28%,transparent)] focus-visible:outline-none rounded-sm")}
            title={attestation.attestor}
            aria-label={`View attestor ${attestation.attestor} on explorer`}
          >
            {abbreviateAddress(attestation.attestor)}
          </a>
        </BentoProofRow>
        <BentoProofRow label="Evidence hash">
          <span title={attestation.evidenceHash}>
            {abbreviateAddress(attestation.evidenceHash)}
          </span>
        </BentoProofRow>
        <BentoProofRow label="Block">{attestation.blockNumber.toString()}</BentoProofRow>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <a
          href={`${EXPLORER_TX_BASE}${attestation.txHash}`}
          target="_blank"
          rel="noreferrer noopener"
          aria-label="View attestation transaction on Base Sepolia explorer"
          className={cn(bentoLinkButtonClass, "focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_28%,transparent)] focus-visible:outline-none")}
        >
          View attestation tx on Base Sepolia (Testnet)
        </a>
        {(() => {
          const href = ipfsGatewayUrl(attestation.evidenceCid);
          return href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="View evidence document on IPFS"
              className={cn(bentoLinkButtonClass, "focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_28%,transparent)] focus-visible:outline-none")}
            >
              View evidence (IPFS)
            </a>
          ) : attestation.evidenceCid.length > 0 ? (
            <span className="text-sm text-subtle">View evidence (IPFS)</span>
          ) : (
            <span className="text-sm text-subtle">No evidence CID available</span>
          );
        })()}
      </div>

      {stale ? (
        <p className="text-2xs leading-relaxed text-warning">
          Last attestation is older than 24h — badge shows Stale. A fresh
          attestation is expected each period close.
        </p>
      ) : !verified ? (
        <p className="text-2xs leading-relaxed text-warning">
          Attestation signer is not yet verified against the allowlist — badge
          shows Stale until the signature is confirmed.
        </p>
      ) : null}

      {custody ? <CustodySection custody={custody} nested /> : null}
    </div>
  );

  return bare ? (
    inner
  ) : (
    <div className="rounded-2xl border border-border bg-surface-card shadow-md overflow-hidden flex flex-col p-5 lg:p-6">
      {inner}
    </div>
  );
}
