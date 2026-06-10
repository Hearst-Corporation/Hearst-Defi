import Link from "next/link";

import { Card } from "@/components/ui/card";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import type { AdminProofStatus } from "@/lib/data/admin-overview";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

interface RowProps {
  label: string;
  children: React.ReactNode;
}

function Row({ label, children }: RowProps) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5 first:pt-0 last:pb-0 border-t border-[var(--ct-border-soft)] first:border-t-0">
      <span className="body-sm ct-text-muted">{label}</span>
      <span className="body-sm ct-text-strong tabular text-right inline-flex items-baseline gap-2">
        {children}
      </span>
    </div>
  );
}

/**
 * Proof & evidence status — answers "is Hearst Connect audit-ready right now".
 * Reads the latest mining attestation freshness, attestation count, and live
 * custody PoR scope. Honest empty states: "No attestation yet", "Scope not
 * pinned". Links into the full Proof Center.
 */
export function ProofStatusCard({ proof }: { proof: AdminProofStatus }) {
  const attestationFresh = proof.miningFreshness === "live";
  const hasEvidence =
    proof.proofsTotal > 0 ||
    proof.custodyConfigured ||
    proof.lastMiningAttestationAt !== null;

  // No proofs, no custody scope, no attestation: render a single honest
  // empty-state line instead of a card full of zeros (looks intentional, not
  // broken). The data appears here once evidence is posted.
  if (!hasEvidence) {
    return (
      <Card className="flex flex-col">
        <div className="dash-label relative z-10">
          <span className="text-micro font-bold uppercase tracking-widest ct-text-muted">
            Proof &amp; evidence
          </span>
          <ProvenanceBadge kind="manual" />
        </div>
        <p className="mt-4 body-sm ct-text-muted relative z-10">
          No attestations or custody proof on file yet. Mining attestations and
          the custody proof-of-reserves snapshot surface here once posted.
        </p>
        <Link
          href="/proof-center"
          className="mt-4 body-xs ct-link-accent uppercase tracking-wide inline-flex items-center gap-1 relative z-10"
        >
          Open Proof Center <span aria-hidden>→</span>
        </Link>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col">
      <div className="dash-label relative z-10">
        <span className="text-micro font-bold uppercase tracking-widest ct-text-muted">
          Proof &amp; evidence
        </span>
        <ProvenanceBadge
          kind={
            proof.attestationsCount > 0 && attestationFresh ? "attested" : "stale"
          }
        />
      </div>

      <div className="mt-6 flex flex-col relative z-10">
        <Row label="Latest mining attestation">
          {proof.lastMiningAttestationAt ? (
            <>
              {dateFmt.format(proof.lastMiningAttestationAt)}
              <ProvenanceBadge kind={attestationFresh ? "attested" : "stale"} />
            </>
          ) : (
            <span className="ct-text-muted">No attestation yet</span>
          )}
        </Row>

        <Row label="Attestations on file">
          <span className={proof.attestationsCount > 0 ? "" : "ct-text-muted"}>
            {proof.attestationsCount}
          </span>
        </Row>

        <Row label="Custody proof-of-reserves">
          {proof.custodyConfigured ? (
            <>
              {usdCompact.format(proof.custodyReservesUsdc)}
              <ProvenanceBadge kind={proof.custodyProvenance} />
            </>
          ) : (
            <span className="inline-flex items-baseline gap-2">
              <span className="ct-text-muted">Scope not pinned</span>
              <ProvenanceBadge kind="manual" />
            </span>
          )}
        </Row>

        <Row label="Total proofs on file">
          <span className={proof.proofsTotal > 0 ? "" : "ct-text-muted"}>
            {proof.proofsTotal}
          </span>
        </Row>

        <Link
          href="/proof-center"
          className="mt-auto pt-6 body-xs ct-link-accent uppercase tracking-wide inline-flex items-center gap-1"
        >
          Open Proof Center <span aria-hidden>→</span>
        </Link>
      </div>
    </Card>
  );
}
