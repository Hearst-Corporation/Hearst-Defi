import { EmptySurface } from "@/components/ui/empty-surface";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Metric } from "@/components/ui/metric";
import { MetricGrid, ProofRow } from "@/components/ui/nested-panel";
import { POR_ATTESTATION_EMPTY } from "@/components/proof/empty-messages";
import {
  EXPLORER_ADDRESS_BASE,
  EXPLORER_TX_BASE,
} from "@/lib/chain/client";
import type { OnChainAttestation } from "@/lib/chain/por-registry";
import type { CustodySnapshot } from "@/lib/data/custody";
import { ipfsGatewayUrl } from "@/lib/ipfs-gateway";
import { abbreviateAddress } from "@/lib/onchain";
import { explorerLinkClass, sectionDividerClass } from "@/lib/ui/surface-classes";
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
    <>
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

      <MetricGrid columns={4}>
        <Metric variant="nested" label="Total AUM" value={formatUsdCompact(attestation.totalAumUsd)} />
        <Metric variant="nested" label="Mined (period)" value={formatBtc(attestation.minedBtc)} />
        <Metric
          variant="nested"
          label="Attested at"
          value={attestedAt.value}
          sublabel={attestedAt.sublabel}
        />
        <Metric variant="nested" label="Period" value={formatPorPeriod(attestation.period)} />
      </MetricGrid>

      <div className={cn(sectionDividerClass, "proof-attestation-detail", stale && "opacity-[var(--ct-opacity-60)]")}>
        <ProofRow label="Attestor address">
          <a
            href={`${EXPLORER_ADDRESS_BASE}${attestation.attestor}`}
            target="_blank"
            rel="noreferrer noopener"
            className={explorerLinkClass}
            title={attestation.attestor}
            aria-label={`View attestor ${attestation.attestor} on explorer`}
          >
            {abbreviateAddress(attestation.attestor)}
          </a>
        </ProofRow>
        <ProofRow label="Evidence hash">
          <span title={attestation.evidenceHash}>
            {abbreviateAddress(attestation.evidenceHash)}
          </span>
        </ProofRow>
        <ProofRow label="Block">{attestation.blockNumber.toString()}</ProofRow>
      </div>

      <div className="proof-actions-row product-doc-inline-row">
        <Button asChild variant="secondary" size="md">
          <a
            href={`${EXPLORER_TX_BASE}${attestation.txHash}`}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="View attestation transaction on Base Sepolia explorer"
          >
            View attestation tx on Base Sepolia (Testnet)
          </a>
        </Button>
        {(() => {
          const href = ipfsGatewayUrl(attestation.evidenceCid);
          return href ? (
            <Button asChild variant="secondary" size="md">
              <a
                href={href}
                target="_blank"
                rel="noreferrer noopener"
                aria-label="View evidence document on IPFS"
              >
                View evidence (IPFS)
              </a>
            </Button>
          ) : attestation.evidenceCid.length > 0 ? (
            <span className="ct-text-muted body-sm">View evidence (IPFS)</span>
          ) : (
            <span className="ct-text-muted body-sm">No evidence CID available</span>
          );
        })()}
      </div>

      {stale ? (
        <p className="proof-note body-xs ct-status-warning">
          Last attestation is older than 24h — badge shows Stale. A fresh
          attestation is expected each period close.
        </p>
      ) : !verified ? (
        <p className="proof-note body-xs ct-status-warning">
          Attestation signer is not yet verified against the allowlist — badge
          shows Stale until the signature is confirmed.
        </p>
      ) : null}

      {custody ? <CustodySection custody={custody} nested /> : null}
    </>
  );

  return bare ? inner : <Card material="flat">{inner}</Card>;
}
