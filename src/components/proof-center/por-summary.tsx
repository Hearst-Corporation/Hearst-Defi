import { AwaitingMetricState } from "@/components/portfolio/awaiting-metric-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Metric } from "@/components/ui/metric";
import { MetricGrid, ProofRow } from "@/components/ui/nested-panel";
import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
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
}

export function PorSummary({
  attestation,
  custody = null,
  verified = false,
}: PorSummaryProps) {
  if (attestation === null) {
    return (
      <div className="product-doc-stack">
        <AwaitingMetricState {...POR_ATTESTATION_EMPTY} />
        {custody ? <CustodySection custody={custody} /> : null}
      </div>
    );
  }

  const stale = isOlderThan24h(attestation.timestamp);
  const provenance = resolveAttestationProvenance(attestation.timestamp, verified);
  const attestedAt = formatNestedTimestamp(attestation.timestamp);

  return (
    <Card>
      <DashboardPanelHeader
        eyebrow="Proof of Reserves"
        title={`Period ${formatPorPeriod(attestation.period)} — Attestation #${attestation.attestationId.toString()}`}
        provenance={provenance}
        tone="primary"
      />

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

      <div className={cn(sectionDividerClass, "pt-2")}>
        <ProofRow label="Attestor address">
          <a
            href={`${EXPLORER_ADDRESS_BASE}${attestation.attestor}`}
            target="_blank"
            rel="noreferrer noopener"
            className={explorerLinkClass}
            title={attestation.attestor}
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

      <div className="mt-4 product-doc-inline-row">
        <Button asChild variant="secondary" size="md">
          <a
            href={`${EXPLORER_TX_BASE}${attestation.txHash}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            View attestation tx on Base Sepolia
          </a>
        </Button>
        {(() => {
          const href = ipfsGatewayUrl(attestation.evidenceCid);
          return href ? (
            <Button asChild variant="secondary" size="md">
              <a href={href} target="_blank" rel="noreferrer noopener">
                View evidence (IPFS)
              </a>
            </Button>
          ) : attestation.evidenceCid.length > 0 ? (
            <span className="ct-text-muted body-sm">View evidence (IPFS)</span>
          ) : null;
        })()}
      </div>

      {stale ? (
        <p className="mt-3 body-xs ct-status-warning">
          Last attestation is older than 24h — badge shows Stale. A fresh
          attestation is expected each period close.
        </p>
      ) : !verified ? (
        <p className="mt-3 body-xs ct-status-warning">
          Attestation signer is not yet verified against the allowlist — badge
          shows Stale until the signature is confirmed.
        </p>
      ) : null}

      {custody ? <CustodySection custody={custody} nested /> : null}
    </Card>
  );
}
