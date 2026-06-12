import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { EXPLORER_ADDRESS_BASE, EXPLORER_TX_BASE } from "@/lib/chain/client";
import type { ProofType } from "@/lib/proof-center-types";

import { ipfsGatewayUrl } from "@/lib/ipfs-gateway";
import { safeUrl } from "@/lib/safe-url";
import { abbreviateAddress } from "@/lib/onchain";

import type { UnifiedProof } from "./proof-types";

interface ProofCardProps {
  proof: UnifiedProof;
}

const TYPE_LABEL: Record<ProofType, string> = {
  mining_attestation: "Mining attestation",
  custody: "Custody",
  audit: "Audit",
  methodology: "Methodology",
};

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

  // Honesty: off-chain proofs need a visible provenance, and the end-to-end
  // signature check must not be silently dropped.
  //  - verified signature → "attested"
  //  - failed signature   → keep "manual" provenance but flag the failure
  //  - no/absent signature → "manual" (off-chain evidence, manually posted)
  const verification = proof.attestationVerified;
  const provenance: Provenance = verification === true ? "attested" : "manual";

  return (
    <Card className="product-doc-stack--relaxed">
      <header className="product-doc-stack--tight">
        <div className="product-doc-inline-row product-doc-inline-row--between">
          <span className="eyebrow">{TYPE_LABEL[proof.proofType]}</span>
          <div className="product-doc-inline-row">
            <ProvenanceBadge kind={provenance} />
            <Badge variant={TYPE_VARIANT[proof.proofType]}>
              {proof.period ?? "Standing"}
            </Badge>
          </div>
        </div>
        <h4 className="h4 text-balance">{proof.title}</h4>
      </header>

      <dl className="product-doc-stack--dense">
        <div className="product-doc-inline-row product-doc-inline-row--between product-doc-inline-row--baseline product-doc-inline-row--actions">
          <dt className="body-xs">Source</dt>
          <dd className="body-xs ct-text-body">Off-chain</dd>
        </div>
        {verification !== null && verification !== undefined ? (
          <div className="product-doc-inline-row product-doc-inline-row--between product-doc-inline-row--baseline product-doc-inline-row--actions">
            <dt className="body-xs">Signature</dt>
            <dd
              className={
                verification
                  ? "body-xs ct-status-success"
                  : "body-xs ct-status-danger"
              }
            >
              {verification ? "Verified" : "Failed"}
            </dd>
          </div>
        ) : null}
        <div className="product-doc-inline-row product-doc-inline-row--between product-doc-inline-row--baseline product-doc-inline-row--actions">
          <dt className="body-xs">Posted</dt>
          <dd className="body-xs ct-text-body">
            {dateFmt.format(postedAt)} UTC
          </dd>
        </div>
        <div className="product-doc-inline-row product-doc-inline-row--between product-doc-inline-row--baseline product-doc-inline-row--actions">
          <dt className="body-xs">Signer</dt>
          <dd className="body-xs ct-text-body">
            {proof.postedBy}
          </dd>
        </div>
        <div className="product-doc-inline-row product-doc-inline-row--between product-doc-inline-row--baseline product-doc-inline-row--actions">
          <dt className="body-xs">Hash</dt>
          <dd
            className="mono tabular body-xs ct-text-primary"
            title={proof.hash}
            aria-label={`Hash ${proof.hash}`}
          >
            {hashTruncated}
          </dd>
        </div>
      </dl>

      <div className="mt-auto product-doc-inline-row pt-2">
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
        )}
      </div>
    </Card>
  );
}

function OnChainEventCard({
  proof,
}: {
  proof: import("@/lib/chain/event-logger").OnChainEvent;
}) {
  return (
    <Card className="product-doc-stack--relaxed">
      <header className="product-doc-stack--tight">
        <div className="product-doc-inline-row product-doc-inline-row--between">
          <span className="eyebrow">EventLogger · {proof.kind}</span>
          <Badge variant="success" title="Read directly from Base Sepolia">
            On-chain
          </Badge>
        </div>
        <h4 className="h4 text-balance">
          Hearst event #{proof.eventId.toString()} — {proof.kind}
        </h4>
      </header>

      <dl className="product-doc-stack--dense">
        <div className="product-doc-inline-row product-doc-inline-row--between product-doc-inline-row--baseline product-doc-inline-row--actions">
          <dt className="body-xs">Source</dt>
          <dd className="body-xs ct-text-body">
            Base Sepolia · block {proof.blockNumber.toString()}
          </dd>
        </div>
        <div className="product-doc-inline-row product-doc-inline-row--between product-doc-inline-row--baseline product-doc-inline-row--actions">
          <dt className="body-xs">Posted</dt>
          <dd className="body-xs ct-text-body">
            {dateFmt.format(proof.timestamp)} UTC
          </dd>
        </div>
        <div className="product-doc-inline-row product-doc-inline-row--between product-doc-inline-row--baseline product-doc-inline-row--actions">
          <dt className="body-xs">Publisher</dt>
          <dd
            className="mono tabular body-xs ct-text-body"
            title={proof.publisher}
          >
            {abbreviateAddress(proof.publisher)}
          </dd>
        </div>
        <div className="product-doc-inline-row product-doc-inline-row--between product-doc-inline-row--baseline product-doc-inline-row--actions">
          <dt className="body-xs">Tx hash</dt>
          <dd
            className="mono tabular body-xs ct-text-primary"
            title={proof.txHash}
            aria-label={`Transaction hash ${proof.txHash}`}
          >
            {abbreviateAddress(proof.txHash)}
          </dd>
        </div>
        <div className="product-doc-inline-row product-doc-inline-row--between product-doc-inline-row--baseline product-doc-inline-row--actions">
          <dt className="body-xs">Context hash</dt>
          <dd
            className="mono tabular body-xs ct-text-body"
            title={proof.contextHash}
          >
            {abbreviateAddress(proof.contextHash)}
          </dd>
        </div>
      </dl>

      <div className="mt-auto product-doc-inline-row pt-2">
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
      </div>
    </Card>
  );
}

function formatPeriod(period: bigint): string {
  // YYYYMM → "YYYY-MM"
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
    <Card className="product-doc-stack--relaxed">
      <header className="product-doc-stack--tight">
        <div className="product-doc-inline-row product-doc-inline-row--between">
          <span className="eyebrow">PoR attestation</span>
          <Badge variant="brand" title="Proof-of-reserves period">
            {formatPeriod(proof.period)}
          </Badge>
        </div>
        <h4 className="h4 text-balance">
          PoR #{proof.attestationId.toString()} — {formatPeriod(proof.period)}
        </h4>
      </header>

      <dl className="product-doc-stack--dense">
        <div className="product-doc-inline-row product-doc-inline-row--between product-doc-inline-row--baseline product-doc-inline-row--actions">
          <dt className="body-xs">Source</dt>
          <dd className="body-xs">
            <Badge variant="success">On-chain</Badge>
          </dd>
        </div>
        <div className="product-doc-inline-row product-doc-inline-row--between product-doc-inline-row--baseline product-doc-inline-row--actions">
          <dt className="body-xs">Total AUM</dt>
          <dd className="mono tabular body-xs ct-text-primary">
            {usdCompactFmt(proof.totalAumUsd)}
          </dd>
        </div>
        <div className="product-doc-inline-row product-doc-inline-row--between product-doc-inline-row--baseline product-doc-inline-row--actions">
          <dt className="body-xs">Mined</dt>
          <dd className="mono tabular body-xs ct-text-primary">
            {btcFmt(proof.minedBtc)}
          </dd>
        </div>
        <div className="product-doc-inline-row product-doc-inline-row--between product-doc-inline-row--baseline product-doc-inline-row--actions">
          <dt className="body-xs">Attestor</dt>
          <dd
            className="mono tabular body-xs ct-text-body"
            title={proof.attestor}
          >
            <a
              href={`${EXPLORER_ADDRESS_BASE}${proof.attestor}`}
              target="_blank"
              rel="noreferrer noopener"
              className="hover:ct-text-strong"
            >
              {abbreviateAddress(proof.attestor)}
            </a>
          </dd>
        </div>
        <div className="product-doc-inline-row product-doc-inline-row--between product-doc-inline-row--baseline product-doc-inline-row--actions">
          <dt className="body-xs">Evidence hash</dt>
          <dd
            className="mono tabular body-xs ct-text-primary"
            title={proof.evidenceHash}
          >
            {abbreviateAddress(proof.evidenceHash)}
          </dd>
        </div>
      </dl>

      <div className="mt-auto product-doc-inline-row pt-2">
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
      </div>
    </Card>
  );
}
