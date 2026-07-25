import Link from "next/link";

import type { VaultPageData } from "@/app/(product)/vaults/_data/vault-loader";
import {
  formatBps,
  formatNavPerShare,
  formatShareAmount,
  formatUsdcAmount,
} from "@/lib/chain/wired-view";
import { selectExposedFromWired, selectFromWired } from "@/lib/backend/resolved-view";
import { investProductPath } from "@/lib/vaults/invest-routes";
import {
  POLICY_TARGET_BPS,
  POCKET_LABELS,
  reasonLabel,
  vaultModeLabel,
  wiredMetric,
} from "@/lib/greenfield/wired";
import {
  Disclaimer,
  PageActions,
  PageHeader,
  PageLayout,
  Panel,
  Row,
  RowList,
  Section,
} from "@/views/_shared/layout";
import { Badge, Kpi, KpiGrid, ProvenanceBadge, Timeline } from "@/ui";

export function VaultsView({ data }: { data: VaultPageData }) {
  if (data.state === "error") {
    return (
      <PageLayout>
        <PageHeader
          title="Hearst Bitcoin Reserve Vault — Series 1"
          meta="Vault state unavailable"
          description="BTC-accumulation instrument backed by real Bitcoin mining."
        />
        <Panel title="We couldn't reach the data">
          <p className="px-5 py-4 text-sm text-muted">
            The service that reports this vault's state did not respond. Nothing
            here has been estimated or filled in.
          </p>
        </Panel>
      </PageLayout>
    );
  }

  const { snapshot, capacity, strategies, terms, runtime } = data;

  return (
    <PageLayout>
      <PageHeader
        eyebrow="Series 1"
        title="Hearst Bitcoin Reserve Vault"
        meta={`${vaultModeLabel(runtime.mode)} · Methodology v3.0`}
        description="BTC-accumulation instrument backed by real Bitcoin mining, structured across three on-chain pockets and delivered at maturity."
        actions={
          <PageActions
            secondary={{ href: "/proof-center", label: "Proof status" }}
            primary={{ href: investProductPath("HYV-A"), label: "Subscribe →" }}
          />
        }
      />

      <KpiGrid>
        <Panel>
          <div className="p-5">
            <Kpi
              label="Total assets"
              value={wiredMetric(
                selectExposedFromWired(snapshot, (s) => s.totalAssets),
                (v) => formatUsdcAmount(BigInt(v)),
              )}
              provenance={snapshot.status === "wired" ? "live" : "stale"}
            />
          </div>
        </Panel>
        <Panel>
          <div className="p-5">
            <Kpi
              label="NAV per share"
              value={wiredMetric(
                selectExposedFromWired(snapshot, (s) => s.navPerShare),
                (n) => formatNavPerShare(BigInt(n)),
              )}
            />
          </div>
        </Panel>
        <Panel>
          <div className="p-5">
            <Kpi
              label="TVL cap"
              value={wiredMetric(
                selectExposedFromWired(capacity, (c) => c.tvlCap),
                (cap) => formatUsdcAmount(BigInt(cap)),
              )}
            />
          </div>
        </Panel>
        <Panel>
          <div className="p-5">
            <Kpi
              label="Term"
              value={wiredMetric(
                selectExposedFromWired(terms, (t) => t.productDurationMonths),
                (m) => `${m} months`,
              )}
            />
          </div>
        </Panel>
      </KpiGrid>

      <Section
        index="01"
        title="Allocation"
        description="Capital structured across three on-chain pockets."
      >
        <Panel
          title="Policy allocation"
          description={
            strategies.status === "wired" ? (
              <ProvenanceBadge source="live" />
            ) : (
              reasonLabel(strategies.reason)
            )
          }
        >
          {strategies.status === "wired" ? (
            <RowList>
              {strategies.data.map((s) => (
                <Row
                  key={s.pocket}
                  label={`${s.pocket} · ${s.label}`}
                  value={formatBps(BigInt(s.targetBps))}
                  hint={s.isIdle ? "Idle reserve" : "Adapter-deployed"}
                />
              ))}
            </RowList>
          ) : (
            <div className="space-y-4 p-5">
              <div className="flex flex-wrap gap-2">
                {POLICY_TARGET_BPS.map((bps, i) => (
                  <Badge key={i} variant="accent">
                    {POCKET_LABELS[i]?.id}: {bps / 100}%
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-subtle">
                Configured policy split — not a live allocation.
              </p>
            </div>
          )}
        </Panel>
      </Section>

      <Section index="02" title="Reserve construction path">
        <Panel>
          <div className="p-5">
            <Timeline
              items={[
                {
                  id: "1",
                  title: "Capital deployed",
                  description: "Deposit mints share receipts across B1/B2/B3.",
                  timestamp: "Step 1",
                },
                {
                  id: "2",
                  title: "Mining production",
                  description: "B1 hashrate produces Bitcoin.",
                  timestamp: "Step 2",
                },
                {
                  id: "3",
                  title: "Reserve accumulation",
                  description: "BTC accumulates in B2 from mining only.",
                  timestamp: "Step 3",
                },
                {
                  id: "4",
                  title: "Delivery at maturity",
                  description: "Accumulated BTC delivered at term end.",
                  timestamp: "Step 4",
                  status: "success",
                },
              ]}
            />
          </div>
        </Panel>
      </Section>

      <Section index="03" title="Structure">
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Smart contract">
            <RowList>
              <Row label="Contract" value={vaultModeLabel(runtime.mode)} />
              <Row
                label="Underlying asset"
                value={wiredMetric(
                  selectFromWired(snapshot, (s) => s.asset),
                  (a) => a,
                )}
              />
              <Row label="SPV jurisdiction" value="Cayman" />
            </RowList>
          </Panel>
          <Panel title="Maturity">
            <RowList>
              <Row
                label="Term"
                value={wiredMetric(
                  selectExposedFromWired(terms, (t) => t.productDurationMonths),
                  (m) => `${m} months`,
                )}
              />
              <Row label="Delivered in" value="BTC" />
              <Row label="Periodic distribution" value="None" />
              <Row label="Soft lock-up" value="60 days" hint="Contractual" />
            </RowList>
          </Panel>
        </div>
      </Section>

      <Disclaimer>
        Subscription is arranged off-platform. Estimated outcomes are disclosed
        as a range — not guaranteed. No fixed rate.
      </Disclaimer>
    </PageLayout>
  );
}
