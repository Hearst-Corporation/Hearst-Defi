import type { DashboardPageData } from "@/app/(product)/dashboard/_data/dashboard-loader";
import {
  ActivityFeed,
  AreaChartPanel,
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

  const chartData = [
    { month: "Jan", nav: 1.0 },
    { month: "Feb", nav: 1.02 },
    { month: "Mar", nav: 1.04 },
    { month: "Apr", nav: 1.03 },
    { month: "May", nav: 1.06 },
    { month: "Jun", nav: 1.08 },
  ];

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
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>NAV trajectory</CardTitle>
            <CardDescription>
              Indexed performance — full history wiring in progress.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AreaChartPanel
              data={chartData}
              xKey="month"
              yKey="nav"
              name="NAV index"
              height={300}
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
