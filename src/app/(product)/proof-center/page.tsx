// Investor-facing Proof Center — Reserve Vault Series 1 institutional proof.
// The (product) layout already enforces requireInvestor().
//
// Series 1 = BTC accumulation (mining note v3.0), with BTC delivered at maturity.
// The proof rail leads with institutional
// proof blocks — proof of mining, proof of reserves (B1/B2/B3 + PoR registry),
// proof of custody, proof of delivery, contract events, take-profit/curtailment,
// and a proof-freshness timeline — each with strict per-block provenance and an
// honest empty state when the underlying evidence is absent (never fake live).
//
// Legacy records stay outside the primary proof rail. Unbounded content (event
// log, proofs grid, contracts, timelocks) → /proof-center/full.

export const dynamic = "force-dynamic";

import { ProvenanceBadge } from "@/components/catalyst/provenance-badge";
import { KycPageTitle, KycPanel, KycSection } from "@/components/catalyst/kyc-page";
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
    <KycPanel className="p-5">
      <div className="flex items-start justify-between gap-(--ct-space-3)">
        <div className="flex flex-col gap-(--ct-space-1)">
          <span className="text-xs font-semibold uppercase tracking-uppercase text-zinc-500 dark:text-zinc-400">{block.eyebrow}</span>
          <h3 className="m-0 text-sm font-semibold text-zinc-950 dark:text-white">
            {block.title}
          </h3>
        </div>
        <ProvenanceBadge kind={block.provenance} />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-950/8 pt-3 dark:border-white/10">
        <span className={cn("text-[length:var(--ct-text-sm)] font-medium", stateTone[block.state])}>
          {stateLabel[block.state]}
        </span>
        <span className="text-[length:var(--ct-text-2xs)] text-[var(--ct-text-faint)]">
          {block.state === "absent"
            ? "Appears once the vault operates"
            : `${block.evidenceCount} evidence · ${formatFreshness(block.lastUpdated)}`}
        </span>
      </div>
    </KycPanel>
  );
}

function ProofFreshnessTimeline({ entries }: { entries: ProofFreshnessEntry[] }) {
  return (
    <KycPanel className="p-5">
      <div className="flex flex-col gap-(--ct-space-1)">
        <span className="text-xs font-semibold uppercase tracking-uppercase text-zinc-500 dark:text-zinc-400">Source recency</span>
        <h3 className="m-0 text-sm font-semibold text-zinc-950 dark:text-white">
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
    </KycPanel>
  );
}

export default async function ProductProofCenterPage() {
  const hubData = await loadProofCenterHubData(false);
  const { series1Proof, proofFreshness, coldEmpty } = hubData;

  return (
    <div className="flex flex-col gap-10">
      <KycPageTitle
        title="Proof Center"
        description="Source evidence for mining, reserve, custody and delivery across the Series 1 lifecycle."
      />
      <KycSection
        index="01"
        title="Proof register"
        description="Every record is presented with its current source provenance and freshness."
      >
        {!coldEmpty ? (
          <div className="grid grid-cols-1 gap-(--ct-space-4) sm:grid-cols-2 xl:grid-cols-3">
            {series1Proof
              .filter((b) => b.kind !== "freshness")
              .map((block) => (
                <ProofBlockCard key={block.kind} block={block} />
              ))}
            <ProofFreshnessTimeline entries={proofFreshness} />
          </div>
        ) : (
          <KycPanel className="p-8 text-center">
            <p className="text-sm font-medium text-zinc-950 dark:text-white">Proof records are not available yet</p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Evidence appears when the vault sources are connected and the first operating reports are recorded.</p>
          </KycPanel>
        )}
        <p className="mt-5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            Series 1 accumulates Bitcoin over a 24-month term and settles at
            maturity. Delivery evidence appears after a maturity settlement is
            recorded. Estimated accumulation is disclosed as a range and is not
            guaranteed. Each proof block above shows its own source provenance;
            blocks read &ldquo;Not yet available&rdquo; until a source is recorded.
        </p>
      </KycSection>
    </div>
  );
}
