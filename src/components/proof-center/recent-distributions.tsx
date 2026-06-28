import type { ReactNode } from "react";

import { EmptySurface } from "@/components/ui/empty-surface";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { RECENT_DISTRIBUTIONS_EMPTY } from "@/components/proof/empty-messages";
import { EXPLORER_TX_BASE } from "@/lib/chain/client";
import type { ProofCenterDistributionRow } from "@/lib/data/proof-center";
import { distributionProvenance } from "@/lib/proof-center/distribution-provenance";
import { formatUsdCompact } from "@/lib/format/usd-compact";
import type { Provenance } from "@/components/ui/provenance-badge";
import { abbreviateAddress } from "@/lib/onchain";
import { cn } from "@/lib/cn";

import type { ProofCenterSectionLedProps } from "./proof-center-types";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

// Strongest → weakest. Panel badge takes the weakest row so it never overstates.
const PROVENANCE_RANK: Record<Provenance, number> = {
  live: 0,
  oracle: 1,
  attested: 2,
  estimated: 3,
  partial: 4,
  manual: 5,
  stale: 6,
  simulated: 7,
};

function weakestProvenance(kinds: readonly Provenance[]): Provenance {
  return kinds.reduce((weakest, kind) =>
    PROVENANCE_RANK[kind] > PROVENANCE_RANK[weakest] ? kind : weakest,
  );
}

/** Micro label — Portfolio/vaults bento style. */
function MicroLabel({ children }: { children: ReactNode }) {
  return (
    <span className="ct-bento-label">
      {children}
    </span>
  );
}

interface RecentDistributionsProps extends ProofCenterSectionLedProps {
  distributions: ReadonlyArray<ProofCenterDistributionRow>;
}

export function RecentDistributions({
  distributions,
  sectionLed = false,
  bare = false,
}: RecentDistributionsProps) {
  if (distributions.length === 0) {
    const empty = (
      <>
        {!bare && (
          <div className="flex items-end justify-between p-5 border-b border-white/5">
            <div className="flex flex-col gap-1.5">
              <MicroLabel>Latest distributions</MicroLabel>
              <h3 className="text-[length:var(--ct-text-micro)] font-bold text-zinc-400 uppercase tracking-[0.15em] leading-none">
                Awaiting first distribution
              </h3>
            </div>
          </div>
        )}
        <EmptySurface live {...RECENT_DISTRIBUTIONS_EMPTY} />
      </>
    );
    return bare ? (
      empty
    ) : (
      <section className="dark rounded-2xl border border-white/10 bg-surface-card shadow-sm overflow-hidden flex flex-col">
        {empty}
      </section>
    );
  }

  const panelProvenance = weakestProvenance(
    distributions.map((d) => distributionProvenance(d.txHash)),
  );

  const inner = (
    <>
      {!bare && (
        <div className="flex items-end justify-between p-5 border-b border-white/5">
          <div className="flex flex-col gap-1.5">
            <MicroLabel>
              {sectionLed ? "Latest distributions" : "Payout history"}
            </MicroLabel>
            <h3 className="text-[length:var(--ct-text-micro)] font-bold text-zinc-400 uppercase tracking-[0.15em] leading-none">
              {sectionLed
                ? `Last ${distributions.length} USDC distributions`
                : "USDC Distributions"}
            </h3>
          </div>
          <div className="flex shrink-0 items-center gap-2 pb-0.5">
            <ProvenanceBadge kind={panelProvenance} variant="compact" />
          </div>
        </div>
      )}

      <ul
        className="flex flex-col px-5"
        aria-label="Recent distributions"
      >
        {distributions.map((d) => {
          const provenance = distributionProvenance(d.txHash);
          return (
            <li
              key={d.id}
              className="flex flex-col gap-2.5 py-4 border-b border-white/5 last:border-b-0"
            >
              {/* Period + amount headline row */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-[length:var(--ct-text-xs)] font-medium text-white">
                    Period {d.period}
                  </span>
                  <ProvenanceBadge variant="strip" kind={provenance} />
                </div>
                <span className="text-[length:var(--ct-text-xs)] font-medium text-[var(--ct-accent)] tabular-nums">
                  {formatUsdCompact(d.amountUsdc)}
                </span>
              </div>

              {/* Meta grid */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <MicroLabel>Recipients</MicroLabel>
                  <span className="text-[length:var(--ct-text-xs)] text-zinc-400 tabular-nums">
                    {d.recipientsCount.toString()}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <MicroLabel>Distributed</MicroLabel>
                  <span className="text-[length:var(--ct-text-xs)] text-zinc-400 tabular-nums">
                    {dateFmt.format(d.distributedAt)} UTC
                  </span>
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <MicroLabel>Tx hash</MicroLabel>
                  {d.txHash && !d.txHash.toLowerCase().startsWith("0xmock") ? (
                    <a
                      href={`${EXPLORER_TX_BASE}${d.txHash}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className={cn(
                        "inline-flex items-center gap-1 text-[length:var(--ct-text-xs)] font-medium text-[var(--ct-accent)] transition-colors duration-150 hover:text-[color-mix(in_srgb,var(--ct-accent)_80%,transparent)]",
                      )}
                      title={d.txHash}
                      aria-label={`View transaction ${d.txHash} on explorer`}
                    >
                      <span className="truncate">{abbreviateAddress(d.txHash)}</span>
                    </a>
                  ) : d.txHash ? (
                    <span className="truncate text-[length:var(--ct-text-xs)] text-zinc-500">
                      Simulated (testnet fixture)
                    </span>
                  ) : (
                    <span className="text-[length:var(--ct-text-xs)] text-zinc-500">Pending broadcast</span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );

  return bare ? (
    inner
  ) : (
    <section className="dark rounded-2xl border border-white/10 bg-surface-card shadow-sm overflow-hidden flex flex-col">
      {inner}
    </section>
  );
}
