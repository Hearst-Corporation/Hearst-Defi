import { AwaitingMetricState } from "@/components/ui/awaiting-metric-state";
import { Card } from "@/components/ui/card";
import { ProofRow } from "@/components/ui/nested-panel";
import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { RECENT_DISTRIBUTIONS_EMPTY } from "@/components/proof/empty-messages";
import { EXPLORER_TX_BASE } from "@/lib/chain/client";
import type { ProofCenterDistributionRow } from "@/lib/data/proof-center";
import { distributionProvenance } from "@/lib/proof-center/distribution-provenance";
import { formatUsdCompact } from "@/lib/format/usd-compact";
import type { Provenance } from "@/components/ui/provenance-badge";
import { abbreviateAddress } from "@/lib/onchain";
import { explorerLinkClass } from "@/lib/ui/surface-classes";

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

interface RecentDistributionsProps {
  distributions: ReadonlyArray<ProofCenterDistributionRow>;
}

export function RecentDistributions({ distributions }: RecentDistributionsProps) {
  if (distributions.length === 0) {
    return (
      <Card hoverOverlay={false}>
        <DashboardPanelHeader
          eyebrow="Latest distributions"
          title="Awaiting first distribution"
          tone="quiet"
        />
        <AwaitingMetricState {...RECENT_DISTRIBUTIONS_EMPTY} />
      </Card>
    );
  }

  const panelProvenance = weakestProvenance(
    distributions.map((d) => distributionProvenance(d.txHash)),
  );

  return (
    <Card>
      <DashboardPanelHeader
        eyebrow="Latest distributions"
        title={`Last ${distributions.length} USDC distributions`}
        provenance={panelProvenance}
        tone="primary"
      />

      <ul className="divide-y divide-(--ct-border-soft)" aria-label="Recent distributions">
        {distributions.map((d) => {
          const provenance = distributionProvenance(d.txHash);
          return (
            <li
              key={d.id}
              className="product-doc-section__head py-4 first:pt-0 last:pb-0"
            >
              <div className="min-w-0 flex-1 product-doc-stack product-doc-stack--compact">
                <div className="product-doc-inline-row product-doc-inline-row--between">
                  <span className="body-sm font-medium ct-text-primary">
                    Period {d.period}
                  </span>
                  <ProvenanceBadge variant="strip" kind={provenance} />
                </div>
                <div className="mt-2 min-w-0">
                  <ProofRow label="Amount">{formatUsdCompact(d.amountUsdc)}</ProofRow>
                  <ProofRow label="Recipients">{d.recipientsCount.toString()}</ProofRow>
                  <ProofRow label="Distributed">
                    {dateFmt.format(d.distributedAt)} UTC
                  </ProofRow>
                  <ProofRow label="Tx hash">
                    {d.txHash && !d.txHash.toLowerCase().startsWith("0xmock") ? (
                      <a
                        href={`${EXPLORER_TX_BASE}${d.txHash}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className={explorerLinkClass}
                        title={d.txHash}
                      >
                        {abbreviateAddress(d.txHash)}
                      </a>
                    ) : d.txHash ? (
                      <span className="ct-text-muted body-xs">Simulated (testnet fixture)</span>
                    ) : (
                      <span className="ct-text-muted">Pending broadcast</span>
                    )}
                  </ProofRow>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
