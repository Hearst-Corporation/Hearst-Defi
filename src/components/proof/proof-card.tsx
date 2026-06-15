import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProofRow } from "@/components/ui/nested-panel";
import { type Provenance } from "@/components/ui/provenance-badge";
import { EXPLORER_ADDRESS_BASE, EXPLORER_TX_BASE } from "@/lib/chain/client";
import type { ProofType } from "@/lib/proof-center-types";

import { ipfsGatewayUrl } from "@/lib/ipfs-gateway";
import { safeUrl } from "@/lib/safe-url";
import { abbreviateAddress } from "@/lib/onchain";
import { proofProvenance } from "@/lib/demo/markers";
import { cn } from "@/lib/cn";

import type { UnifiedProof } from "./proof-types";

interface ProofCardProps {
  proof: UnifiedProof;
  /** Demo sandbox — paper proofs render "Simulated" provenance. */
  demo?: boolean;
}

/** Per-type accent colour (token-only). Mining = semantic success green;
 *  other types use distinct non-brand tokens — left accent bar + dot. */
const TYPE_ACCENT: Record<ProofType, string> = {
  mining_attestation: "var(--ct-status-success)",
  custody: "var(--ct-status-info)",
  audit: "var(--ct-status-warning)",
  methodology: "var(--ct-text-faint)",
};

const TYPE_LABEL: Record<ProofType, string> = {
  mining_attestation: "Mining",
  custody: "Custody",
  audit: "Audit",
  methodology: "Methodology",
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

function ProofCardShell({
  children,
  accent,
}: {
  children: ReactNode;
  /** Per-type accent colour for the left bar (token var). */
  accent?: string;
}) {
  return (
    <Card
      className={cn("h-full", accent && "ct-proof-card")}
      hoverOverlay={false}
      style={accent ? ({ "--ct-proof-accent": accent } as React.CSSProperties) : undefined}
    >
      <div className="product-doc-stack product-doc-stack--relaxed h-full">
        {children}
      </div>
    </Card>
  );
}

function ProofCardHeader({
  title,
  eyebrow,
  accent,
  trailing,
}: {
  title: string;
  /** Small type label shown above the title with a colour dot. */
  eyebrow?: string;
  accent?: string;
  trailing: ReactNode;
}) {
  return (
    <header className="product-doc-inline-row product-doc-inline-row--between product-doc-inline-row--actions items-start">
      <div className="min-w-0 product-doc-stack product-doc-stack--micro">
        {eyebrow ? (
          <span className="eyebrow product-doc-inline-row product-doc-inline-row--dense ct-text-muted">
            <span
              aria-hidden
              className="ct-dot"
              style={{ background: accent ?? "var(--ct-border)" }}
            />
            {eyebrow}
          </span>
        ) : null}
        <h3 className="h3 text-balance m-0 min-w-0">{title}</h3>
      </div>
      {trailing ? (
        <div className="product-doc-inline-row shrink-0">{trailing}</div>
      ) : null}
    </header>
  );
}

function ProofFieldList({ children }: { children: ReactNode }) {
  return <div className="ct-panel-fields">{children}</div>;
}

function ProofCardActions({ children }: { children: ReactNode }) {
  return (
    <div className="mt-auto product-doc-inline-row product-doc-inline-row--tight border-t ct-bc-soft pt-3">
      {children}
    </div>
  );
}

/** Subtle inline tag (not a dead button) marking the Phase-1 off-chain status. */
function OffChainMirrorTag() {
  return (
    <span
      className="ml-auto product-doc-inline-row product-doc-inline-row--dense body-xs ct-text-faint"
      title="Phase 2 will mirror this proof on-chain via the EventLogger contract."
    >
      <span aria-hidden className="ct-dot" style={{ background: "var(--ct-text-faint)" }} />
      Off-chain · Phase 1
    </span>
  );
}

/** Verification chip — only when an end-to-end signature result exists.
 *  Provenance (Attested / Manual) lives in the header eyebrow so BOTH the
 *  provenance AND the signature result stay visible (Admin Honesty contract). */
function VerificationChip({
  verification,
}: {
  verification: boolean | null | undefined;
}) {
  if (verification === true) return <Badge variant="success">✓ Verified</Badge>;
  if (verification === false) return <Badge variant="danger">✗ Failed</Badge>;
  return null;
}

export function ProofCard({ proof, demo = false }: ProofCardProps) {
  if (proof.source === "paper") {
    return <PaperProofCard proof={proof} demo={demo} />;
  }
  if (proof.kind === "event") {
    return <OnChainEventCard proof={proof.data} />;
  }
  return <OnChainAttestationCard proof={proof.data} />;
}

function PaperProofCard({
  proof,
  demo = false,
}: {
  proof: Extract<UnifiedProof, { source: "paper" }>;
  demo?: boolean;
}) {
  const postedAt = new Date(proof.postedAt);
  const hashTruncated = abbreviateAddress(proof.hash);

  const verification = proof.attestationVerified;
  const liveKind: Provenance = verification === true ? "attested" : "manual";
  const provenance: Provenance = proofProvenance(demo, proof.source, liveKind);

  const accent = TYPE_ACCENT[proof.proofType];
  const provenanceLabel =
    provenance === "simulated"
      ? "Simulated"
      : provenance === "attested"
        ? "Attested"
        : "Manual";

  return (
    <ProofCardShell accent={accent}>
      <ProofCardHeader
        title={proof.title}
        eyebrow={`${TYPE_LABEL[proof.proofType]} · ${provenanceLabel}`}
        accent={accent}
        trailing={<VerificationChip verification={verification} />}
      />

      <ProofFieldList>
        <ProofRow label="Source">Off-chain</ProofRow>
        <ProofRow label="Posted">
          {dateFmt.format(postedAt)} UTC
        </ProofRow>
        <ProofRow label="Signer">
          <span className="ct-proof-row__truncate">{proof.postedBy}</span>
        </ProofRow>
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
              TX on Base (Testnet)
            </a>
          </Button>
        ) : (
          <OffChainMirrorTag />
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
        {(() => {
          const href = ipfsGatewayUrl(proof.payloadCid);
          return href ? (
            <Button asChild variant="secondary" size="sm">
              <a href={href} target="_blank" rel="noreferrer noopener">
                View payload (IPFS)
              </a>
            </Button>
          ) : proof.payloadCid.length > 0 ? (
            <span className="ct-text-muted body-sm">View payload (IPFS)</span>
          ) : null;
        })()}
        <Button asChild variant="primary" size="sm">
          <a
            href={`${EXPLORER_TX_BASE}${proof.txHash}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            TX on Base (Testnet)
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
        {(() => {
          const href = ipfsGatewayUrl(proof.evidenceCid);
          return href ? (
            <Button asChild variant="secondary" size="sm">
              <a href={href} target="_blank" rel="noreferrer noopener">
                View evidence (IPFS)
              </a>
            </Button>
          ) : proof.evidenceCid.length > 0 ? (
            <span className="ct-text-muted body-sm">View evidence (IPFS)</span>
          ) : null;
        })()}
        <Button asChild variant="primary" size="sm">
          <a
            href={`${EXPLORER_TX_BASE}${proof.txHash}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            TX on Base (Testnet)
          </a>
        </Button>
      </ProofCardActions>
    </ProofCardShell>
  );
}
