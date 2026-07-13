/**
 * PositionInfrastructureProofs — the body of the "Infrastructure & Proofs"
 * section on the position detail page. Two honest blocks:
 *
 *   1. On-chain proofs — the real transactions that carry a txHash (placeholder
 *      seed/demo hashes are filtered out so we never link to a 404 on BaseScan).
 *      Each row: type badge, date, truncated mono hash, and an external explorer
 *      link. Empty state when nothing is on-chain.
 *   2. Mining infrastructure — an honest "coming next" placeholder. ASIC models,
 *      allocated hashrate, facility and attestation reports are NOT in the data
 *      yet, so we list them as pending rather than fabricate any figure.
 *
 * Pure render (server component). Token-only. The section wrapper (card shell +
 * title) is provided by the caller — this component renders the body only.
 */

import { Badge } from "@/components/catalyst/badge";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { explorerTxUrl, isPlaceholderTxHash } from "@/lib/chain/explorer";
import { cn } from "@/lib/cn";
import { formatAdminDate } from "@/lib/vaults/product-display";

type ProofTx = {
  id: string;
  type: string;
  txHash: string | null;
  occurredAt: Date;
};

const MINING_PENDING = [
  "ASIC models & manufacturers",
  "Allocated hashrate",
  "Facility & power source",
  "Attestation reports",
] as const;

function truncateHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}

function ProofRow({
  label,
  type,
  txHash,
  occurredAt,
}: {
  label: string;
  type: string;
  txHash: string;
  occurredAt: Date;
}) {
  const linkable = !isPlaceholderTxHash(txHash);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 bg-surface-card px-5 py-4 min-w-0">
      <Badge color="zinc">{type}</Badge>
      <span className="ct-metric-caption whitespace-nowrap">
        {label} · {formatAdminDate(occurredAt)}
      </span>
      <span className="ct-metric-caption font-mono text-[var(--ct-text-secondary)]">
        {truncateHash(txHash)}
      </span>
      {linkable ? (
        <a
          href={explorerTxUrl(txHash)}
          target="_blank"
          rel="noreferrer"
          className="ct-metric-caption ml-auto inline-flex items-center gap-1 text-[var(--ct-text-secondary)] transition-colors duration-150 hover:text-[var(--ct-text-primary)]"
        >
          View
          <span aria-hidden="true">↗</span>
        </a>
      ) : null}
    </div>
  );
}

export function PositionInfrastructureProofs({
  txHashOpen,
  transactions,
  "aria-label": ariaLabel,
}: {
  txHashOpen: string | null;
  explorerUrl: string | null;
  transactions: ProofTx[];
  "aria-label"?: string;
}) {
  const onChainTxs = transactions.filter((tx): tx is ProofTx & { txHash: string } =>
    tx.txHash != null,
  );

  const alreadyListed = onChainTxs.some(
    (tx) => tx.txHash.toLowerCase() === (txHashOpen ?? "").toLowerCase(),
  );
  const showOpening = txHashOpen != null && !alreadyListed;

  const hasProofs = showOpening || onChainTxs.length > 0;

  return (
    <div aria-label={ariaLabel}>
      {/* On-chain proofs */}
      <div className="flex flex-col gap-1 px-5 pt-4 pb-3">
        <div className="flex items-center justify-between gap-3">
          <span className="ct-bento-label">On-chain proofs</span>
          <ProvenanceBadge kind="attested" variant="compact" />
        </div>
      </div>
      {hasProofs ? (
        <div className="flex flex-col gap-px bg-[var(--ct-border-soft)]">
          {showOpening ? (
            <ProofRow
              label="Opening transaction"
              type="Opening transaction"
              txHash={txHashOpen}
              // Opening tx has no dedicated timestamp on this shape; use the
              // earliest available transaction date, else render label only.
              occurredAt={onChainTxs[0]?.occurredAt ?? new Date(0)}
            />
          ) : null}
          {onChainTxs.map((tx) => (
            <ProofRow
              key={tx.id}
              label="Confirmed"
              type={tx.type}
              txHash={tx.txHash}
              occurredAt={tx.occurredAt}
            />
          ))}
        </div>
      ) : (
        <p className="ct-metric-caption px-5 pb-4">No on-chain proofs recorded yet.</p>
      )}

      {/* Mining infrastructure */}
      <div className="border-t border-[var(--ct-border-soft)] px-5 pt-4 pb-4">
        <div className="mb-2 ct-bento-label">Mining infrastructure</div>
        <ul className="flex flex-col gap-1.5">
          {MINING_PENDING.map((item) => (
            <li key={item} className={cn("ct-metric-caption inline-flex items-center gap-2")}>
              <span
                aria-hidden="true"
                className="size-1.5 shrink-0 rounded-full bg-[var(--ct-text-faint)]"
              />
              {item}
              <span className="text-[var(--ct-text-faint)]">· coming next</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
