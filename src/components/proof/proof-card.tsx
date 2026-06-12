import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProofRow } from "@/components/ui/nested-panel";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { EXPLORER_ADDRESS_BASE, EXPLORER_TX_BASE } from "@/lib/chain/client";
import type { ProofType } from "@/lib/proof-center-types";

import { ipfsGatewayUrl } from "@/lib/ipfs-gateway";
import { safeUrl } from "@/lib/safe-url";
import { abbreviateAddress } from "@/lib/onchain";
import { cn } from "@/lib/cn";

import type { UnifiedProof } from "./proof-types";

interface ProofCardProps {
  proof: UnifiedProof;
}

const TYPE_VARIANT: Record<
  ProofType,
  "brand" | "success" | "warning" | "default"
> = {
  mining_attestation: "brand",
  custody: "success",
  audit: "warning",
  methodology: "default",
};

const dateFmt = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

function uriLabel(uri: string): string {
  if (uri.startsWith("ipfs://")) return "View on IPFS";
  if (uri.startsWith("https://")) return "View document";
  return "Open";
}

function usdCompactFmt(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function btcFmt(value: number): string {
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 4,
  }).format(value)} BTC`;
}

function ProofCardShell({ children }: { children: ReactNode }) {
  return (
    <Card className="product-doc-stack--relaxed h-full" hoverOverlay={false}>
      {children}
    </Card>
  );
}

function ProofCardHeader({
  title,
  trailing,
}: {
  title: string;
  trailing: ReactNode;
}) {
  return (
    <header className="product-doc-inline-row product-doc-inline-row--between product-doc-inline-row--start gap-3">
      <h4 className="h4 text-balance m-0 min-w-0">{title}</h4>
      <div className="product-doc-inline-row shrink-0">{trailing}</div>
    </header>
  );
}

function ProofFieldList({ children }: { children: ReactNode }) {
  return <div className="ct-panel-fields">{children}</div>;
}

function ProofCardActions({ children }: { children: ReactNode }) {
  return (
    <div className="mt-auto product-doc-inline-row product-doc-inline-row--tight pt-3 border-t border-(--ct-border-soft)">
      {children}
    </div>
  );
}

function OffChainMirrorButton() {
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled
      aria-label="On-chain mirror not yet available — Phase 2 will publish this proof via the EventLogger contract."
      className="ct-text-muted"
      title="Phase 2 will mirror this proof on-chain via the EventLogger contract."
    >
      Off-chain (Phase 1)
    </Button>
  );
}

export function ProofCard({ proof }: ProofCardProps) {
  if (proof.source === "paper") {
    return <PaperProofCard proof={proof} />;
  }
  if (proof.kind === "event") {
    return <OnChainEventCard proof={proof.data} />;
  }
  return <OnChainAttestationCard proof={proof.data} />;
}

function PaperProofCard({
  proof,
}: {
  proof: Extract<UnifiedProof, { source: "paper" }>;
}) {
  const postedAt = new Date(proof.postedAt);
  const hashTruncated = abbreviateAddress(proof.hash);

  const verification = proof.attestationVerified;
  const provenance: Provenance = verification === true ? "attested" : "manual";

  return (
    <ProofCardShell>
      <ProofCardHeader
        title={proof.title}
        trailing={
          <>
            <ProvenanceBadge kind={provenance} />
            <Badge variant={TYPE_VARIANT[proof.proofType]}>
              {proof.period ?? "Standing"}
            </Badge>
          </>
        }
      />

      <ProofFieldList>
        <ProofRow label="Source">Off-chain</ProofRow>
        {verification !== null && verification !== undefined ? (
          <ProofRow label="Signature">
            <span
              className={cn(
                verification ? "ct-status-success" : "ct-status-danger",
              )}
            >
              {verification ? "Verified" : "Failed"}
            </span>
          </ProofRow>
        ) : null}
        <ProofRow label="Posted">
          {dateFmt.format(postedAt)} UTC
        </ProofRow>
        <ProofRow label="Signer">{proof.postedBy}</ProofRow>
        <ProofRow label="Hash">
          <span title={proof.hash} aria-label={`Hash ${proof.hash}`}>
            {hashTruncated}
          </span>
        </ProofRow>
      </ProofFieldList>

      <ProofCardActions>
        <Button asChild variant="secondary" size="sm">
          <a
            href={safeUrl(proof.uri)}
            target="_blank"
            rel="noreferrer noopener"
          >
            {uriLabel(proof.uri)}
          </a>
        </Button>
        {proof.txHash ? (
          <Button asChild variant="primary" size="sm">
            <a
              href={`${EXPLORER_TX_BASE}${proof.txHash}`}
              target="_blank"
              rel="noreferrer noopener"
            >
              TX on Base
            </a>
          </Button>
        ) : (
          <OffChainMirrorButton />
        )}
      </ProofCardActions>
    </ProofCardShell>
  );
}

function OnChainEventCard({
  proof,
}: {
  proof: import("@/lib/chain/event-logger").OnChainEvent;
}) {
  return (
    <ProofCardShell>
      <ProofCardHeader
        title={`Hearst event #${proof.eventId.toString()} — ${proof.kind}`}
        trailing={
          <Badge variant="success" title="Read directly from Base Sepolia">
            On-chain
          </Badge>
        }
      />

      <ProofFieldList>
        <ProofRow label="Source">
          Base Sepolia · block {proof.blockNumber.toString()}
        </ProofRow>
        <ProofRow label="Posted">
          {dateFmt.format(proof.timestamp)} UTC
        </ProofRow>
        <ProofRow label="Publisher">
          <span title={proof.publisher}>{abbreviateAddress(proof.publisher)}</span>
        </ProofRow>
        <ProofRow label="Tx hash">
          <span title={proof.txHash} aria-label={`Transaction hash ${proof.txHash}`}>
            {abbreviateAddress(proof.txHash)}
          </span>
        </ProofRow>
        <ProofRow label="Context hash">
          <span title={proof.contextHash}>
            {abbreviateAddress(proof.contextHash)}
          </span>
        </ProofRow>
      </ProofFieldList>

      <ProofCardActions>
        {proof.payloadCid.length > 0 ? (
          <Button asChild variant="secondary" size="sm">
            <a
              href={ipfsGatewayUrl(proof.payloadCid)}
              target="_blank"
              rel="noreferrer noopener"
            >
              View payload (IPFS)
            </a>
          </Button>
        ) : null}
        <Button asChild variant="primary" size="sm">
          <a
            href={`${EXPLORER_TX_BASE}${proof.txHash}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            TX on Base
          </a>
        </Button>
      </ProofCardActions>
    </ProofCardShell>
  );
}

function formatPeriod(period: bigint): string {
  const raw = period.toString();
  if (raw.length !== 6) return raw;
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

function OnChainAttestationCard({
  proof,
}: {
  proof: import("@/lib/chain/por-registry").OnChainAttestation;
}) {
  return (
    <ProofCardShell>
      <ProofCardHeader
        title={`PoR #${proof.attestationId.toString()} — ${formatPeriod(proof.period)}`}
        trailing={
          <Badge variant="brand" title="Proof-of-reserves period">
            {formatPeriod(proof.period)}
          </Badge>
        }
      />

      <ProofFieldList>
        <ProofRow label="Source">
          <Badge variant="success">On-chain</Badge>
        </ProofRow>
        <ProofRow label="Total AUM">{usdCompactFmt(proof.totalAumUsd)}</ProofRow>
        <ProofRow label="Mined">{btcFmt(proof.minedBtc)}</ProofRow>
        <ProofRow label="Attestor">
          <a
            href={`${EXPLORER_ADDRESS_BASE}${proof.attestor}`}
            target="_blank"
            rel="noreferrer noopener"
            className="hover:ct-text-strong"
            title={proof.attestor}
          >
            {abbreviateAddress(proof.attestor)}
          </a>
        </ProofRow>
        <ProofRow label="Evidence hash">
          <span title={proof.evidenceHash}>
            {abbreviateAddress(proof.evidenceHash)}
          </span>
        </ProofRow>
      </ProofFieldList>

      <ProofCardActions>
        {proof.evidenceCid.length > 0 ? (
          <Button asChild variant="secondary" size="sm">
            <a
              href={ipfsGatewayUrl(proof.evidenceCid)}
              target="_blank"
              rel="noreferrer noopener"
            >
              View evidence (IPFS)
            </a>
          </Button>
        ) : null}
        <Button asChild variant="primary" size="sm">
          <a
            href={`${EXPLORER_TX_BASE}${proof.txHash}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            TX on Base
          </a>
        </Button>
      </ProofCardActions>
    </ProofCardShell>
  );
}
