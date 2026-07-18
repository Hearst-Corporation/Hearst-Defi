// Investor-facing Proof Center — Reserve Vault Series 1 institutional proof.
// The (product) layout already enforces requireInvestor().
//
// Series 1 = BTC accumulation (mining note v3.0): no periodic cash distribution,
// BTC delivered at maturity. The proof rail therefore leads with institutional
// proof blocks — proof of mining, proof of reserves (B1/B2/B3 + PoR registry),
// proof of custody, proof of delivery, contract events, take-profit/curtailment,
// and a proof-freshness timeline — each with strict per-block provenance and an
// honest empty state when the underlying evidence is absent (never fake live).
//
// "Latest distributions" is de-prioritized (Series 1 has no periodic
// distribution); the underlying data is retained but kept out of the primary
// rail. Unbounded content (event log, proofs grid, contracts, timelocks)
// → /proof-center/full.

export const dynamic = "force-dynamic";

import Link from "next/link";

import { Card } from "@/components/catalyst/card";
import { ProvenanceBadge } from "@/components/catalyst/provenance-badge";
import { ProofCenterHubLayout } from "@/components/proof-center/proof-center-hub-layout";
import { ProductPageHeader } from "@/components/connect/product-page-header";
import { cn } from "@/lib/cn";
import { loadProofCenterHubData } from "@/lib/proof-center/hub-data";
import type {
  ProofBlockState,
  Series1ProofBlock,
  ProofFreshnessEntry,
} from "@/lib/proof-center/hub-data";

const stateLabel: Record<ProofBlockState, string> = {
  present: "Evidenced",
  pending: "Pending inputs",
  absent: "Not yet available",
};

const stateTone: Record<ProofBlockState, string> = {
  present: "text-[var(--ct-accent)]",
  pending: "text-[var(--ct-text-muted)]",
  absent: "text-[var(--ct-text-faint)]",
};

const freshnessFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function formatFreshness(iso: string | null): string {
  if (!iso) return "No source yet";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "No source yet";
  return `${freshnessFmt.format(new Date(t))} UTC`;
}

function ProofBlockCard({ block }: { block: Series1ProofBlock }) {
  return (
    <Card material="flat" className="p-(--ct-space-5)" contentClassName="flex flex-col gap-(--ct-space-3)">
      <div className="flex items-start justify-between gap-(--ct-space-3)">
        <div className="flex flex-col gap-(--ct-space-1)">
          <span className="ct-bento-label leading-none">{block.eyebrow}</span>
          <h3 className="m-0 text-[length:var(--ct-text-base)] font-semibold text-[var(--ct-text-strong)]">
            {block.title}
          </h3>
        </div>
        <ProvenanceBadge kind={block.provenance} />
      </div>
      <div className="flex items-center justify-between gap-(--ct-space-3) border-t border-[var(--ct-border)] pt-(--ct-space-3)">
        <span className={cn("text-[length:var(--ct-text-sm)] font-medium", stateTone[block.state])}>
          {stateLabel[block.state]}
        </span>
        <span className="text-[length:var(--ct-text-2xs)] text-[var(--ct-text-faint)]">
          {block.state === "absent"
            ? "Appears once the vault operates"
            : `${block.evidenceCount} evidence · ${formatFreshness(block.lastUpdated)}`}
        </span>
      </div>
    </Card>
  );
}

function ProofFreshnessTimeline({ entries }: { entries: ProofFreshnessEntry[] }) {
  return (
    <Card material="flat" className="p-(--ct-space-5)" contentClassName="flex flex-col gap-(--ct-space-4)">
      <div className="flex flex-col gap-(--ct-space-1)">
        <span className="ct-bento-label leading-none">Source recency</span>
        <h3 className="m-0 text-[length:var(--ct-text-base)] font-semibold text-[var(--ct-text-strong)]">
          Proof Freshness
        </h3>
      </div>
      <ul className="flex flex-col gap-(--ct-space-3) m-0 p-0 list-none">
        {entries.map((entry) => (
          <li
            key={entry.label}
            className="flex items-center justify-between gap-(--ct-space-3) border-t border-[var(--ct-border)] pt-(--ct-space-3) first:border-t-0 first:pt-0"
          >
            <span className="flex items-center gap-(--ct-space-2)">
              <span
                aria-hidden
                className={cn(
                  "inline-block h-2 w-2 rounded-full",
                  entry.stale
                    ? "bg-[var(--ct-text-faint)]"
                    : "bg-[var(--ct-accent)]",
                )}
              />
              <span className="text-[length:var(--ct-text-sm)] font-medium text-[var(--ct-text-strong)]">
                {entry.label}
              </span>
            </span>
            <span className="flex items-center gap-(--ct-space-3)">
              <span className="text-[length:var(--ct-text-2xs)] text-[var(--ct-text-faint)]">
                {entry.stale ? "Stale · " : ""}
                {formatFreshness(entry.lastUpdated)}
              </span>
              <ProvenanceBadge kind={entry.provenance} compact />
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default async function ProductProofCenterPage() {
  const hubData = await loadProofCenterHubData(false);
  const { series1Proof, proofFreshness, coldEmpty, distributionsCount } = hubData;

  return (
    <div className="flex flex-col gap-(--ct-space-6)">
      {!coldEmpty && (
        <section
          aria-labelledby="series1-proof-heading"
          className="rounded-2xl border border-[var(--ct-border)] bg-surface-page p-5 lg:p-6"
        >
          <ProductPageHeader
            titleLead="Reserve Vault"
            titleAccent="Series 1"
            contextLabel="Institutional Proof · BTC Accumulation"
            className="mb-(--ct-space-5)"
          />
          <h2 id="series1-proof-heading" className="sr-only">
            Series 1 institutional proof blocks
          </h2>
          <div className="grid grid-cols-1 gap-(--ct-space-4) sm:grid-cols-2 xl:grid-cols-3">
            {series1Proof
              .filter((b) => b.kind !== "freshness")
              .map((block) => (
                <ProofBlockCard key={block.kind} block={block} />
              ))}
            <ProofFreshnessTimeline entries={proofFreshness} />
          </div>
          <p className="mt-(--ct-space-5) text-[length:var(--ct-text-2xs)] leading-relaxed text-[var(--ct-text-faint)]">
            Series 1 accumulates Bitcoin over a 24-month term and settles at
            maturity — there is no periodic cash distribution. Estimated
            accumulation is disclosed as a range and is not guaranteed. Each
            proof block above shows its own source provenance; blocks read
            &ldquo;Not yet available&rdquo; until the vault operates on-chain
            {distributionsCount > 0
              ? " (settlement events, not recurring payouts, appear in the full log)."
              : "."}
          </p>
        </section>
      )}

      <ProofCenterHubLayout variant="product" {...hubData} />
    </div>
  );
}
