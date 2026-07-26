import Link from "next/link";

import type { DashboardPageData } from "@/app/(product)/dashboard/_data/dashboard-loader";
import {
  ActivityFeed,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Kpi,
  KpiGrid,
  ProvenanceBadge,
} from "@/ui";

function formatBtcFromSats(sats: bigint): string {
  const whole = sats / 1_000_000_000_000n;
  const frac = sats % 1_000_000_000_000n;
  const fracStr = frac.toString().padStart(12, "0").slice(0, 4);
  return `${whole}.${fracStr} BTC`;
}

function formatUsdFromMicro(usdcMicro: bigint): string {
  const dollars = Number(usdcMicro / 1_000_000n);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(dollars);
}

export function DashboardView({ data }: { data: DashboardPageData }) {
  if (data.state === "error") {
    return (
      <div className="hc-page">
        <EmptyState
          title="We couldn't reach the data"
          description="The service that reports this vault's state did not respond. Nothing below has been estimated or filled in — this is a connectivity problem, not a statement about your position."
        />
      </div>
    );
  }

  const tvl =
    data.core.status === "wired"
      ? formatUsdFromMicro(data.core.data.totalAssets)
      : "—";
  const btcEarned =
    data.mining.status === "wired"
      ? formatBtcFromSats(data.mining.data.totalBtcEarnedSats)
      : "—";
  const hashrate =
    data.mining.status === "wired"
      ? `${data.mining.data.reportedHashrateTh.toString()} TH/s`
      : "—";
  const term =
    data.duration.status === "wired"
      ? `${data.duration.data.months.toString()} mo term`
      : "—";

  const proofEvents =
    data.proofSnapshot.status === "wired" && data.proofSnapshot.data.lastEventName
      ? [
          {
            id: "last-proof",
            title: data.proofSnapshot.data.lastEventName,
            detail: data.proofSnapshot.data.lastTxHash
              ? `Tx ${data.proofSnapshot.data.lastTxHash.slice(0, 10)}…`
              : undefined,
            timestamp: data.proofSnapshot.data.lastIndexedAt ?? "—",
            provenance: "attested" as const,
          },
        ]
      : [];

  return (
    <div className="hc-page space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="hc-eyebrow">Series 1</p>
          <Badge variant="outline">Mining note</Badge>
          <ProvenanceBadge
            source={data.runtimeMode === "live" ? "live" : "estimated"}
          />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Hearst Bitcoin Reserve Vault
        </h1>
        <p className="max-w-2xl text-sm text-muted">
          Accumulated BTC over a 24-month term — delivered at maturity. Estimated
          outcomes are disclosed as a range, not guaranteed.
        </p>
      </header>

      <KpiGrid>
        <Card className="border-none bg-surface-raised">
          <CardContent className="pt-5">
            <Kpi
              label="Total value locked"
              value={tvl}
              provenance={data.core.status === "wired" ? "live" : "stale"}
              hint="On-chain vault assets"
            />
          </CardContent>
        </Card>
        <Card className="border-none bg-surface-raised">
          <CardContent className="pt-5">
            <Kpi
              label="BTC accumulated"
              value={btcEarned}
              provenance={data.mining.status === "wired" ? "attested" : "stale"}
              hint="Mining revenue to date"
            />
          </CardContent>
        </Card>
        <Card className="border-none bg-surface-raised">
          <CardContent className="pt-5">
            <Kpi
              label="Hashrate"
              value={hashrate}
              provenance={data.mining.status === "wired" ? "oracle" : "stale"}
            />
          </CardContent>
        </Card>
        <Card className="border-none bg-surface-raised">
          <CardContent className="pt-5">
            <Kpi
              label="Product term"
              value={term}
              provenance={data.duration.status === "wired" ? "manual" : "stale"}
            />
          </CardContent>
        </Card>
      </KpiGrid>

      <div className="grid gap-6 lg:grid-cols-3">
        {/*
          Cette carte affichait une courbe « NAV trajectory » alimentée par six
          points écrits à la main dans ce fichier. Elle est retirée, et non
          rebranchée sur la série NAV réelle (InvestorNavSnapshot) : celle-ci est
          INVESTISSEUR-level tandis que ce dashboard est VAULT-level (backend
          HTTP). Le cron qui l'écrit le dit lui-même — un AUM de vault « cannot
          be mapped per-investor without inventing allocation ». La trajectoire
          de position vit donc sur /portfolio, où la donnée est native.
        */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Position value</CardTitle>
            <CardDescription>
              Your position is valued hourly and charted on your portfolio — this
              dashboard reports the vault, not an individual position.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState
              title="Charted on your portfolio"
              description="Hourly value prints are recorded per investor. Open your portfolio to see the trajectory of your own position."
              action={
                <Link
                  href="/portfolio"
                  className="text-sm font-medium text-accent underline-offset-4 hover:underline"
                >
                  Open portfolio
                </Link>
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Proof activity</CardTitle>
            <CardDescription>Latest indexed on-chain events</CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityFeed
              items={proofEvents}
              emptyTitle="No proof events indexed yet"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
